# Project Viva Examination Guide

This guide contains everything required to present, explain, and answer questions about the **RAG Website Chatbot** project during viva presentations.

---

## 1. Project Title
**Retrieval-Augmented Generation (RAG) Website Chatbot & Ingestion Platform**

---

## 2. Problem Statement
Organizations and individuals have vast amounts of custom information scattered across public websites, documentation sites, and local files (PDFs, DOCX, TXT). Standard large language models (LLMs) like GPT-4 or Gemini cannot access this proprietary or private data out-of-the-box. 

Furthermore, copying and pasting data directly into generic prompts is unfeasible due to model context window constraints, lack of organization, and potential hallucination risks. Developers need an automated, scalable way to ingest, vector-index, retrieve, and reference documents securely.

---

## 3. Objective
To build a lightweight, self-contained, full-stack RAG application that:
1. Ingests data dynamically from recursive web crawls, uploaded documents, or YouTube video transcripts.
2. Formulates local semantic representations using sentence-transformer embeddings and indexing layouts.
3. Performs high-speed lexical and semantic similarity vector search.
4. Synthesizes context-grounded AI answers utilizing secure LLM client integrations (OpenAI, Google Gemini, Grok).
5. Exposes a clean, responsive visual environment containing usage dashboard analytics, exporting options, and system parameter controls.

---

## 4. Existing System
Traditional search and retrieval pipelines rely on keyword-matching search engines (like standard SQL `LIKE` queries or basic Elasticsearch indexes).
### Drawbacks of Existing Systems:
*   **Lack of Semantic Context**: Searching for "how do I sign up" fails if the document only contains "registration steps".
*   **Hallucination in Standard Chatbots**: When generic LLMs are asked questions about proprietary websites, they hallucinate plausible-sounding but incorrect information because they do not have access to the actual content.
*   **High External Cost**: Relying on commercial cloud-native vector databases (Pinecone, Milvus) introduces recurring monthly API costs and privacy concerns.

---

## 5. Proposed System
The proposed system introduces a fully decoupled RAG architecture that generates embeddings locally using open-source HuggingFace models and indexes them using a local FAISS database, bypassing heavy cloud vector databases.

It incorporates **Hybrid Reciprocal Rank Fusion (RRF)** searching, combining both lexical keyword search and semantic vector matching to yield precise chunk results. It guides LLMs by feeding retrieved snippets as instructions, ensuring responses are mathematically grounded in the source documents.

---

## 6. Technologies Used & Rationale

| Technology | Rationale & Purpose |
|---|---|
| **Python** | Primary backend development language. Chosen for its rich ecosystem of AI, web, parsing, and math packages. |
| **FastAPI** | High-performance backend web framework. Chosen for its native asynchronous capabilities, automatic interactive Swagger UI documentation, and speed. |
| **LangChain** | Core abstraction layer. Standardizes document loading, chat history configurations, prompt structures, and API adapters for multiple LLM providers. |
| **FAISS (Facebook AI Similarity Search)** | Highly optimized C++ vector similarity search library. Chosen because it runs entirely locally, stores indexes on disk, and has no cloud overhead. |
| **BeautifulSoup4** | Powerful parsing engine for HTML. Used to decompose scripts, footers, and styles, converting raw markup into clean paragraphs, tables, and lists. |
| **HuggingFace Embeddings (`all-MiniLM-L6-v2`)** | 384-dimensional dense vector model. Runs efficiently on CPUs, converts raw text to vectors locally, and eliminates API charges for embeddings. |
| **SQLite** | Lightweight, file-based relational database. Handles users, projects, chat logs, and telemetry dashboard stats without configuring external SQL engines. |
| **React (Vite) + Tailwind CSS** | Fast compilation client workspace with glassmorphic dark mode styling. |
| **Docker & Nginx** | Packages services to run identically on any platform without manual runtime dependency installations. |

---

