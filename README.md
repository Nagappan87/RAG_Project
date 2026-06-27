# RAG Website Chatbot

A production-ready, highly modular Retrieval-Augmented Generation (RAG) platform to scrape, index, and query website content or document uploads using local semantic embeddings and LLMs (OpenAI / Gemini / Grok).

Built with a high-fidelity glassmorphic Dark/Light themed React UI and a fully decoupled FastAPI backend.

---

## 🌟 Features
*   **Recursive Website Crawling**: Crawl internal website links recursively based on max pages and crawl depth constraints.
*   **Document Ingestion**: Seamless parser support for PDF, DOCX, TXT, and Markdown files.
*   **YouTube Transcript Processing**: Automatic caption scraping or speech-to-text audio transcript generation using LLM APIs.
*   **Hybrid RRF Search Engine**: Combines keyword search (lexical) and semantic vector search using Reciprocal Rank Fusion (RRF).
*   **Persistent SQLite DB**: Track user registration, active projects, chatbot chat histories, crawler statuses, and dashboard metrics.
*   **Local Embedding Processing**: Generates embeddings locally using `all-MiniLM-L6-v2` via HuggingFace Sentence Transformers.

---

## 📂 Project Directory Structure
```
rag/
├── backend/
│   ├── main.py           # FastAPI routing, middleware, and entry points
│   ├── config.py         # Dynamic environment and settings loader
│   ├── auth.py           # JWT encryption and verification dependency
│   ├── database.py       # SQLite connection pools, schemas, and metrics logs
│   ├── crawler.py        # Web crawler, YouTube scraper, and transcription routines
│   ├── parser.py         # File ingestion splitters (PDF, DOCX, TXT, MD)
│   ├── vector_store.py   # Embedding loader and Hybrid RRF search algorithms
│   ├── rag_pipeline.py   # Conversation memory context builder and prompt controller
│   ├── export.py         # Markdown, CSV, JSON, and PDF conversation exporters
│   ├── Dockerfile        # Container recipe for backend uvicorn service
│   └── requirements.txt  # Declared Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx       # Global application container and routing
│   │   ├── index.css     # Styling, theme declarations, glassmorphism tokens
│   │   ├── utils/
│   │   │   └── api.js    # Decoupled Axios API query client
│   │   └── pages/
│   │       ├── AuthPage.jsx   # Register / Log in views
│   │       ├── Home.jsx       # Projects, crawler triggers, and drag-and-drop dropzone
│   │       ├── Chat.jsx       # Chat window with dynamic citations, voice synthesis
│   │       ├── Dashboard.jsx  # Recharts usage graphs and KPI metrics
│   │       └── Settings.jsx   # Model choice sliders, parameter tuners, API key inputs
│   ├── package.json
│   ├── vite.config.js     # React compilation, hot-reload, and proxy mappings
│   ├── nginx.conf         # Serving production React assets and proxying API
│   └── Dockerfile         # Nginx production build pipeline
│
├── docker-compose.yml     # Service orchestration configuration
├── .env.example           # Reference environment variables template
├── .env                   # Local active environment variables (Ignored by git)
└── README.md              # Project documentation file
```

---

## 💻 Tech Stack
*   **Frontend**: React (Vite), React Router v6, Tailwind CSS, Recharts, Framer Motion, Lucide Icons, Browser Web Speech API.
*   **Backend**: FastAPI (Python 3.10+), FAISS, HuggingFace Sentence Transformers, LangChain, BeautifulSoup4, SQLite.
*   **DevOps & Server**: Docker, Docker Compose, Nginx.

---

## 🛠️ Installation & Getting Started

### Prerequisites
*   Python 3.10+
*   Node.js 18+
*   Docker & Docker Compose (Optional for container launch)

### Setup Configurations
1. Clone or download the project workspace directory.
2. In the root directory, create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```
3. Set your custom `JWT_SECRET` key. (You can also input your `OPENAI_API_KEY` or `GEMINI_API_KEY` directly here or configure it later inside the UI Settings page).

---

## 🚀 Running the Project

### Method A: Running via Docker (Recommended & Easiest)
Spin up the entire stack with a single command:
```bash
docker-compose up --build
```
*   **App UI Address**: `http://localhost` (Nginx proxy)
*   **Backend Swagger API Docs**: `http://localhost:8000/docs`
*   **Volumes**: Database and indexing indexes are saved locally in the `backend-data` docker volume.

### Method B: Running Locally (For Active Development)

#### 1. Boot backend:
```bash
python -m venv venv
# On Windows PowerShell:
.\venv\Scripts\Activate.ps1
# On Linux/macOS:
source venv/bin/activate

# Install libraries
pip install -r backend/requirements.txt

# Start FastAPI
uvicorn backend.main:app --reload --port 8000
```

#### 2. Boot frontend:
Open a separate terminal window:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser. The Vite server will proxy all `/api` traffic automatically to the FastAPI server running on port `8000`.

---

## ☁️ Deployment Steps (Production/Cloud)

The application is fully cloud-ready and has zero hardcoded dependencies on localhost.

### Option 1: Unified Cloud Build (Render/Railway/Heroku)
You can deploy the project as a single container or service:
1. Run `npm run build` inside `frontend/` to generate static React assets in `frontend/dist`.
2. Deploy the root repository pointing the startup command to:
   ```bash
   uvicorn backend.main:app --host 0.0.0.0 --port $PORT
   ```
3. The FastAPI app automatically detects the `frontend/dist` directory and mounts it to serve the UI assets directly.
4. Mount a persistent disk volume to the path specified in your `DATA_DIR` environment variable (e.g., `/app/data`) to prevent losing your index files and SQLite database on deploy updates.

---

## ⚙️ Environment Variables
| Variable Name | Default Value | Description |
|---|---|---|
| `PORT` | `8000` | Port uvicorn binds to |
| `HOST` | `0.0.0.0` | Host interface uvicorn binds to |
| `JWT_SECRET` | `replace_with_a_secure_random_string` | HMAC secret key used to sign Auth tokens |
| `JWT_ALGORITHM` | `HS256` | JWT hash algorithm |
| `OPENAI_API_KEY` | *(Empty)* | OpenAI API credentials |
| `GEMINI_API_KEY` | *(Empty)* | Google Gemini API credentials |
| `DATA_DIR` | `./data` | Parent storage directory |
| `FAISS_DIR` | `./data/faiss` | Vector indexes folder |
| `UPLOADS_DIR` | `./data/uploads` | PDF/docx raw assets storage folder |

---

## 🔧 Troubleshooting & Limitations
*   **SQLite Locking**: If you deploy on serverless platforms (like AWS Lambda) that lack persistent disk support, SQLite database updates will fail or get wiped. Deploy on containers with mapped disks (Render/Railway standard web service).
*   **HuggingFace Models Download**: On the first craw/index trigger, the local embedder downloads `all-MiniLM-L6-v2` which takes around 120MB. Ensure your network allows downloading from HuggingFace (`huggingface.co`).
*   **Rate Limits**: The API is restricted to 60 requests per minute per IP to prevent DDoS. If you hit this rate limit, wait 60 seconds.
