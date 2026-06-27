import shutil
from pathlib import Path
from typing import List, Dict, Any, Optional
# pyrefly: ignore [missing-import]
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_openai import OpenAIEmbeddings
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_core.documents import Document
from backend.config import settings, FAISS_DIR

# Global cache for embeddings to prevent reloading on every call
_embeddings_cache = {}

def get_embeddings_model():
    """
    Returns the appropriate embeddings model based on active settings.
    Caches the local model to avoid performance penalty on subsequent loads.
    """
    model_type = "local"
    # Auto-detect if API key is provided and local is not strictly chosen
    if settings.openai_api_key:
        model_type = "openai"
    elif settings.gemini_api_key:
        model_type = "gemini"
        
    if model_type == "openai" and settings.openai_api_key:
        try:
            return OpenAIEmbeddings(
                api_key=settings.openai_api_key, 
                model="text-embedding-3-small"
            )
        except Exception as e:
            print(f"Failed to load OpenAIEmbeddings, falling back to local: {e}")
            
    elif model_type == "gemini" and settings.gemini_api_key:
        try:
            return GoogleGenerativeAIEmbeddings(
                google_api_key=settings.gemini_api_key, 
                model="models/embedding-001"
            )
        except Exception as e:
            print(f"Failed to load GoogleGenerativeAIEmbeddings, falling back to local: {e}")
            
    # Default to Local SentenceTransformers
    if "local" not in _embeddings_cache:
        print("Loading local sentence-transformers model (all-MiniLM-L6-v2)...")
        # Initialize HuggingFace embeddings
        _embeddings_cache["local"] = HuggingFaceEmbeddings(
            model_name="all-MiniLM-L6-v2",
            model_kwargs={'device': 'cpu'}
        )
    return _embeddings_cache["local"]

def get_project_index_path(project_id: int) -> Path:
    return FAISS_DIR / f"project_{project_id}"

def index_chunks(project_id: int, chunks: List[Dict[str, Any]]):
    """
    Indexes list of chunks into FAISS vector database.
    If database exists, loads it, appends new elements, and saves.
    """
    embeddings = get_embeddings_model()
    index_path = get_project_index_path(project_id)
    
    # Map raw chunks to Langchain Documents
    documents = [
        Document(
            page_content=c["text"],
            metadata=c["metadata"]
        ) for c in chunks
    ]
    
    if index_path.exists() and (index_path / "index.faiss").exists():
        # Load and append
        db = FAISS.load_local(str(index_path), embeddings, allow_dangerous_deserialization=True)
        db.add_documents(documents)
        db.save_local(str(index_path))
    else:
        # Create fresh index
        db = FAISS.from_documents(documents, embeddings)
        db.save_local(str(index_path))
        
    print(f"Indexed {len(chunks)} chunks for project {project_id}.")

def delete_vector_index(project_id: int):
    """Deletes FAISS files for a project."""
    index_path = get_project_index_path(project_id)
    if index_path.exists():
        shutil.rmtree(index_path)

# --- HYBRID SEARCH ALGORITHM ---