## 7. Complete Project Flow
```
[User inputs URL/File]
       ↓
[Backend extracts raw text (bs4 / pypdf)]
       ↓
[Split text into overlapping chunks]
       ↓
[Local Embedder generates 384d vectors]
       ↓
[FAISS Indexes vectors to disk storage]
       ↓
[User submits chatbot query]
       ↓
[Lexical + Semantic search retrieves top chunks]
       ↓
[RRF ranks and fuses relevant contexts]
       ↓
[Prompt injected with context is sent to LLM]
       ↓
[LLM returns grounded answer + citations]
```

---

## 8. Folder Explanation
*   `backend/`: Contains the core Python API service.
    *   `main.py`: Declares routers, CORS configurations, rate-limiting middlewares, and mounts static React folders.
    *   `config.py`: Loads environment defaults (`.env`) and manages user-customizable configurations (`settings.json`).
    *   `auth.py`: Controls JWT access token encoding/decoding and bcrypt passwords.
    *   `database.py`: Initializes SQLite tables and metrics queries.
    *   `crawler.py`: Holds recursive web crawler loop, robots.txt checks, and YouTube caption transcript fetchers.
    *   `parser.py`: Extracts raw text from PDF, DOCX, TXT, and MD files.
    *   `vector_store.py`: Loads local sentence transformers and handles hybrid FAISS searching.
    *   `rag_pipeline.py`: Assembles conversations, fetches context, checks user keys, and calls LLMs.
    *   `export.py`: Handles exporting conversation records to PDF, Markdown, CSV, or JSON.
*   `frontend/`: Contains the React dashboard client.
    *   `src/pages/`: Holds individual views (Home, Chat, Settings, Auth, Dashboard).
    *   `src/utils/api.js`: The central Axios wrapper resolving backend routes via relative addresses.

---

## 9. API Flow & Endpoints

### 1. Authentication
*   `POST /api/auth/register`: Takes username/password, hashes with bcrypt, creates DB record.
*   `POST /api/auth/login`: Validates password against hash, issues signed JWT token.
*   `GET /api/auth/me`: Verifies active JWT token, returns user ID.

### 2. Ingestion & Projects
*   `POST /api/projects`: Initiates project space. If a URL is sent, triggers background website indexing task.
*   `POST /api/projects/{project_id}/crawl`: Triggers a crawling run for additional URLs.
*   `POST /api/projects/{project_id}/upload`: Processes raw document uploads and indexes content.

### 3. Querying & Sessions
*   `POST /api/projects/{project_id}/sessions`: Creates a new chat thread.
*   `POST /api/sessions/{session_id}/ask`: Takes user query, runs Hybrid RRF retrieval, requests LLM response, logs logs database analytics.
*   `GET /api/sessions/{session_id}/export`: Exports chat history.

---

## 10. RAG Pipeline Explained
1.  **Document Chunking**: Raw files or scraped web pages are split into overlaps (e.g. 500 characters, 50 overlap) to keep semantic content connected across borders.
2.  **Dense Embedding**: Chunks are processed by `all-MiniLM-L6-v2` converting each sentence into a list of 384 floating-point coordinates.
3.  **Local FAISS Indexing**: Chunks and their coordinate representations are indexed locally.
4.  **Retrieval Execution**: The user query is vectorized. FAISS calculates L2 distances to locate nearby vectors. Concurrently, a keyword search calculates token matching frequencies.
5.  **Rank Fusion (RRF)**: Merges scores from semantic search and keyword matches.
6.  **Prompt Assembly**: The top ranked chunks are packed inside a prompt with strict system instructions: *Use ONLY the provided retrieved context. If it's not present, say "I could not find this information..."*.
7.  **LLM Call**: Generates the final answer.

---

## 11. Website Crawling Flow
1.  **Safety Check**: Resolves `robots.txt` using Python's `RobotFileParser` to verify crawling permissions.
2.  **Breadth-First Queue**: Enqueues the seed URL at depth 0.
3.  **Normalization & Visited Tracking**: Eliminates fragments and duplicates.
4.  **HTML Cleaning**: `BeautifulSoup4` strips boilerplate blocks (scripts, headers, footers).
5.  **Internal Link Extraction**: Extracts tags `href` and filters to retain only URLs in the same domain.
6.  **Yielding**: Calls `asyncio.sleep(0.1)` between downloads to prevent flooding the target server.

