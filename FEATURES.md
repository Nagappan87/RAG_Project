# Project Features Guide

This document lists all features implemented in the **RAG Website Chatbot** platform, detailing how they work, the specific files that implement them, and why they are useful.

---

## 1. Recursive Website Crawling
*   **What it does**: Automatically crawls pages of a website starting from a seed URL, traversing links recursively.
*   **How it works**: Uses an asynchronous BFS queue. It respects `robots.txt`, avoids duplicates with a visited set, parses pages up to a configured `max_pages` or `crawl_depth`, cleans the HTML, and extracts text paragraphs, headings, lists, and tables.
*   **Implementing files**:
    *   [backend/crawler.py](file:///c:/Users/Nagappan%20SP/rag/backend/crawler.py) (crawling queue, robots.txt, BFS crawler)
    *   [backend/database.py](file:///c:/Users/Nagappan%20SP/rag/backend/database.py) (logs crawled pages, tracking statistics)
*   **Why it is useful**: Enables bulk-indexing an entire documentation site or blog with a single URL entry, bypassing manual page-by-page copying.

---

## 2. Multi-Format Document Ingestion
*   **What it does**: Parses and processes uploaded documents including PDF, DOCX, TXT, and MD files.
*   **How it works**: Identifies files by extension, extracts raw text layers (using `pypdf` or `docx2txt`), chunks text blocks, generates vectors, and adds them to the project's vector store.
*   **Implementing files**:
    *   [backend/parser.py](file:///c:/Users/Nagappan%20SP/rag/backend/parser.py) (file parsers and chunking routines)
    *   [backend/main.py](file:///c:/Users/Nagappan%20SP/rag/backend/main.py) (upload file routing and storage)
*   **Why it is useful**: Allows users to supplement crawled website data with local user manuals, agreements, or transcripts.

---

## 3. YouTube Transcript Ingestion & Audio Transcription
*   **What it does**: Ingests YouTube video URLs and processes them for the RAG chatbot.
*   **How it works**: Checks if a URL is a YouTube link, parses the video ID, and attempts to fetch transcripts. If transcripts are missing or disabled, it downloads the video audio stream using `yt-dlp` and runs audio transcription through Gemini/OpenAI/Grok Whisper APIs.
*   **Implementing files**:
    *   [backend/crawler.py](file:///c:/Users/Nagappan%20SP/rag/backend/crawler.py) (YouTube regex extraction, audio downloading, STT transcription)
*   **Why it is useful**: Lets users query the contents of lectures, tutorials, or video guides.

---

## 4. Hybrid Search Engine with Reciprocal Rank Fusion (RRF)
*   **What it does**: Combines lexical search and semantic similarity search to return the most relevant document chunks.
*   **How it works**: Runs a dense similarity search using local FAISS indexes, while concurrently calculating keyword matches. It merges both search results using the RRF formula: `Score = 1 / (60 + Rank)`.
*   **Implementing files**:
    *   [backend/vector_store.py](file:///c:/Users/Nagappan%20SP/rag/backend/vector_store.py) (keyword matches, FAISS vector distance checks, RRF fusion)
*   **Why it is useful**: Ensures high precision search. Lexical search matches exact terms (product names, codes), while semantic search matches general concepts.

---

## 5. Persistent Relational Database (SQLite)
*   **What it does**: Stores user accounts, projects, crawled URLs, chat logs, and usage telemetry.
*   **How it works**: Connects to `rag_chatbot.db` using Python's built-in `sqlite3` module, managing tables for transactional records and telemetry logs.
*   **Implementing files**:
    *   [backend/database.py](file:///c:/Users/Nagappan%20SP/rag/backend/database.py) (DB creation, queries, stats loggers)
*   **Why it is useful**: Keeps chat sessions persistent, saves crawled pages, and maintains usage dashboard data even after application restarts.

---

## 6. Token-Based Authentication (JWT)
*   **What it does**: Protects endpoints, allowing users to register, log in, and secure their chats.
*   **How it works**: Hashes passwords with `bcrypt` before storage. Generates signed JSON Web Tokens (JWT) using `HS256` keys. Secure FastAPI dependencies authenticate endpoints using authorization headers.
*   **Implementing files**:
    *   [backend/auth.py](file:///c:/Users/Nagappan%20SP/rag/backend/auth.py) (password hashing and token validation)
    *   [backend/main.py](file:///c:/Users/Nagappan%20SP/rag/backend/main.py) (register, login, and auth route handlers)
*   **Why it is useful**: Prevents unauthorized access to proprietary document collections or chat histories.

---

## 7. Conversational Chat Memory
*   **What it does**: Maintains chat history, enabling follow-up questions.
*   **How it works**: Retrieves the last 6 messages of the active chat session from SQLite and passes them to the LLM prompt, keeping context unified.
*   **Implementing files**:
    *   [backend/rag_pipeline.py](file:///c:/Users/Nagappan%20SP/rag/backend/rag_pipeline.py) (loads messages, formats System/Human/AI prompts)
*   **Why it is useful**: Simulates natural human-to-AI conversation, letting users ask follow-up questions without repeating context.

---

## 8. Exporting Chat Conversations
*   **What it does**: Exists as an export drawer allowing download of the entire chat history in JSON, CSV, Markdown, or PDF formats.
*   **How it works**: Formats SQLite records into structure-based files. Incorporates a custom PDF generation algorithm using basic stream instructions to render text blocks without external PDF libraries.
*   **Implementing files**:
    *   [backend/export.py](file:///c:/Users/Nagappan%20SP/rag/backend/export.py) (CSV, MD, PDF encoders)
    *   [backend/main.py](file:///c:/Users/Nagappan%20SP/rag/backend/main.py) (serves download streams)
*   **Why it is useful**: Allows users to save, share, or document chatbot answers.

---

## 9. Glassmorphic React UI (Dark/Light Mode)
*   **What it does**: Displays pages for Auth, Home, Chat, Analytics, and Settings with CSS-based glassmorphism tokens.
*   **How it works**: Incorporates Tailwind CSS with custom background filters and keyframe animations. Supports light and dark mode toggling.
*   **Implementing files**:
    *   [frontend/src/index.css](file:///c:/Users/Nagappan%20SP/rag/frontend/index.css) (CSS layout tokens, glassmorphic card classes)
    *   [frontend/src/App.jsx](file:///c:/Users/Nagappan%20SP/rag/frontend/src/App.jsx) (routing, layout structure, theme providers)
*   **Why it is useful**: Provides a premium UI design that is highly engaging and clean.

---

## 10. Admin Telemetry & Analytics Dashboard
*   **What it does**: Renders usage statistics and charts showing system load, query times, confidence scores, and crawling summaries.
*   **How it works**: Queries metrics from SQLite, groups them by day, and displays them using responsive charts powered by `Recharts`.
*   **Implementing files**:
    *   [frontend/src/pages/Dashboard.jsx](file:///c:/Users/Nagappan%20SP/rag/frontend/src/pages/Dashboard.jsx) (rendering analytics, loading data)
    *   [backend/database.py](file:///c:/Users/Nagappan%20SP/rag/backend/database.py) (aggregate query executions)
*   **Why it is useful**: Allows admins to monitor system performance, check average LLM response latency, and track usage trends.