def keyword_search(
    db: FAISS, 
    query: str, 
    k: int, 
    category_filter: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Executes in-memory keyword matching over index documents.
    """
    results = []
    query_tokens = set(query.lower().split())
    if not query_tokens:
        return []
        
    doc_dict = db.docstore._dict
    
    for doc_id, doc in doc_dict.items():
        # Check category filter
        doc_category = doc.metadata.get("category", "")
        if category_filter and doc_category != category_filter:
            continue
            
        doc_text_lower = doc.page_content.lower()
        
        # Calculate text overlap score (number of query terms matched)
        matches = sum(1 for token in query_tokens if token in doc_text_lower)
        if matches > 0:
            results.append({
                "doc": doc,
                "score": matches / len(query_tokens) # Normalize overlap score
            })
            
    # Sort by overlap score descending
    results.sort(key=lambda x: x["score"], reverse=True)
    
    # Return formatted results limited to k
    formatted_results = []
    for item in results[:k]:
        doc = item["doc"]
        formatted_results.append({
            "text": doc.page_content,
            "metadata": doc.metadata,
            "score": item["score"]
        })
    return formatted_results

def hybrid_search(
    project_id: int,
    query: str,
    k: int = 5,
    category_filter: Optional[str] = None,
    alpha: float = 0.5 # weight for semantic vs keyword
) -> List[Dict[str, Any]]:
    """
    Executes hybrid search by combining Semantic (FAISS) and Keyword searches
    using Reciprocal Rank Fusion (RRF) to merge ranks.
    """
    index_path = get_project_index_path(project_id)
    if not index_path.exists() or not (index_path / "index.faiss").exists():
        return []
        
    embeddings = get_embeddings_model()
    db = FAISS.load_local(str(index_path), embeddings, allow_dangerous_deserialization=True)
    
    # 1. Semantic Search
    # FAISS score is distance (lower is closer/better for L2, higher is better for cosine)
    # Langchain FAISS usually returns distance. Let's retrieve twice target K to allow RRF merging
    retriever_k = k * 2
    
    # Setup metadata filter for semantic search if category is specified
    filter_dict = None
    if category_filter:
        filter_dict = {"category": category_filter}
        
    semantic_docs_and_scores = db.similarity_search_with_score(
        query, 
        k=retriever_k, 
        filter=filter_dict
    )
    
    # 2. Keyword Search
    keyword_docs_and_scores = keyword_search(
        db, 
        query, 
        k=retriever_k, 
        category_filter=category_filter
    )
    
    # 3. Reciprocal Rank Fusion (RRF)
    # Combine ranks from both searches. RRF Score = 1 / (60 + rank)
    rrf_scores = {}
    doc_registry = {} # maps doc content hash to actual doc info
    
    # Helper to hash doc content for deduplication
    def get_doc_id(doc_text: str) -> str:
        return str(hash(doc_text))
        
    # Process semantic ranking
    for rank, (doc, score) in enumerate(semantic_docs_and_scores):
        doc_id = get_doc_id(doc.page_content)
        doc_registry[doc_id] = (doc, score) # Store score/distance
        if doc_id not in rrf_scores:
            rrf_scores[doc_id] = 0.0
        # Add reciprocal rank score weighted by alpha
        rrf_scores[doc_id] += alpha * (1.0 / (60.0 + (rank + 1)))
        
    # Process keyword ranking
    for rank, item in enumerate(keyword_docs_and_scores):
        doc_text = item["text"]
        doc_id = get_doc_id(doc_text)
        
        # If not present in registry, create Langchain doc matching it
        if doc_id not in doc_registry:
            doc = Document(page_content=doc_text, metadata=item["metadata"])
            # Map keyword score (0.0 - 1.0) to a simulated distance for confidence calculations
            doc_registry[doc_id] = (doc, 1.0 - item["score"]) 
            
        if doc_id not in rrf_scores:
            rrf_scores[doc_id] = 0.0
        # Add reciprocal rank score weighted by (1 - alpha)
        rrf_scores[doc_id] += (1.0 - alpha) * (1.0 / (60.0 + (rank + 1)))
        
    # Sort docs by RRF score descending
    sorted_doc_ids = sorted(rrf_scores.keys(), key=lambda x: rrf_scores[x], reverse=True)
    
    # Retrieve top K
    results = []
    for doc_id in sorted_doc_ids[:k]:
        doc, distance = doc_registry[doc_id]
        
        # Calculate a normalized similarity score (0.0 to 1.0)
        # Cosine similarity is usually 1 - distance/2 if using L2 normalized
        # Or simple bounding
        norm_score = max(0.0, min(1.0, 1.0 - (float(distance) / 2.0)))
        
        results.append({
            "text": doc.page_content,
            "metadata": doc.metadata,
            "score": round(float(norm_score), 3)
        })
        
    return results
