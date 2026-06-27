import time
from typing import List, Dict, Any
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from backend.config import settings
from backend.vector_store import hybrid_search
from backend.database import log_query_stat, add_chat_message, get_chat_messages

# Fallback response when text is not found in search chunks
UNAVAILABLE_RESPONSE = "I could not find this information in the indexed website."

def get_llm_client():
    """
    Retrieves the configured LLM client.
    Prefers OpenAI, then Gemini, then Grok, or raises error if keys are missing.
    """
    # Auto-select client based on configuration keys
    if settings.openai_api_key:
        return ChatOpenAI(
            api_key=settings.openai_api_key,
            model="gpt-4o-mini",
            temperature=settings.temperature
        )
    elif settings.gemini_api_key:
        return ChatGoogleGenerativeAI(
            google_api_key=settings.gemini_api_key,
            model="gemini-1.5-flash",
            temperature=settings.temperature
        )
    elif settings.grok_api_key:
        # Detect if it's actually a Groq key (starts with gsk_)
        if settings.grok_api_key.startswith("gsk_"):
            model = settings.grok_model
            # Map grok-beta to a standard groq model if it's still default
            if model == "grok-beta":
                model = "llama-3.3-70b-versatile"
            return ChatOpenAI(
                api_key=settings.grok_api_key,
                base_url="https://api.groq.com/openai/v1",
                model=model,
                temperature=settings.temperature
            )
        else:
            return ChatOpenAI(
                api_key=settings.grok_api_key,
                base_url="https://api.x.ai/v1",
                model=settings.grok_model,
                temperature=settings.temperature
            )
    else:
        raise ValueError(
            "No LLM API keys configured. Please add an OpenAI, Gemini, or Grok API Key in Settings."
        )

def compute_confidence(retrieved_chunks: List[Dict[str, Any]], answer: str) -> float:
    """
    Computes confidence score (0.0 to 1.0) based on similarity scores
    and whether the model refused to answer.
    """
    # If the answer is the fallback/unavailable message, confidence is zero.
    clean_answer = answer.strip().lower()
    clean_refusal = UNAVAILABLE_RESPONSE.strip().lower()
    
    if clean_refusal in clean_answer or "could not find this information" in clean_answer:
        return 0.0
        
    if not retrieved_chunks:
        return 0.0
        
    # Get average score of retrieved elements (already normalized to 0-1)
    avg_score = sum(c["score"] for c in retrieved_chunks) / len(retrieved_chunks)
    
    # Scale score: if top matches are very weak, scale down
    top_score = retrieved_chunks[0]["score"]
    if top_score < 0.4:
        avg_score *= 0.5
        
    return round(max(0.1, min(0.99, avg_score)), 2)

async def query_rag_pipeline(
    user_id: int,
    project_id: int,
    session_id: str,
    query: str,
    category_filter: str = None
) -> Dict[str, Any]:
    """
    Full RAG cycle: hybrid vector search -> prompt framing -> LLM generation -> database logging.
    """
    start_time = time.time()
    
    # 1. Retrieve chunks using hybrid search
    # Fetch Top K elements (default 5, adjustable in settings)
    k = settings.top_k
    chunks = hybrid_search(
        project_id=project_id,
        query=query,
        k=k,
        category_filter=category_filter
    )
    
    # Check if there is absolutely no content indexed
    if not chunks:
        # Log query to stats
        log_query_stat(user_id, project_id, query, time.time() - start_time)
        return {
            "answer": UNAVAILABLE_RESPONSE,
            "sources": [],
            "confidence": 0.0,
            "response_time": round(time.time() - start_time, 2)
        }
        
    # 2. Build context text
    context_blocks = []
    for idx, c in enumerate(chunks):
        source = c["metadata"].get("source_url", "Unknown Source")
        title = c["metadata"].get("title", "Untitled Section")
        context_blocks.append(f"--- Document Chunks {idx+1} [Title: {title} | Source: {source}] ---\n{c['text']}")
        
    context_str = "\n\n".join(context_blocks)
    
    # 3. Call LLM
    try:
        llm = get_llm_client()
        
        # Load last 6 messages of history for conversation context
        history = get_chat_messages(session_id)
        history_msgs = []
        for h in history[-6:]:
            if h["role"] == "user":
                history_msgs.append(HumanMessage(content=h["content"]))
            elif h["role"] == "assistant":
                if UNAVAILABLE_RESPONSE not in h["content"]:
                    history_msgs.append(AIMessage(content=h["content"]))
        
        system_instructions = (
            "You are a helpful and knowledgeable AI assistant.\n"
            "Answer the user's question using ONLY the provided retrieved context.\n"
            f"If the answer is unavailable in the retrieved context, say: \"{UNAVAILABLE_RESPONSE}\"\n"
            "Maintain natural, coherent dialogue. You can refer to previous conversation history if the user asks follow-up questions, but you must still ground all facts in the retrieved context.\n"
            "Never hallucinate. Do not use outside facts or assumptions."
        )
        
        prompt_text = (
            f"Retrieved Context:\n{context_str}\n\n"
            f"User Question: {query}\n\n"
            f"Answer:"
        )
        
        messages = [SystemMessage(content=system_instructions)]
        messages.extend(history_msgs)
        messages.append(HumanMessage(content=prompt_text))

        
        # Invoke LLM
        response = llm.invoke(messages)
        answer = response.content.strip()
        
    except ValueError as ve:
        # User has no keys configured - provide a helpful RAG context preview
        print(f"RAG pipeline LLM call skipped: {ve}")
        answer = (
            "⚠️ **No LLM API key configured in Settings.**\n"
            "Please add an OpenAI, Gemini, or Grok API key in the **Settings** page to enable AI-powered answers.\n\n"
            "**Retrieved Website Context Preview:**\n"
        )
        for idx, c in enumerate(chunks[:2]):
            snippet = c["text"][:300] + "..." if len(c["text"]) > 300 else c["text"]
            answer += f"\n- **From {c['metadata'].get('title', 'Indexed Page')}**: \"{snippet}\"\n"
            
    except Exception as e:
        # Fallback if API keys fail or network is down
        print(f"RAG pipeline LLM call failure: {e}")
        answer = f"Error communicating with LLM API: {str(e)}"
        
    response_time = round(time.time() - start_time, 2)
    
    # 4. Compute metrics
    confidence = compute_confidence(chunks, answer)
    
    # Prepare clean source citations for the frontend
    sources = []
    seen_urls = set()
    for c in chunks:
        url = c["metadata"].get("source_url", "")
        if url and url not in seen_urls:
            seen_urls.add(url)
            sources.append({
                "title": c["metadata"].get("title", "Indexed Page"),
                "url": url,
                "score": c["score"]
            })
            
    # If the answer was not found, empty the sources to avoid confusion
    if confidence == 0.0:
        sources = []
        
    # 5. Log transaction
    # Log user message
    add_chat_message(session_id, "user", query)
    # Log assistant message
    add_chat_message(
        session_id=session_id,
        role="assistant",
        content=answer,
        sources=sources,
        confidence=confidence,
        response_time=response_time
    )
    # Log query stats for metrics
    log_query_stat(user_id, project_id, query, response_time)
    
    return {
        "answer": answer,
        "sources": sources,
        "confidence": confidence,
        "response_time": response_time
    }