---

## 12. YouTube Processing Flow
1.  **Extract ID**: Regular expressions isolate the video ID from normal URLs, shorts, or embeds.
2.  **Scrape Captions**: Attempts to retrieve automated or creator captions using the `youtube-transcript-api`.
3.  **Fallback Speech-to-Text (STT)**: If no captions exist:
    *   Downloads video audio as `.m4a` stream using `yt-dlp`.
    *   Submits the audio stream to the configured LLM API (Whisper/Gemini).
    *   Deletes temporary audio streams upon receiving the transcribed script.

---

## 13. Document Ingestion Flow
*   **PDF**: `pypdf` extracts page layout texts iteratively.
*   **DOCX**: `docx2txt` extracts text streams and formatting.
*   **TXT & MD**: Python reads files directly using `utf-8` encoding.
*   **Chunking**: Word boundaries are maintained while chunking to prevent splitting words in half.

---

## 14. Error Handling
*   **Unsupported Formats**: Rejects file uploads with extensions other than `.pdf`, `.docx`, `.doc`, `.txt`, `.md`.
*   **Missing LLM Keys**: If no API keys are present, the backend falls back to providing a local context preview.
*   **Rate Limiting**: Custom middleware drops requests above 60 calls per minute per IP address, preventing resource exhaustion.
*   **Failed Crawls**: If a single page times out, it is skipped and logged, allowing the remaining queue to continue.

---

## 15. Advantages
1.  **Low Operating Cost**: Embeddings and vector stores are calculated entirely locally.
2.  **High Portability**: Docker files compile files and assets uniformly, allowing easy deployment.
3.  **High Accuracy**: Combining keyword search and semantic matching using RRF yields precise results.
4.  **No Hallucinations**: Prompt restrictions force the model to stick strictly to the index content.

---

## 16. Limitations
1.  **Cold Start Model Load**: Initial load of the HuggingFace sentence transformer model is slow on low-end servers.
2.  **Memory Constraints**: SQLite is a file-locked database, which limits writing speed if millions of queries run concurrently.
3.  **Context Size Limits**: Extremely large files generate too many chunks, which may exceed LLM prompt size limits.

---

## 17. Future Enhancements
*   **Redundant Chunks Deduplication**: Using semantic deduplication to avoid indexing similar pages twice.
*   **Multi-tenant Access Levels**: Restricting project access to specific team members.
*   **Advanced OCR Ingestion**: Using Tesseract OCR to read text inside scanned image files or charts.

---

## 18. Frequently Asked Viva Questions & Answers

### 1. What is RAG?
**Retrieval-Augmented Generation (RAG)** is a technique that supplies an LLM with external, verified context (retrieved from a database) to answer questions, ensuring accuracy and avoiding model hallucination.

### 2. How is RAG different from fine-tuning?
*   **Fine-tuning** changes the actual weights of the neural network to learn style, behavior, or domain formatting. It is expensive and does not prevent hallucination.
*   **RAG** doesn't modify the model. Instead, it queries database contexts and passes them to the model, ensuring factual correctness.

### 3. What is an embedding?
An embedding is a numerical vector representing the semantic meaning of text. Words or sentences with similar meanings are located close to each other in vector space.

### 4. What is a Vector Database?
A database designed to store vector embeddings. It runs indexing algorithms (like IndexFlatL2 or HNSW) to execute rapid nearest-neighbor searches.

### 5. Why did you choose FAISS instead of Pinecone?
**FAISS** is open-source, runs entirely locally, stores indexes directly on disk, and has no network latency or subscription costs. **Pinecone** is a cloud service requiring API keys and internet connectivity.

### 6. What is the role of HuggingFace Sentence Transformers in this app?
It converts raw chunks of text into 384-dimensional dense vectors locally using the `all-MiniLM-L6-v2` model, removing the need for paid cloud embedding APIs.

