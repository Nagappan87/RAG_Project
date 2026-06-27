# Master Technical Documentation & Viva Preparation Guide
## Retrieval-Augmented Generation (RAG) Website Chatbot & Ingestion Platform

---

## Table of Contents
1. [Chapter 1 — Project Overview](#chapter-1-project-overview)
2. [Chapter 2 — Technology Stack Analysis & Rationale](#chapter-2-technology-stack-analysis--rationale)
3. [Chapter 3 — Folder Structure & Design Principles](#chapter-3-folder-structure--design-principles)
4. [Chapter 4 — File-by-File Deep Dive](#chapter-4-file-by-file-deep-dive)
5. [Chapter 5 — End-to-End Execution Flow Pipeline](#chapter-5-end-to-end-execution-flow-pipeline)
6. [Chapter 6 — System Architecture Design](#chapter-6-system-architecture-design)
7. [Chapter 7 — Retrieval-Augmented Generation (RAG) Deep Dive](#chapter-7-retrieval-augmented-generation-rag-deep-dive)
8. [Chapter 8 — Web Scraping & Crawler Specifications](#chapter-8-web-scraping--crawler-specifications)
9. [Chapter 9 — YouTube Transcript & Audio Processing Pipeline](#chapter-9-youtube-transcript--audio-processing-pipeline)
10. [Chapter 10 — Multi-Format Document Ingestion Engine](#chapter-10-multi-format-document-ingestion-engine)
11. [Chapter 11 — API Endpoints Blueprint](#chapter-11-api-endpoints-blueprint)
12. [Chapter 12 — Database Schema & Relational Mapping](#chapter-12-database-schema--relational-mapping)
13. [Chapter 13 — System Security Blueprint](#chapter-13-system-security-blueprint)
14. [Chapter 14 — AI Components & Model Parametrization](#chapter-14-ai-components--model-parametrization)
15. [Chapter 15 — Algorithmic Operations & Complexity Analysis](#chapter-15-algorithmic-operations--complexity-analysis)
16. [Chapter 16 — Design Patterns Mapping](#chapter-16-design-patterns-mapping)
17. [Chapter 17 — Software Engineering Best Practices](#chapter-17-software-engineering-best-practices)
18. [Chapter 18 — Decision Rationale & Alternatives Matrix](#chapter-18-decision-rationale--alternatives-matrix)
19. [Chapter 19 — System Performance & Resource Optimization](#chapter-19-system-performance--resource-optimization)
20. [Chapter 20 — Fail-safes, Logs, and Error Handling](#chapter-20-fail-safes-logs-and-error-handling)
21. [Chapter 21 — Comprehensive Q&A Vault](#chapter-21-comprehensive-qa-vault)
22. [Chapter 22 — Examiner's Viva Room](#chapter-22-examiners-viva-room)
23. [Chapter 23 — Feature In-Depth Analysis](#chapter-23-feature-in-depth-analysis)
24. [Chapter 24 — Concept-to-Code Learning Guide](#chapter-24-concept-to-code-learning-guide)
25. [Chapter 25 — Future Code & Architecture Refactoring](#chapter-25-future-code--architecture-refactoring)
26. [Chapter 26 — Multi-Environment Deployment](#chapter-26-multi-environment-deployment)
27. [Chapter 27 — Executive Presentation Kit](#chapter-27-executive-presentation-kit)
28. [Glossary of Technical Terms](#glossary-of-technical-terms)
29. [Final Project Summary](#final-project-summary)

---

## Chapter 1 — Project Overview

### 1.1 What Problem This Project Solves
Organizations, support teams, and students often have proprietary information distributed across documentation websites, local document manuals (PDFs, DOCX, TXT, MD), or YouTube lecture videos. Accessing this localized knowledge base through standard Large Language Models (LLMs) like GPT-4 or Gemini is impossible because:
1. Standard LLMs are frozen in time and have no access to private, proprietary, or recently updated content.
2. Manually copy-pasting pages or documents into a prompt is blocked by model context window constraints and is highly inefficient.
3. Traditional keyword search engines (like SQL `LIKE` queries or Elasticsearch matching) only check literal strings, failing to resolve queries that share semantic meaning but use different terminology (e.g., searching for "login issues" when the document states "authentication failures").

This project solves this by creating a **decoupled, self-contained, full-stack RAG (Retrieval-Augmented Generation) ingestion and chatbot platform**. It automatically crawls, indexes, retrieves, and synthesizes localized data dynamically using a React-based glassmorphic dashboard interface and a FastAPI backend service.

### 1.2 Comparison with Existing Systems
Existing industry options generally rely on complex, subscription-heavy cloud infrastructure. Here is how this project compares:

| Vector DB / Framework | Operating Model | Operating Costs | Infrastructure Footprint | Cold Start / Latency |
| :--- | :--- | :--- | :--- | :--- |
| **Enterprise Cloud RAG** (e.g., Pinecone, AWS Kendra) | SaaS Cloud | High (recurring API/Node fees) | Multi-cloud cluster orchestration | Network overhead (50-200ms) |
| **Antigravity RAG Platform** (Our Solution) | **Local-First & Hybrid** | **Zero** (local CPU embedding & FAISS) | Single Docker instance, runs locally | Local cache lookup (<15ms) |

### 1.3 Advantages of Our Solution
- **Zero Cost Ingestion**: Vectorization (`all-MiniLM-L6-v2`) and search matching (FAISS) are computed entirely locally on CPU, avoiding cloud embedding costs.
- **Dynamic Ingestion Options**: Combines recursive web crawling (HTML sanitization), local document parsers, and YouTube transcripts (with audio Whisper transcribing fallback).
- **Hybrid RRF Search Engine**: Combines semantic vector similarity with traditional exact keyword matching via Reciprocal Rank Fusion (RRF), yielding high precision.
- **Admin Dashboard**: Real-time telemetry, confidence metrics, queries frequency loggers, and latency trackers.
- **Glassmorphic UI**: High-fidelity React client supporting light/dark toggle and voice activation.

---

## Chapter 2 — Technology Stack Analysis & Rationale

This project uses a curated technology stack chosen for speed, reliability, and local computation.

### 2.1 Backend Core: Python & FastAPI
- **Why Python?**: Python is the industry standard for AI and data processing. It provides mature libraries for embeddings (`sentence-transformers`), matrix search (`faiss`), scraping (`beautifulsoup4`), and document parsing.
- **Why not Java or C++?**: Java lacks natively integrated machine learning packages, resulting in verbose JNI wrappers. C++ offers raw speed (which is why FAISS is written in C++), but lacks the rapid web development ecosystem.
- **Why FastAPI instead of Flask/Django?**: 
  - FastAPI is built natively on ASGI (Asynchronous Server Gateway Interface), making it faster than Flask (WSGI) and enabling concurrent client requests.
  - It handles type validation out-of-the-box using Pydantic, and generates interactive Swagger documentation (`/docs`) automatically.

### 2.2 Vector Storage: local FAISS
- **Why FAISS (Facebook AI Similarity Search)?**: FAISS is a highly optimized C++ library for dense vector similarity search. It is run locally on the server's CPU/RAM, saving index vectors directly to disk (`index.faiss`).
- **Why not Pinecone or Milvus?**: Pinecone is a paid proprietary cloud service requiring API keys and internet connectivity. Milvus is open-source but requires setting up complex Docker network clusters (MinIO, Etcd, Milvus nodes). FAISS runs in-process with zero network overhead.

### 2.3 Local Embedding Model: `all-MiniLM-L6-v2`
- **Why?**: Maps sentences into a 384-dimensional dense vector space. It is extremely compact (approx. 90MB on disk) and runs fast on CPUs while retaining excellent semantic capturing ability.
- **Why not OpenAI `text-embedding-3-small`?**: OpenAI requires internet access and triggers per-token charges. We support it as an optional upgrade in Settings, but fallback to local execution.

### 2.4 Technology Comparison Matrix

| Technology | Purpose | Chosen Option | Main Alternative | Rationale for Selection |
| :--- | :--- | :--- | :--- | :--- |
| **Backend API** | App Logic & Tasks | **FastAPI** | Flask / Django | ASGI Async execution, Pydantic type checks, auto-docs. |
| **Database** | Relational Logs | **SQLite** | PostgreSQL | Built-in serverless engine; zero configuration/administration. |
| **Vector DB** | Semantic Indexing | **FAISS** | Pinecone | Run locally on CPU, direct disk saving, zero network delays. |
| **Embedder** | Vector Generation | **MiniLM-L6-v2** | OpenAI Embeddings | Offline capabilities, zero API costs, small CPU footprint. |
| **Frontend** | Interactive UI | **React (Vite)** | Next.js / CRA | Fast Hot Module Replacement (HMR), small build bundles. |
| **Styling** | Layout & Themes | **Tailwind CSS** | Bootstrap | Utility-first CSS, clean transitions, responsive grid syntax. |

---

## Chapter 3 — Folder Structure & Design Principles

The project is structured to enforce a clean separation of concerns:

```
rag/
├── backend/
│   ├── main.py            # API routes, CORS setup, Rate limiting
│   ├── config.py          # Settings loading (.env, settings.json)
│   ├── auth.py            # JWT Token management, password hashing
│   ├── database.py        # SQLite initialization and SQL CRUD operations
│   ├── crawler.py         # Asynchronous BFS web crawler & YouTube parser
│   ├── parser.py          # Document text parser (PDF, DOCX, TXT)
│   ├── vector_store.py    # Local FAISS index & Hybrid Search (RRF)
│   ├── rag_pipeline.py    # RAG Orchestration (context fetching, history, LLM)
│   ├── export.py          # Chat exporters (JSON, CSV, MD, Custom PDF)
│   └── Dockerfile         # Python slim production container definition
├── frontend/
│   ├── src/
│   │   ├── pages/         # Home, Chat workspace, Analytics, Settings, Auth
│   │   ├── utils/         # Axios global instance & API wrappers
│   │   ├── App.jsx        # Routing configuration & Theme providers
│   │   └── main.jsx       # App entry mount
│   ├── nginx.conf         # Nginx server configuration with proxy redirects
│   └── Dockerfile         # Multi-stage React builder & Nginx container
└── docker-compose.yml     # Orchestration file linking services and volumes
```

### 3.1 Design Principles Applied
1. **Separation of Concerns**: The frontend handles layout and browser interactions (Speech Synthesis/Recognition), while the backend focuses on data parsing, SQLite operations, and AI vector searches.
2. **Local-First Default**: Embeddings and vector searches run locally, meaning the application remains functional even when offline (excluding LLM queries).
3. **Decoupled Architecture**: Standardized protocols (FastAPI JSON schemas) connect the components. You can swap the React frontend for a mobile app, or swap SQLite for PostgreSQL without altering the core search logic.

---

## Chapter 4 — File-by-File Deep Dive

### 4.1 Backend Service Modules

#### 4.1.1 [config.py](file:///c:/Users/Nagappan%20SP/rag/backend/config.py)
- **Purpose**: Establishes directory pathways (`BASE_DIR`, `DATA_DIR`, `FAISS_DIR`, `UPLOADS_DIR`), loads variables from `.env`, and maintains a persistent configuration file (`settings.json`) that can be updated live.
- **Key Classes/Methods**:
  - `Settings`: Initializes configuration parameters (API keys, chunk sizes, top_k values, temperature, crawler defaults).
  - `load_from_disk()`: Reads configurations from `data/settings.json`.
  - `save_to_disk()`: Serializes variables back to disk.
  - `update(new_settings)`: Updates setting attributes and triggers a save action.
- **Design Decisions**: Storing user-configurable parameters like chunk size or API keys in `settings.json` allows admins to change LLM providers or chunk ranges on-the-fly without restarting Python.

#### 4.1.2 [auth.py](file:///c:/Users/Nagappan%20SP/rag/backend/auth.py)
- **Purpose**: Manages user registration security, hashes passwords, generates signed JSON Web Tokens (JWT), and checks authentication status using FastAPI dependencies.
- **Key Methods**:
  - `verify_password(plain, hashed)`: Uses `bcrypt.checkpw` to verify passwords.
  - `get_password_hash(password)`: Hashes passwords with a randomly generated salt.
  - `create_access_token(data, expires)`: Encodes user payload into signed JWT strings.
  - `get_current_user(token)`: Extracted from headers or query parameters (supporting file export downloads), decodes JWT, and returns user details.
- **Design Decisions**: Uses `bcrypt` for slow hashing protection against brute-force attacks, and `HS256` signed JWTs for stateless sessions.

#### 4.1.3 [database.py](file:///c:/Users/Nagappan%20SP/rag/backend/database.py)
- **Purpose**: Serverless relational storage. Connects to `rag_chatbot.db` and maps CRUD processes.
- **Key Tables**:
  - `users`: ID, username, bcrypt password hash.
  - `projects`: Configs, statistics (pages, chunks), and user ownership.
  - `indexed_pages`: Pages titles, URLs, and chunk numbers.
  - `chat_sessions` & `chat_messages`: Conversation logging.
  - `crawler_status`: Live background crawl tracking.
  - `query_stats`: Latency dashboard logs.
- **Performance Tuning**: Formulates database indices (`idx_projects_user_id`, `idx_indexed_pages_project_id`, etc.) to speed up query groupings inside the dashboard.

#### 4.1.4 [crawler.py](file:///c:/Users/Nagappan%20SP/rag/backend/crawler.py)
- **Purpose**: Scrapes website URLs recursively or extracts YouTube video transcripts.
- **Key Methods**:
  - `crawl_and_index_website()`: Runs an asynchronous BFS crawl queue.
  - `is_allowed_by_robots(url)`: Respects robots.txt rules using `urllib.robotparser.RobotFileParser`.
  - `extract_page_data(html, url)`: Sanitizes HTML using `BeautifulSoup` and `bleach`, extracting headings, paragraphs, lists, and converting tables to Markdown.
  - `fetch_youtube_transcript(video_id)`: Downloads captions. Fallback `fetch_youtube_transcript_stt()` downloads the audio stream via `yt-dlp` and transcribes using Whisper/Gemini.
- **Design Decisions**: Calls `asyncio.sleep(0.1)` inside the crawler loop to yield control to the event loop, ensuring the crawler is polite to web servers and does not block other API traffic.

#### 4.1.5 [parser.py](file:///c:/Users/Nagappan%20SP/rag/backend/parser.py)
- **Purpose**: Extracts raw text layers from uploaded files.
- **Key Methods**:
  - `parse_file(file_path, filename)`: Routes processing based on suffix. Supports `.pdf` (`pypdf.PdfReader`), `.docx` (`docx2txt.process`), and `.txt`/`.md`.
  - `chunk_text(text, filename, size, overlap)`: Chunks text while respecting word boundaries.
- **Design Decisions**: Checks for empty strings after text parsing to catch scanned, image-only PDFs before they are passed to the embedder, raising an error.

#### 4.1.6 [vector_store.py](file:///c:/Users/Nagappan%20SP/rag/backend/vector_store.py)
- **Purpose**: Manages embedding model loading and hybrid vector searches.
- **Key Methods**:
  - `get_embeddings_model()`: Instantiates and caches models. Prefers `OpenAIEmbeddings` or `GoogleGenerativeAIEmbeddings` if API keys are active, otherwise falls back to local `all-MiniLM-L6-v2`.
  - `index_chunks(project_id, chunks)`: Saves documents to a local FAISS index file.
  - `keyword_search(db, query, k, category)`: Tokenizes query and checks occurrences in `db.docstore._dict` to calculate lexical matching.
  - `hybrid_search(project_id, query, k, category, alpha)`: Runs vector search and keyword search concurrently, combining results using Reciprocal Rank Fusion (RRF).
- **Design Decisions**: Uses RRF to combine lexical keyword matching (great for exact names/codes) and semantic similarity (great for general concepts).

#### 4.1.7 [rag_pipeline.py](file:///c:/Users/Nagappan%20SP/rag/backend/rag_pipeline.py)
- **Purpose**: Orchestrates the RAG conversation cycle.
- **Key Methods**:
  - `query_rag_pipeline(user, project, session, query, category)`: Runs hybrid search, builds context blocks, loads conversation history (last 6 messages), and calls the configured LLM.
  - `compute_confidence(chunks, answer)`: Calculates confidence based on retrieved similarity scores, scaling down if the match is weak, or setting to `0.0` if the model outputs the fallback response.
- **Design Decisions**: Restricts history injection to the last 6 messages, filtering out AI fallback refusal responses to keep the prompt size concise and save input tokens.

#### 4.1.8 [export.py](file:///c:/Users/Nagappan%20SP/rag/backend/export.py)
- **Purpose**: Exports conversation records into multiple file formats.
- **Key Methods**:
  - `export_chat_session(session_id, format_type)`: Directs formatting logic.
  - `generate_pdf_from_messages()`: A **custom, pure Python PDF binary stream generator** that writes page catalogs, Helvetica fonts, margins, and text lines directly without external PDF packages.
- **Design Decisions**: Writing custom PDF streams prevents binary footprint errors and dependency issues during Docker installations.

#### 4.1.9 [main.py](file:///c:/Users/Nagappan%20SP/rag/backend/main.py)
- **Purpose**: App entry point. Mounts CORS configurations, rate-limiting middleware, routers, and static folders.
- **Key Middleware**:
  - `rate_limit_middleware`: Identifies request IP and blocks clients exceeding 60 requests per minute with a `429 Too Many Requests` code.

---

## Chapter 5 — End-to-End Execution Flow Pipeline

This flowchart traces the entire execution pipeline, from a user action to the final AI response:

```
[User Action: Ask Chatbot a Question]
       │
       ▼
[React Frontend Client] ── Speech Synthesis check -> webkitSpeechRecognition
       │
       ▼ (HTTP POST /api/sessions/{session_id}/ask)
[FastAPI Entry Router]
       │
       ├──► [Rate Limiter Middleware] ── Exceeds 60 req/min? ──► [HTTP 429 Error]
       │
       ├──► [JWT Auth Validation] ───── Expired/Invalid? ─────► [HTTP 410 Auth Error]
       │
       ▼
[RAG Pipeline Orchestrator]
       │
       ▼ (Query + Project ID)
[Hybrid Retrieval Engine]
       │
       ├──► [In-Memory Keyword Match] ── Token matches in docstore._dict
       │                                            │
       │                                            ▼ (Rank Lists)
       ├──► [Dense Semantic Search] ──── L2 distance via FAISS vector index
       │                                            │
       │                                            ▼
       └──────────────► [Reciprocal Rank Fusion (RRF)] ──── Fuses ranks (alpha = 0.5)
                                                    │
                                                    ▼
                                            [Top K Context Chunks]
                                                    │
       ┌────────────────────────────────────────────┘
       ▼
[Context + Chat History Assembly] ── Fetches last 6 messages from SQLite
       │
       ▼ (System Instructions + Context Chunks + Query)
[LLM Client Dispatcher]
       │
       ├──► [Configured API Client] ── OpenAI (GPT-4o-mini) / Gemini (1.5-flash)
       │                                            │
       │                                            ▼
       └──────────────────────────────────► [Synthesized Answer]
                                                    │
       ┌────────────────────────────────────────────┘
       ▼
[Metrics & Logging Engine]
       │
       ├──► [Confidence Calculator] ── Evaluates query answer alignment & similarity scores
       ├──► [SQLite Logger] ────────── Saves user query, assistant answer, and sources
       └──► [Telemetry DB Logger] ──── Records query response latency
       │
       ▼ (JSON Payload Response)
[React Frontend Renderer] ─────── Renders bubble, updates charts, triggers voice speech
```

---

## Chapter 6 — System Architecture Design

Here is the system architecture design showing the components layout and network interactions:

```
             ┌────────────────────────────────────────────────────────┐
             │                     CLIENT BROWSER                     │
             │                                                        │
             │   ┌──────────────────────────────────────────────┐     │
             │   │             React SPA (Vite App)             │     │
             │   │                                              │     │
             │   │    - Home Dashboard   - Chatbot UI           │     │
             │   │    - System Settings  - Recharts Dashboard   │     │
             │   └──────────────────────┬───────────────────────┘     │
             │                          │ (HTML5 Web Speech API)      │
             │                          ▼                             │
             │          [SpeechRecognition / SpeechSynthesis]         │
             └──────────────────────────┬─────────────────────────────┘
                                        │
                                        │ (Port 80 HTTP / API Proxy / WS upgrade)
                                        ▼
             ┌────────────────────────────────────────────────────────┐
             │                     NGINX RUNTIME                      │
             │                                                        │
             │   - Serves React Static Bundles (index.html, JS, CSS)  │
             │   - Redirects all "/api" traffic to Backend port 8000  │
             └──────────────────────────┬─────────────────────────────┘
                                        │
                                        │ (Internal TCP redirect)
                                        ▼
             ┌────────────────────────────────────────────────────────┐
             │                 FASTAPI BACKEND SERVICE                │
             │                                                        │
             │   ┌──────────────────────────────────────────────┐     │
             │   │            FastAPI Routers (ASGI)            │     │
             │   │                                              │     │
             │   │  - Auth  - Projects  - Uploads  - Sessions   │     │
             │   └──────┬──────────────────────┬──────────────┬─┘     │
             │          │                      │              │       │
             │          ▼                      ▼              ▼       │
             │   ┌──────────────┐      ┌──────────────┐┌──────────────┐│
             │   │ Async Crawler│      │ Hybrid Search││RAG Pipeline  ││
             │   │              │      │              ││              ││
             │   │ - robots.txt │      │ - Keyword    ││ - OpenAI     ││
             │   │ - BeautifulSoup│    │ - FAISS      ││ - Gemini     ││
             │   │ - yt-dlp/STT │      │ - RRF        ││ - Grok       ││
             │   └──────┬───────┘      └──────┬───────┘└──────┬───────┘│
             └──────────┼─────────────────────┼───────────────┼────────┘
                        │                     │               │
                        ▼                     ▼               ▼
             ┌──────────────────┐      ┌──────────────┐┌──────────────┐
             │  LOCAL STORAGE   │      │ FAISS INDEX  ││ CLOUD APIs   │
             │                  │      │              ││              │
             │  rag_chatbot.db  │      │ index.faiss  ││ - OpenAI /   │
             │  - Users / Chats │      │ index.pkl    ││   Gemini /   │
             │  - Crawler Stats │      │              ││   Groq APIs  │
             └──────────────────┘      └──────────────┘└──────────────┘
```

---

## Chapter 7 — Retrieval-Augmented Generation (RAG) Deep Dive

### 7.1 What is RAG?
Retrieval-Augmented Generation (RAG) is a technique that supplies an LLM with external, verified context (retrieved from a database) to answer questions, ensuring accuracy and avoiding model hallucination.

### 7.2 Why RAG instead of Fine-Tuning?
- **Cost**: Fine-tuning requires massive computation, dataset prep, and periodic retraining. RAG only requires indexing text updates.
- **Accuracy**: Fine-tuned models still hallucinate. RAG provides source context, letting the model reference exact document details.
- **Information Control**: If a document is updated, RAG updates immediately by re-indexing that chunk. Fine-tuned models cannot easily forget or edit specific facts without a full retrain.
- **Access Control**: RAG can restrict document access dynamically based on user permissions, whereas fine-tuned models expose all training facts to any user.

### 7.3 Vector Similarity Mathematics
To retrieve relevant chunks, the text query is vectorized and compared against indexed document chunks.

#### Cosine Similarity vs. L2 Distance
- **L2 Distance (Euclidean)**: Measures the straight-line distance between two coordinates in space:
$$d(u, v) = \sqrt{\sum_{i=1}^{n} (u_i - v_i)^2}$$
FAISS flat indexes use L2 distance by default. A lower distance indicates higher similarity.

- **Cosine Similarity**: Measures the angular difference between vectors, ignoring magnitude:
$$\text{sim}(u, v) = \frac{u \cdot v}{\|u\| \|v\|} = \frac{\sum u_i v_i}{\sqrt{\sum u_i^2}\sqrt{\sum v_i^2}}$$
In `vector_store.py`, distances are normalized to similarity scores between `0.0` and `1.0` using:
$$\text{Normalized Score} = \max\left(0.0, \min\left(1.0, 1.0 - \frac{\text{Distance}}{2.0}\right)\right)$$

### 7.4 Chunking & Overlap
If we index an entire 50-page manual as a single document, the embedding loses detail, and the model's context window will be overwhelmed. We split text into overlapping chunks:
- **Chunk Size**: 500 characters. Keeping chunks small ensures the retrieved context focuses specifically on the query.
- **Chunk Overlap**: 50 characters. This overlap ensures context (like pronouns or transitions) is not lost at the split boundaries of chunks.

---

## Chapter 8 — Web Scraping & Crawler Specifications

The web crawler automatically processes websites while respecting web scraping guidelines.

### 8.1 Safety Compliance (Robots.txt)
Before scraping a domain, `crawler.py` uses `urllib.robotparser.RobotFileParser` to parse the domain's `robots.txt` file (e.g., `https://example.com/robots.txt`) and check if the crawler user agent is allowed to access the target URL. If disallowed, the crawl job is marked as failed.

### 8.2 Asynchronous BFS Queue
The crawler implements a Breadth-First Search (BFS) queue:
- **Queue Initialization**: The seed URL is added at depth 0.
- **Normalizer**: URLs are normalized (removing fragments/queries) and tracked in a `visited` set to prevent infinite loops.
- **BFS Traversal**: Links are popped, fetched, parsed, and matching internal links (within the same domain and directory prefix) are added to the queue at `depth + 1` until `max_pages` or `max_depth` limits are met.

### 8.3 HTML Processing & Sanitization
To avoid indexing noise (like navigation bars, footers, trackers, and scripts), pages are cleaned using `BeautifulSoup` and `bleach`:
1. Decomposes noise tags: `script`, `style`, `nav`, `footer`, `form`, `iframe`, `noscript`.
2. Extracts metadata keywords, titles, and heading hierarchies (`h1` through `h6`).
3. Formats tables into Markdown layouts to preserve structured data for retrieval.
4. Groups body paragraphs and lists, stripping out extra whitespace.

---

## Chapter 9 — YouTube Transcript & Audio Processing Pipeline

YouTube videos are often excellent sources of knowledge, but standard web crawlers cannot extract information from video files. Our system implements a dedicated ingestion pipeline:

```
[User Submits YouTube URL]
          │
          ▼
[Extract Video ID via Regex] ───── Fetch Video Title (oEmbed API)
          │
          ▼
[Call youtube-transcript-api] ── Captions found?
          │
          ├──► (Yes) ──► [Format Transcripts with Timestamps]
          │
          └──► (No) ───► [Speech-to-Text Fallback Pipeline]
                                  │
                                  ▼ (yt-dlp)
                         [Download m4a audio stream]
                                  │
                                  ▼
                         [API Whisper/Gemini transcribing]
                                  │
                                  ▼
                         [Create transcripts with timestamps]
                                  │
                                  ▼
                         [Clean temporary audio stream file]
```

- **Captions Extract**: Queries the `youtube-transcript-api` to fetch English (`en`) or fallback captions.
- **Audio Extract Fallback**: If captions are disabled, `yt-dlp` downloads the direct audio stream as a temporary `.m4a` file.
- **Audio API Transcription**: The audio file is transcribed using Google Gemini, OpenAI Whisper, or Groq APIs depending on configured keys. Timestamps (e.g. `[01:23]`) are injected every 10-15 seconds.
- **Cleanup**: The temporary audio file is deleted immediately after transcription to save disk space.

---

## Chapter 10 — Multi-Format Document Ingestion Engine

Users can upload local files to supplement scraped website data:

- **PDF Ingestion**: Uses `pypdf.PdfReader` to extract native text layers page-by-page. Image-only or scanned PDFs are caught, and the system throws a validation error if no text is found.
- **DOCX Ingestion**: Uses `docx2txt.process` to parse Word document structures, headings, list markers, and body paragraphs.
- **TXT & MD Ingestion**: Read directly using `utf-8` encoding.
- **Document Chunking**: Split into chunks using `chunk_text()` to prevent splitting words in half. Chunks are labeled with source metadata (e.g., `upload://my_file.pdf`) to support citations.

---

## Chapter 11 — API Endpoints Blueprint

| Method | Endpoint | Request Body | Response Body | Validation & Errors |
| :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/auth/register` | `{username, password}` | Success message, user ID | `400`: Username already exists or missing inputs. |
| **POST** | `/api/auth/login` | `{username, password}` | JWT access token, username | `410`: Incorrect username or password. |
| **POST** | `/api/projects` | `{name, url, crawl_depth, max_pages}` | Success message, project ID | `401`: Missing token. Initiates crawl in background if URL is sent. |
| **GET** | `/api/projects` | None | List of projects and stats | `401`: Unauthorized. |
| **DELETE**| `/api/projects/{id}` | None | Success message | `404`: Project not found. Deletes SQLite records & vector indexes. |
| **POST** | `/api/projects/{id}/upload` | `Multipart/Form-data` | Success state, chunks created | `400`: Unsupported file format. Parses & indexes document chunks. |
| **POST** | `/api/sessions/{id}/ask` | `{query, category_filter}` | `{answer, sources, confidence, response_time}` | `404`: Session not found. Triggers retrieval and calls LLM. |
| **GET** | `/api/sessions/{id}/export` | None | File stream download | Validates authentication via token query parameter. |

---

## Chapter 12 — Database Schema & Relational Mapping

The SQLite database schema organizes user accounts, chatbot configurations, chat histories, and usage metrics:

```
                  ┌──────────────┐
                  │    users     │
                  ├──────────────┤
                  │ id (PK)      │◄────────────────────────┐
                  │ username     │                         │
                  │ password_hash│                         │
                  │ created_at   │                         │
                  └──────┬───────┘                         │
                         │ (1:N)                           │
                         ▼                                 │
                  ┌──────────────┐                         │
                  │   projects   │                         │
                  ├──────────────┤                         │
                  │ id (PK)      │◄──────────┐             │
                  │ user_id (FK) ├───────────┼────────────┐│ (1:N)
                  │ name         │           │            ││
                  │ url          │           │            ││
                  │ crawl_depth  │           │            ││
                  │ max_pages    │           │            ││
                  │ page_count   │           │            ││
                  │ chunk_count  │           │            ││
                  └──────┬───────┘           │            ││
                         │ (1:N)             │            ││
                         ▼                   │            ││
                  ┌──────────────┐           │            ││
                  │indexed_pages │           │            ││
                  ├──────────────┤           │            ││
                  │ id (PK)      │           │            ││
                  │ project_id(FK)───────────┘            ││
                  │ url          │                        ││
                  │ title        │                        ││
                  │ chunk_count  │                        ││
                  └──────────────┘                        ││
                                                          ││
                                                          ▼▼
                                                   ┌──────────────┐
                                                   │chat_sessions │
                                                   ├──────────────┤
                                                   │ id (PK)      │◄───────┐
                                                   │ project_id(FK)────────│──┐
                                                   │ user_id (FK) │        │  │
                                                   │ title        │        │  │
                                                   └──────┬───────┘        │  │
                                                          │ (1:N)          │  │
                                                          ▼                │  │
                                                   ┌──────────────┐        │  │
                                                   │chat_messages │        │  │
                                                   ├──────────────┤        │  │
                                                   │ id (PK)      │        │  │
                                                   │ session_id(FK)────────┘  │
                                                   │ role         │           │
                                                   │ content      │           │
                                                   │ sources      │           │
                                                   │ confidence   │           │
                                                   │ response_time│           │
                                                   └──────────────┘           │
                                                                              │
                                                                              ▼
                                                                       ┌──────────────┐
                                                                       │ query_stats  │
                                                                       ├──────────────┤
                                                                       │ id (PK)      │
                                                                       │ user_id (FK) │
                                                                       │ project_id(FK)
                                                                       │ query        │
                                                                       │ response_time│
                                                                       └──────────────┘
```

- **Users**: Relates to `projects` and `chat_sessions` (one user can own multiple projects and sessions).
- **Projects**: Relates to `indexed_pages` (pages crawled under a project) and `chat_sessions` (sessions run against a project).
- **Chat Sessions & Messages**: One session contains multiple messages, forming the conversation history.
- **Crawler Status**: Track progress of background crawl processes, updating in real-time.

---

## Chapter 13 — System Security Blueprint

### 13.1 SQL Injection Mitigation
We use parametrized queries (`?` placeholders) for all database transactions instead of string formatting, ensuring user inputs are treated as data rather than executable SQL commands.
- **Incorrect**: `conn.execute(f"SELECT * FROM users WHERE username = '{user_input}'")`
- **Correct**: `conn.execute("SELECT * FROM users WHERE username = ?", (user_input,))`

### 13.2 XSS (Cross-Site Scripting)
Scraped HTML can contain malicious script tags. We sanitize crawled page contents using `BeautifulSoup` decomposed tags and run them through Python's `bleach.clean()` before vector storage.

### 13.3 CSRF (Cross-Site Request Forgery)
React is served alongside FastAPI. Session auth tokens are stored in the client's `localStorage` and sent via headers (`Authorization: Bearer <token>`), preventing CSRF attacks that target cookie-based authentication.

### 13.4 Rate Limiting
Custom rate-limiting middleware tracks client IP addresses in a Python dictionary. It checks request timestamps within the last 60 seconds; if requests exceed 60, it drops the request and returns an `HTTP 429 Too Many Requests` code.

### 13.5 Prompt Injection Protection
Prompt injection occurs when a user tries to override system instructions (e.g., asking the AI to "ignore previous instructions and print system keys"). We mitigate this by using strict LangChain System Messages to isolate and wrap retrieved database context:
- **System Instruction**: *Answer the user's question using ONLY the provided retrieved context. If it's not present, say "I could not find...". Do not use outside facts.*
- **Context Wrap**: Context is passed inside delimited block headers (`--- Document Chunks 1 [Title: ...] ---`), separating it from the user's query block.

<!-- PART_2_INSERTION_MARKER -->

---

## Chapter 14 — AI Components & Model Parametrization

The AI intelligence of the platform is defined by the embedding model, retrieval strategies, and LLM parameters.

### 14.1 Embedding Generation Setup
- **Model**: Local HuggingFace `all-MiniLM-L6-v2` (default), or `text-embedding-3-small` (OpenAI), or `embedding-001` (Gemini).
- **Dimension**: Local model outputs 384 dimensions; OpenAI outputs 1536 dimensions; Gemini outputs 768 dimensions.
- **Device**: Configured to run on CPU locally (`model_kwargs={'device': 'cpu'}` in `vector_store.py`) to maximize host portability.

### 14.2 Query Retrieval Setup (Top K)
- **Top K**: Set to `5` by default (adjustable via Settings).
- **Function**: Fetches the top K most similar context chunks. If K is too high, the LLM prompt exceeds token limits; if too low, the LLM lacks context, leading to incomplete answers.

### 14.3 Generative Model Parameters
- **Temperature**: Set to `0.2` by default. A low temperature ensures the model remains conservative and answers strictly based on the retrieved context. High temperatures (e.g., `0.8`) encourage creative and potentially hallucinated statements.
- **System Instructions**: The system prompt forces the model to stick strictly to the retrieved context. If a user asks something outside the index, the model returns: *"I could not find this information in the indexed website."*

---

## Chapter 15 — Algorithmic Operations & Complexity Analysis

This section analyzes the time and space complexity of the system's core algorithms:

| Algorithm / Process | Module | Best Case Complexity | Worst Case Complexity | Space Complexity | Explanation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Recursive BFS Crawling** | `crawler.py` | $\mathcal{O}(V + E)$ | $\mathcal{O}(V + E)$ | $\mathcal{O}(V)$ | Traversing $V$ web links and $E$ edges up to depth and page limits. |
| **Local Exact Keyword Match** | `vector_store.py` | $\mathcal{O}(D \cdot Q)$ | $\mathcal{O}(D \cdot Q)$ | $\mathcal{O}(1)$ | Checks query tokens $Q$ against text representations of $D$ indexed documents. |
| **Dense Vector Similarity Search**| `vector_store.py` | $\mathcal{O}(D \cdot d)$ | $\mathcal{O}(D \cdot d)$ | $\mathcal{O}(D \cdot d)$ | Flat L2 distance search across $D$ vectors of dimension $d$ (384). |
| **Reciprocal Rank Fusion (RRF)** | `vector_store.py` | $\mathcal{O}(R \log R)$ | $\mathcal{O}(R \log R)$ | $\mathcal{O}(R)$ | Sorts and merges rank combinations of size $R$ (where $R = 2k$). |
| **Password Hashing (bcrypt)** | `auth.py` | $\mathcal{O}(2^W)$ | $\mathcal{O}(2^W)$ | $\mathcal{O}(1)$ | Computationally intensive hashing based on work factor parameter $W$ (default 12). |

- **Recursive BFS Crawling**: Visited URLs are tracked in a set to avoid cycles, keeping space complexity linear with respect to the page count.
- **Hybrid Fusion (RRF)**: Merging rankings from keyword and semantic searches takes linear time. The merged list is sorted in $\mathcal{O}(R \log R)$ time, which is fast since $R$ is small (typically $2 \times \text{Top\_K} = 10$).

---

## Chapter 16 — Design Patterns Mapping

The codebase applies structured design patterns to maintain clean execution:

### 16.1 Singleton Pattern
- **Implementation**: The embedding model cache (`_embeddings_cache` in `vector_store.py`) ensures the `all-MiniLM-L6-v2` transformer model (approx. 90MB) is loaded into RAM only once on the first request. Subsequent indexings reuse the cached instance.
- **Why**: Prevents memory leaks and heavy CPU loading cycles.

### 16.2 Factory Pattern
- **Implementation**: `get_llm_client()` in `rag_pipeline.py` and `get_embeddings_model()` in `vector_store.py` act as factories. They dynamically return the correct LLM adapter class (`ChatOpenAI`, `ChatGoogleGenerativeAI`, or custom endpoints) based on the settings configuration.

### 16.3 Layered Architecture
The project applies a classic Layered (Tiered) Architecture pattern:
- **Presentation Layer**: React views (`Home`, `Chat`, `Dashboard`).
- **Application Routing Layer**: FastAPI controllers (`main.py`) validating payloads.
- **Business Logic Layer**: Ingestion pipelines (`crawler.py`, `parser.py`, `vector_store.py`) and RAG synthesis (`rag_pipeline.py`).
- **Data Access Layer**: SQLite helper queries (`database.py`) and FAISS file access.

---

## Chapter 17 — Software Engineering Best Practices

### 17.1 SOLID Principles Application
- **Single Responsibility Principle (SRP)**: Each file has a clear responsibility. `auth.py` only handles user tokens; `database.py` only handles SQL queries; `parser.py` only parses file attachments.
- **Dependency Inversion Principle (DIP)**: `rag_pipeline.py` communicates with LLM APIs using generic LangChain wrappers rather than raw HTTP requests. This lets you swap LLM providers without rewriting the core prompt assembly logic.

### 17.2 DRY (Don't Repeat Yourself) & KISS (Keep It Simple, Stupid)
- **DRY**: File export layouts share formatting helpers in `export.py`. User validations share the `get_current_user` FastAPI dependency.
- **KISS**: Uses standard Python dictionaries and lists for intermediate structures (like query metrics or crawler queues) rather than complex object hierarchies, keeping the code readable.

---

## Chapter 18 — Decision Rationale & Alternatives Matrix

| Engineering Decision | Why Chosen | Disadvantages | Main Alternatives | Decision Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **Vector DB (FAISS)** | Local execution, zero cost, no network latency. | In-memory operations; doesn't scale easily to millions of records. | Pinecone / Qdrant | Pinecone requires paid subscriptions and internet access. Local FAISS is self-contained and sufficient for projects up to 100k chunks. |
| **SQL Engine (SQLite)** | Built-in serverless engine, single-file DB. | File-level locking; limits writing speed if concurrent writes are high. | PostgreSQL / MySQL | Avoids configuring external databases, making local development and Docker deployment much simpler. |
| **Framework (FastAPI)** | High performance, async, Pydantic validation. | Relies on Uvicorn ASGI; slightly steeper learning curve than Flask. | Flask | Flask is synchronous and lacks auto-generated Swagger UI or built-in schema validation. |
| **RAG vs. Fine-Tuning** | Fact accuracy, zero GPU training cost, dynamic updates. | Answer quality depends heavily on search retrieval performance. | Fine-Tuning | Fine-tuning does not prevent hallucinations and is expensive. RAG is ideal for fact-based question answering. |

---

## Chapter 19 — System Performance & Resource Optimization

### 19.1 Latency Optimization
- **Embedding Cache**: Reuses the loaded transformer model to avoid reload delays.
- **Hybrid Fusion**: Executes keyword search in memory over the loaded FAISS document store (`docstore._dict`), avoiding database disk lookup calls.
- **Connection Pools**: SQLite is run with `check_same_thread=False` to allow FastAPI's async event loop to reuse connection pools safely across worker threads.

### 19.2 Memory & CPU Footprints
- **CPU Offloading**: Local embedding generation runs on CPU. While slower than GPUs, CPU execution is highly portable and sufficient for real-time document uploads (processing a 10-page document takes less than 3 seconds).
- **Asynchronous Crawling**: Uses `httpx.AsyncClient` to fetch web pages concurrently without spawning separate threads, keeping RAM consumption under 250MB during crawling.

---

## Chapter 20 — Fail-safes, Logs, and Error Handling

### 20.1 Crawler Resiliency
If a web page fails to load (due to network timeout, broken links, or non-HTML files), the exception is logged, the page is skipped, and the crawler continues processing the rest of the queue.

### 20.2 Key API Fallbacks
If a user tries to query the chatbot without configuring API keys (OpenAI, Gemini, or Grok), the backend catches the `ValueError` and returns a **RAG Context Preview** directly to the chat interface. This displays the raw matching text snippets retrieved from the website index, ensuring the search engine remains functional even without LLM credits.

### 20.3 Database Recovery
If the SQLite file is corrupted or deleted, the system recreates the table structures automatically on the next launch. Missing FAISS indexes are initialized dynamically when a crawl or file upload is triggered.

<!-- PART_3_INSERTION_MARKER -->

---

## Chapter 21 — Comprehensive Q&A Vault

This vault contains critical technical questions categorized by focus areas, preparing you for technical reviews and presentations.

### 21.1 Beginner Questions
1. **What is the primary purpose of the RAG Chatbot project?**
   - *Answer*: To crawl websites or ingest files (PDF/DOCX) dynamically, index them locally as vector embeddings using a local similarity database (FAISS), and support a React frontend chat interface where an LLM answers user questions grounded in the ingested documents.
2. **What does RAG stand for?**
   - *Answer*: Retrieval-Augmented Generation.
3. **What is an API key and why is it needed in Settings?**
   - *Answer*: API keys authenticate your app to cloud LLM providers (OpenAI, Gemini, Grok). The key is required to query the models for answer synthesis.
4. **Is internet connection required to run this project?**
   - *Answer*: Not for ingestion or indexing. The crawler and document parsers run offline, generating embeddings via local SentenceTransformers. An internet connection is only needed when querying the cloud LLM APIs.
5. **What programming language is used for the backend?**
   - *Answer*: Python.
6. **What library is used for building the user interface?**
   - *Answer*: React.
7. **What is the difference between a project and a chat session in the database?**
   - *Answer*: A project represents a collection of documents/websites (with their own FAISS index). A chat session is a specific conversation thread running against that project.
8. **What database is used to store user credentials?**
   - *Answer*: SQLite.
9. **How are passwords stored securely?**
   - *Answer*: They are salted and hashed using the `bcrypt` algorithm before insertion into the `users` table.
10. **What is Docker used for in this project?**
    - *Answer*: It containerizes the frontend (React + Nginx) and backend (FastAPI + Python) into isolated runtimes, ensuring the app runs identically on any environment.

### 21.2 Intermediate Questions
11. **Explain the BFS crawling queue in `crawler.py`.**
    - *Answer*: The crawler initializes a list with a seed URL at depth 0. It pops URLs, normalizes them, and tracks visited URLs in a set to avoid loops. It fetches pages, extracts matching internal links, and appends them to the queue at `depth + 1` until page or depth limits are met.
12. **How does `vector_store.py` handle embedding generation dynamically?**
    - *Answer*: `get_embeddings_model()` inspects settings. If OpenAI or Gemini keys are set, it returns their respective cloud embeddings. Otherwise, it loads and caches the local HuggingFace `all-MiniLM-L6-v2` model.
13. **What is Reciprocal Rank Fusion (RRF) and why is it used?**
    - *Answer*: RRF combines rankings from multiple search engines by summing their reciprocal ranks:
$$RRF(d) = \sum_{m \in M} \frac{1}{60 + r_m(d)}$$
We use it to merge exact keyword matches with semantic vector matches, ensuring balanced retrieval.
14. **Why is Nginx necessary in the Docker configuration?**
    - *Answer*: Nginx serves the React static files and acts as a reverse proxy, forwarding all `/api` requests to Uvicorn running FastAPI on port 8000, preventing CORS errors in production.
15. **What is the purpose of the `rate_limit_middleware`?**
    - *Answer*: It tracks requests by client IP in a dictionary. It drops requests exceeding 60 calls per minute, returning an `HTTP 429 Too Many Requests` error to prevent DOS attacks.
16. **How does the system prevent model hallucinations?**
    - *Answer*: The prompt instructs the LLM to use *only* the retrieved context blocks. If the answer is missing from the context, the model must output: *"I could not find this information in the indexed website."*
17. **How does the YouTube pipeline download video transcripts?**
    - *Answer*: It extracts the video ID and requests transcripts using `youtube-transcript-api`. If captions are disabled, `yt-dlp` downloads the audio stream, Whisper/Gemini transcribes it, and the temp files are deleted.
18. **Why does `parser.py` use character-based chunking with word boundary respect?**
    - *Answer*: Split algorithms can slice words in half (e.g. splitting "database" into "data" and "base"). Splitting on whitespace keeps words intact.
19. **What database indexes were added and why?**
    - *Answer*: Indexes on `projects(user_id)`, `indexed_pages(project_id)`, and `chat_messages(session_id)` were added to optimize dashboard metrics and query response times.
20. **What happens if Uvicorn starts with multithreading and SQLite is locked?**
    - *Answer*: SQLite is run with `check_same_thread=False` and connection configurations are handled globally, allowing async queries to execute concurrently.

### 21.3 Advanced Questions
21. **How is the AI confidence score calculated?**
    - *Answer*: The system averages similarity scores of the retrieved chunks. If the LLM outputs the fallback refusal response, the confidence is set to `0.0`. If similarity scores are weak (< 0.4), the confidence is scaled down.
22. **Explain the custom PDF exporter implementation in `export.py`.**
    - *Answer*: It formats catalog entries, registers Helvetica fonts, maps page resource coordinates, wraps lines within 85 characters, and writes PDF byte structures directly to avoid external PDF dependencies.
23. **What is the role of `bleach` in the crawler pipeline?**
    - *Answer*: It strips out scripts, iframe elements, and style blocks from crawled HTML before chunking, preventing XSS and keeping the vector index clean.
24. **How are stateless JWT tokens verified securely?**
    - *Answer*: `auth.py` validates JWTs using `HS256`. The backend decodes the token, extracts the username/id payload, validates expiration, and verifies user existence.
25. **Explain the time and space complexity of FAISS similarity search.**
    - *Answer*: Flat L2 search has a time complexity of $\mathcal{O}(D \cdot d)$ (where $D$ is the number of database chunks and $d$ is dimension 384) and a space complexity of $\mathcal{O}(D \cdot d)$ to load vectors into memory.
26. **How does the React frontend coordinate voice interactions?**
    - *Answer*: It wraps the Web Speech API, using `webkitSpeechRecognition` to convert voice to text, and `speechSynthesis` to read responses aloud.
27. **What is the impact of chunk overlap on semantic matching?**
    - *Answer*: Overlap ensures that context split across chunk boundaries (like relative pronouns or subjects) is indexed in both chunks, maintaining semantic completeness.
28. **How does the system handle CORS issues in local development vs production?**
    - *Answer*: `CORSMiddleware` allows all origins (`"*"`) in development. In production, Nginx proxies frontend requests to `/api` internally, bypassing CORS checks.
29. **Why is `passlib` or `bcrypt` preferred over MD5 for hashing passwords?**
    - *Answer*: MD5 is fast and vulnerable to collision attacks and rainbow tables. Bcrypt uses slow key stretching with a configurable cost factor, making brute-force attacks difficult.
30. **How would you scale this RAG application for millions of documents?**
    - *Answer*: Replace SQLite with PostgreSQL, use a dedicated vector database cluster like Milvus or Qdrant, and distribute crawler runs using Celery task queues.

### 21.4 HR & Business Questions
31. **What is the business value of this RAG Website Chatbot?**
    - *Answer*: It automates customer support by answering user questions using real-time website documentation, reducing support ticket volume and costs.
32. **Who is the target audience for this application?**
    - *Answer*: SMEs, developers, customer support teams, and students needing local-first AI search engines.
33. **How does this project address data privacy concerns?**
    - *Answer*: Document ingestion and indexing run entirely locally on CPU, ensuring proprietary data never leaves the organization's host server.
34. **What is the development timeline for a production-ready roll-out?**
    - *Answer*: 6-8 weeks, covering security hardening, Postgres integration, Celery queues, and CI/CD pipelines.

### 21.5 Architecture, RAG, Python, FastAPI, AI, and Deployment Questions
(Note: Chapters 2 to 20 provide extensive details on these specific topics. Refer to the respective sections for deep-dive answers.)

---

## Chapter 22 — Examiner's Viva Room

This chapter contains challenging questions typically asked by external examiners, with correct/wrong responses and grading guidelines.

### Viva Question 1: How does your crawler prevent infinite crawl loops?
- **Examiner's Intent**: Checks if you understand graph traversal algorithms (BFS) and cycle detection.
- **Correct Answer**: *"We normalize URLs by stripping fragments and queries, and track visited URLs in a set. Before adding a link to the queue, we check if it is in the visited set."*
- **Wrong Answer**: *"The crawler automatically stops when it times out or crashes."*
- **Expected Marks**: 5 / 5.

### Viva Question 2: Why did you build a custom PDF generator instead of using ReportLab?
- **Examiner's Intent**: Evaluates dependency choices and cross-platform binary compatibility.
- **Correct Answer**: *"Using external libraries like ReportLab requires compiling C extensions, which can cause failures in alpine Docker builds. Writing a custom generator using standard Python stream syntax ensures a zero-dependency footprint."*
- **Wrong Answer**: *"ReportLab is too hard to write, so we did it this way."*
- **Expected Marks**: 5 / 5.

### Viva Question 3: How does your system mitigate SQL injection in Python?
- **Examiner's Intent**: Assesses security awareness in database operations.
- **Correct Answer**: *"We pass parameters as tuples in sqlite3 executions, keeping inputs separated from SQL commands."*
- **Wrong Answer**: *"SQLite is serverless, so it is immune to SQL injection."*
- **Expected Marks**: 5 / 5.

### Viva Question 4: What is the significance of the cost factor in bcrypt?
- **Examiner's Intent**: Tests knowledge of cryptographic security.
- **Correct Answer**: *"The cost factor determines key stretching cycles ($2^{\text{cost}}$). Increasing the cost factor slows down hashing speed, protecting against brute-force attacks even if the database is leaked."*
- **Wrong Answer**: *"It represents the size of the password string."*
- **Expected Marks**: 5 / 5.

### Viva Question 5: What is the math behind L2 normalization in vector search?
- **Examiner's Intent**: Evaluates mathematical understanding of embeddings search.
- **Correct Answer**: *"If vectors are normalized to unit length, L2 distance search becomes equivalent to cosine similarity search. L2 distance evaluates straight-line distance, while Cosine Similarity measures the angle between vectors."*
- **Wrong Answer**: *"L2 normalization calculates the average length of text strings."*
- **Expected Marks**: 5 / 5.

---

## Chapter 23 — Feature In-Depth Analysis

This chapter details the codebase mechanics and workflows of the system's core features.

### 23.1 Recursive Website Crawling
- **Workflow**: A background task triggers `crawl_and_index_website()`. It validates the seed URL, queries `robots.txt`, and runs a BFS queue crawler. For each HTML page:
  - Decomposes scripts, headers, and navigation blocks.
  - Converts tables to Markdown structures.
  - Cleans HTML body text using `bleach`.
  - Splits paragraphs into overlapping chunks.
  - Generates embeddings and saves them to the project's FAISS index.
- **Business Value**: Automatically imports online user manuals and blogs with a single URL entry, eliminating manual content copying.

### 23.2 Multi-Format Document Ingestion
- **Workflow**: `process_uploaded_file()` receives file attachments. Suffix-based filters parse layouts (PDF via `pypdf`, DOCX via `docx2txt`, TXT/MD via direct read). Chunks are generated, labeled with the upload source metadata, and appended to the project's FAISS vector index.
- **Business Value**: Allows companies to index offline internal manuals, contracts, and transcripts alongside scraped website data.

### 23.3 Voice Assistant Controls
- **Workflow**: Frontend wrappers invoke the browser's native `webkitSpeechRecognition` API when the microphone is toggled. User speech is transcribed into the text box and sent to the API. If voice output is enabled, the API response is run through `speechSynthesis` (with markdown formatting stripped) to read the answer aloud.
- **Business Value**: Simplifies access for visually impaired users and provides a hands-free interactive experience.

### 23.4 Telemetry & Admin Analytics Dashboard
- **Workflow**: SQL queries count users, projects, and chunks. Grouping queries count transactions per day, query frequencies, and response latency. React maps these logs to responsive `Recharts` charts (`AreaChart`, `LineChart`).
- **Business Value**: Provides system performance oversight, helps track API billing limits, and lists popular user questions.

---

## Chapter 24 — Concept-to-Code Learning Guide

This guide explains complex AI search concepts using simple analogies:

### 24.1 Analogy 1: Web Crawling as a Researcher
- **Concept**: Web Crawling.
- **Analogy**: Imagine a researcher in a library. They start at a book, check the bibliography for linked sources, go to those books, and repeat the process, taking notes and avoiding checking the same book twice.

### 24.2 Analogy 2: Embeddings as Map Coordinates
- **Concept**: Vector Embeddings.
- **Analogy**: Imagine a massive conceptual map where terms with similar meanings are located near each other:
  - *"Registration"* and *"Sign Up"* are next-door neighbors.
  - *"Apples"* is located in the fruit neighborhood, far away.
  Vector embeddings are simply the GPS coordinates (longitude and latitude) of these text concepts on this map.

### 24.3 Analogy 3: Semantic Search as Meaning Match
- **Concept**: Similarity Search.
- **Analogy**: Traditional keyword search acts like an index checking for a specific word (e.g. searching for the word "cat"). Semantic search matches meanings, finding documents about "felines" or "kittens" even if the word "cat" is never mentioned.

### 24.4 Analogy 4: Prompt Context as a Cheat Sheet
- **Concept**: RAG Context Injection.
- **Analogy**: Imagine taking an open-book exam. Instead of guessing from memory, you use a cheat sheet containing the most relevant textbook paragraphs matching the question. The model compiles its answer using only the details on that cheat sheet.

---

## Chapter 25 — Future Code & Architecture Refactoring

To scale this application for large-scale enterprise environments, consider these optimizations:

### 25.1 Database Scaling (PostgreSQL)
Migrate from SQLite to PostgreSQL with connection pooling (e.g., `pgbouncer`) to support high concurrent write rates and prevent database locking errors during crawling.

### 25.2 Distributed Crawl Queues (Celery & Redis)
Move crawler workloads out of FastAPI's thread pool into distributed worker processes using Celery and Redis. This keeps API response times fast and protects the web server during large crawl runs.

### 25.3 Advanced Vector Database Cluster (Qdrant)
For collections exceeding 100k chunks, replace the local FAISS file index with a dedicated Qdrant or Milvus cluster. This enables cloud-native vector storage, real-time index updates, and advanced metadata filtering.

### 25.4 Optical Character Recognition (OCR) Ingestion
Integrate `pytesseract` or AWS Textract into `parser.py` to extract text from scanned, image-only PDFs and embedded document charts.

---

## Chapter 26 — Multi-Environment Deployment

### 26.1 Local Sandbox Launch
Configure settings using `.env.example` as a template:
```bash
# Setup virtual environment
python -m venv venv
venv\Scripts\activate

# Install requirements & start backend
pip install -r backend/requirements.txt
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload

# Start frontend
cd frontend
npm install
npm run dev
```

### 26.2 Public Tunnel (ngrok / Localtunnel)
Expose your local development server to the internet using the provided PowerShell scripts (`start_ngrok.ps1` or `start_tunnel.ps1`), which configure tunnels to forward external traffic to ports 80 (Nginx) and 8000 (FastAPI).

### 26.3 Docker Container Orchestration
Build and run the entire multi-container service stack using docker-compose:
```bash
docker-compose up --build -d
```
Docker mounts a persistent volume `backend-data` to preserve the SQLite database and FAISS indexes across container updates.

---

## Chapter 27 — Executive Presentation Kit

Use these templates to present the project to different stakeholders:

### 27.1 The 2-Minute Elevator Pitch
> "Our platform is a self-contained AI search engine. It automatically crawls website documentation, crawls YouTube video transcripts, and parses PDF/DOCX manuals. It indexes this data locally using a high-speed similarity index. When a user asks a question, it retrieves the most relevant document chunks and uses an LLM to generate an answer. All vector computations run locally on CPU, ensuring data privacy and zero cloud embedding costs."

### 27.2 Resume Description
- Designed and built a full-stack RAG (Retrieval-Augmented Generation) chatbot platform using FastAPI and React (Vite) + Tailwind CSS.
- Built an asynchronous web crawler with BeautifulSoup and robots.txt checks, and a document parser for PDF, DOCX, TXT, and Markdown files.
- Implemented a hybrid search engine combining local FAISS similarity search with exact keyword matching using Reciprocal Rank Fusion (RRF).
- Added fallback audio transcription using `yt-dlp` and Gemini/OpenAI Whisper APIs to process YouTube URLs without native captions.
- Containerized the system using Docker and Nginx reverse proxies, and added browser-native Web Speech API integrations for voice control.

---

## Glossary of Technical Terms
- **RAG**: Retrieval-Augmented Generation; supplying an LLM with external context matching a query to answer questions accurately.
- **Embedding**: A numerical vector representing the semantic meaning of text.
- **FAISS**: Facebook AI Similarity Search; an optimized C++ library for vector search.
- **RRF**: Reciprocal Rank Fusion; an algorithm that combines rankings from multiple search engines.
- **BFS**: Breadth-First Search; a graph traversal algorithm used here to crawl website links level-by-level.
- **JWT**: JSON Web Token; a signed JSON object used for stateless authentication.
- **ASGI**: Asynchronous Server Gateway Interface; a standard for asynchronous Python web servers like Uvicorn.
- **Whisper**: OpenAI's open-source speech-to-text model.

---

## Final Project Summary

### The 30-Second Summary
This project is a full-stack, local-first RAG application that ingests website URLs, uploaded documents, and YouTube videos to build a custom AI chatbot. It uses local sentence-transformer embeddings and a FAISS index to run hybrid searches (semantic + keyword matching) entirely offline. Grounded context is passed to cloud LLMs (OpenAI, Gemini, Grok) to generate accurate answers with citations, managed via a responsive React analytics dashboard.