### 7. What embedding model is used in your project?
We use `all-MiniLM-L6-v2` (default local) which outputs 384 dimensions. If OpenAI or Gemini keys are configured, it can automatically scale to `text-embedding-3-small` (OpenAI, 1536 dimensions) or `embedding-001` (Gemini).

### 8. Explain Cosine Similarity vs. L2 Distance.
*   **L2 Distance (Euclidean)**: Measures the straight-line distance between points. Flat FAISS indexes use this.
*   **Cosine Similarity**: Measures the angular difference between vectors, ignoring magnitude. (FAISS computes cosine similarity if vectors are normalized first).

### 9. What is Reciprocal Rank Fusion (RRF)?
A merging algorithm. It combines the ranking results of multiple search algorithms (e.g. semantic rank + keyword rank) into a unified list by calculating `Score = 1 / (60 + Rank)`.

### 10. Why is Hybrid Search useful?
Lexical keyword search is great for locating exact matches (like codes, SKUs, or product names). Semantic search is great for locating concepts and context. Hybrid search combines both.

### 11. What is the role of `langchain` in your project?
LangChain provides standard interfaces for chat messages, models, and embeddings, making it easy to swap LLMs (OpenAI, Gemini, Grok) without rewriting the core business logic.

### 12. Why did you select FastAPI?
FastAPI is built on ASGI (Asynchronous Server Gateway Interface), making it much faster than Flask or Django. It also generates interactive Swagger UI documentation out-of-the-box.

### 13. How does the rate-limiting middleware work?
It tracks the client IP address in a Python dictionary. It checks timestamps of requests in the last 60 seconds; if they exceed 60 requests, it blocks the client with a `429 Too Many Requests` response.

### 14. What database is used for transactional data?
**SQLite**. It is a serverless, file-based SQL database, perfect for local storage and simple deployments.

### 15. How do you secure user passwords?
We hash them with `bcrypt` using a randomly generated salt. We do not store plain-text passwords.

### 16. What is JWT and how is it used here?
**JSON Web Token**. It is a signed JSON object issued to a user upon successful login. The client includes it in the `Authorization: Bearer <token>` header of requests to access private endpoints.

### 17. How is website crawling recursively executed?
We use a breadth-first search (BFS) queue. We start at the base URL, extract links matching the domain and prefix filter, add them to the queue, and stop once we reach the configured `max_pages` or `crawl_depth`.

### 18. Why do you use `asyncio.sleep(0.1)` in the crawler loop?
It yields control back to the event loop, preventing the crawler from blocking other backend API traffic and ensuring the scraper is polite to the target web server.

### 19. How does the crawler prevent duplicate parsing?
We normalize crawled URLs (removing fragments/slashes) and track them in a `visited` set.

### 20. How is robots.txt parsed?
We fetch the site's `robots.txt` and parse it using standard Python library `urllib.robotparser.RobotFileParser` to verify permissions.

### 21. How do you scrape YouTube videos?
We extract the video ID and request captions using the `youtube-transcript-api`. If no captions exist, we download the audio using `yt-dlp` and run speech-to-text.

### 22. What happens if a PDF contains scanned images instead of text?
`pypdf` only extracts native text layers. If the PDF consists of scanned images, it will return an empty text stream.

### 23. What are chunks and why is chunking necessary?
Chunks are smaller sections of documents. Chunking is necessary because LLMs have token limits and processing smaller, relevant blocks of text yields better search results.

### 24. What is chunk overlap?
It is the number of characters shared between consecutive chunks. It ensures context is not lost at the split boundaries of chunks.

### 25. Explain the importance of HTML sanitization in RAG.
Scraped web pages often contain navigation headers, scripts, and trackers. Removing these boilerplate blocks prevents indexing noise and saves tokens.

### 26. Why do you convert HTML tables to markdown formatting?
Plain text layout destroys the relationships between columns and rows. Converting tables to markdown preserves structured data for vector indexing.

### 27. What happens when the user asks a question not covered by the index?
The prompt directs the LLM to output a fallback response: *"I could not find this information..."* to prevent hallucinations.

### 28. How is chat conversation history maintained?
We load the last 6 messages of a chat session from SQLite and inject them into the LLM prompt as conversation history, enabling follow-up questions.

### 29. How is the confidence score calculated?
It is computed by averaging the normalized similarity scores of the retrieved FAISS chunks. If the model outputs the fallback response, the confidence is set to `0.0`.

### 30. Why is Vite preferred over Create React App (CRA)?
Vite compiles and builds frontend assets using ES modules, providing instant hot module reloading (HMR) and significantly faster build times than Webpack.

### 31. What is the role of Nginx in your Docker Compose?
Nginx serves the built static React files on port 80 and acts as a reverse proxy, forwarding all `/api` traffic to the uvicorn FastAPI container on port 8000.

### 32. What are the key benefits of containerizing with Docker?
Docker packages the exact OS dependencies, Python runtime, and Nginx setups, ensuring the app runs identically in development and production environments.

### 33. Can you run this without an internet connection?
Yes! Since the embeddings model and FAISS vector indexer run locally on the CPU, the core ingestion and searching work offline. You only need an internet connection to query LLM APIs.

### 34. What is the role of `.env`?
It separates configuration secrets (like API keys and secrets) from the code, keeping credentials secure.

### 35. How does the frontend handle API errors?
Axios interceptors catch response status codes. For example, a `401 Unauthorized` triggers an automatic logout and redirects the user to the auth page.

### 36. How is the dashboard data generated?
SQLite runs aggregation queries to count projects, pages, total chunks, queries per day, average response time, and average LLM confidence scores.

### 37. What is `bcrypt`?
A password-hashing function designed to protect against brute-force attacks by using an adjustable work factor that makes calculation slow.

### 38. How does the PDF export feature work?
It uses a custom PDF encoder written in pure Python. It structures standard catalog pages and maps Helvetica text streams without using heavy external PDF libraries.

### 39. What is a CORS error and how is it avoided here?
**Cross-Origin Resource Sharing**. Browsers block scripts from making requests to a different domain. We avoid it by using `CORSMiddleware` in FastAPI to allow requests from any origin.

### 40. Why is uvicorn used?
FastAPI is only an application framework; it does not listen on sockets. Uvicorn is a high-speed ASGI web server that listens on ports and forwards requests to FastAPI.

### 41. How does the app support voice commands?
It uses the browser's Web Speech API (`webkitSpeechRecognition` for listening and `speechSynthesis` for speaking), requiring no third-party API keys.

### 42. How are file uploads handled in FastAPI?
`UploadFile` receives the file stream, saves it to `UPLOADS_DIR` with a unique UUID, and processes the text using `parser.py`.

### 43. What is standard chunk size and chunk overlap?
Typically, a chunk size of 500-1000 characters with an overlap of 50-100 characters is ideal for most document retrieval pipelines.

### 44. Can we swap the local embedder for a different model?
Yes. You can configure a different HuggingFace model in `vector_store.py` by changing the `model_name` argument in the `HuggingFaceEmbeddings` instantiation.

### 45. What is the role of `pydantic` in the API?
It validates incoming request payloads against defined schemas (like user registration details), ensuring data types are correct before processing.

### 46. What happens if the SQLite database is deleted?
The database file will be recreated automatically next time the app starts, but existing projects, user accounts, and chat histories will be lost.

### 47. How can you scale this RAG application?
You can replace SQLite with PostgreSQL, use a centralized vector database cluster like Milvus or Qdrant, and distribute crawler runs using Celery task queues.

### 48. What is the advantage of using Python's `sqlite3` built-in module?
It requires no server setup or administration, saving CPU overhead and simplifying local deployments.

### 49. How does `yt-dlp` extract audio?
It parses the YouTube page, fetches the direct `.m4a` audio stream link, and downloads it directly to disk.

### 50. Why is the React build served from Nginx instead of Vite in production?
Vite is a development server designed for fast reloading. Serving compiled static assets through Nginx is much more secure, stable, and resource-efficient in production.
