import os
import uuid
import time
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks, File, UploadFile, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from collections import defaultdict

from backend.config import settings, UPLOADS_DIR
from backend.database import (
    create_user,
    get_user_by_username,
    create_project,
    get_projects,
    get_project,
    delete_project,
    get_indexed_pages,
    get_crawler_status,
    create_chat_session,
    get_chat_sessions,
    get_chat_messages,
    get_dashboard_stats
)
from backend.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user
)
from backend.crawler import crawl_and_index_website
from backend.parser import process_uploaded_file
from backend.rag_pipeline import query_rag_pipeline
from backend.export import export_chat_session
from backend.vector_store import delete_vector_index

app = FastAPI(title="RAG Website Chatbot API", version="1.0.0")

# CORS Middleware Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict to frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- RATE LIMITER MIDDLEWARE ---
ip_rate_limits = defaultdict(list)

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Retrieve client IP
    client_ip = request.client.host if request.client else "unknown"
    current_time = time.time()
    
    # Keep only requests within the last 60 seconds
    ip_rate_limits[client_ip] = [t for t in ip_rate_limits[client_ip] if current_time - t < 60]
    
    # Set limit to 60 requests per minute
    if len(ip_rate_limits[client_ip]) >= 60:
        return Response(
            content="Rate limit exceeded. Maximum 60 requests per minute.",
            status_code=status.HTTP_429_TOO_MANY_REQUESTS
        )
        
    ip_rate_limits[client_ip].append(current_time)
    response = await call_next(request)
    return response

# --- PYDANTIC MODEL SCHEMAS ---

class UserAuthSchema(BaseModel):
    username: str
    password: str

class ProjectCreateSchema(BaseModel):
    name: str
    url: Optional[str] = None
    crawl_depth: Optional[int] = 1
    max_pages: Optional[int] = 20

class ProjectCrawlSchema(BaseModel):
    url: str
    crawl_depth: Optional[int] = 1
    max_pages: Optional[int] = 20

class QueryRequestSchema(BaseModel):
    query: str
    category_filter: Optional[str] = None # 'faq', 'blog', 'documentation', 'tables', None

class SettingsUpdateSchema(BaseModel):
    openai_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    grok_api_key: Optional[str] = None
    grok_model: Optional[str] = None
    chunk_size: Optional[int] = None
    chunk_overlap: Optional[int] = None
    top_k: Optional[int] = None
    temperature: Optional[float] = None
    max_crawl_depth: Optional[int] = None
    max_pages: Optional[int] = None

# --- AUTH ENDPOINTS ---

@app.post("/api/auth/register")
def register(user_data: UserAuthSchema):
    if not user_data.username or not user_data.password:
        raise HTTPException(status_code=400, detail="Username and password required.")
        
    password_hash = get_password_hash(user_data.password)
    user_id = create_user(user_data.username, password_hash)
    if not user_id:
        raise HTTPException(status_code=400, detail="Username already exists.")
        
    return {"message": "User registered successfully", "user_id": user_id}

@app.post("/api/auth/login")
def login(user_data: UserAuthSchema):
    user = get_user_by_username(user_data.username)
    if not user or not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect username or password.")
        
    access_token = create_access_token(data={"sub": user["username"], "id": user["id"]})
    return {"access_token": access_token, "token_type": "bearer", "username": user["username"]}

@app.get("/api/auth/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return {"id": current_user["id"], "username": current_user["username"]}

# --- PROJECT ENDPOINTS ---

@app.post("/api/projects")
def add_project(
    project_data: ProjectCreateSchema,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    project_id = create_project(
        user_id=current_user["id"],
        name=project_data.name,
        url=project_data.url,
        crawl_depth=project_data.crawl_depth,
        max_pages=project_data.max_pages
    )
    
    # If a URL is provided, start asynchronous crawler background indexing
    if project_data.url:
        background_tasks.add_task(
            crawl_and_index_website,
            project_id=project_id,
            base_url=project_data.url,
            max_depth=project_data.crawl_depth,
            max_pages=project_data.max_pages
        )
        
    return {"message": "Project created successfully", "project_id": project_id}

@app.get("/api/projects")
def list_projects(current_user: dict = Depends(get_current_user)):
    return get_projects(current_user["id"])

@app.get("/api/projects/{project_id}")
def get_project_details(project_id: int, current_user: dict = Depends(get_current_user)):
    project = get_project(project_id)
    if not project or project["user_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@app.delete("/api/projects/{project_id}")
def remove_project(project_id: int, current_user: dict = Depends(get_current_user)):
    project = get_project(project_id)
    if not project or project["user_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Delete database references
    delete_project(project_id)
    # Delete vector index files
    delete_vector_index(project_id)
    
    return {"message": "Project and indices deleted successfully"}

@app.post("/api/projects/{project_id}/crawl")
def append_project_url(
    project_id: int,
    crawl_data: ProjectCrawlSchema,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    project = get_project(project_id)
    if not project or project["user_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Reset crawler status to pending/crawling for this project
    from backend.database import get_db_connection
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE crawler_status SET status = 'pending', error_message = '' WHERE project_id = ?", (project_id,))
    conn.commit()
    conn.close()

    background_tasks.add_task(
        crawl_and_index_website,
        project_id=project_id,
        base_url=crawl_data.url,
        max_depth=crawl_data.crawl_depth,
        max_pages=crawl_data.max_pages
    )
    
    return {"message": "Crawl queued successfully", "project_id": project_id}

@app.get("/api/projects/{project_id}/status")
def check_crawler_status(project_id: int, current_user: dict = Depends(get_current_user)):
    project = get_project(project_id)
    if not project or project["user_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Project not found")
        
    status_info = get_crawler_status(project_id)
    if not status_info:
        return {"status": "none"}
        
    return status_info

@app.get("/api/projects/{project_id}/pages")
def check_indexed_pages(project_id: int, current_user: dict = Depends(get_current_user)):
    project = get_project(project_id)
    if not project or project["user_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Project not found")
        
    return get_indexed_pages(project_id)

# --- UPLOAD DOCUMENT ROUTE ---

@app.post("/api/projects/{project_id}/upload")
async def upload_document(
    project_id: int,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    project = get_project(project_id)
    if not project or project["user_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Check extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".pdf", ".docx", ".doc", ".txt", ".md"):
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload PDF, DOCX, TXT, or MD.")
        
    # Save file locally inside uploads directory
    safe_filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = UPLOADS_DIR / safe_filename
    
    try:
        with open(file_path, "wb") as f:
            f.write(await file.read())
            
        # Parse and Index document
        result = process_uploaded_file(
            project_id=project_id,
            file_path=str(file_path),
            filename=file.filename
        )
        
        if not result["success"]:
            raise HTTPException(status_code=500, detail=result.get("error", "Failed to parse file."))
            
        return result
        
    except Exception as e:
        # Clean file on exception
        if file_path.exists():
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"File upload processing failed: {str(e)}")

# --- CHAT SESSION ROUTES ---

@app.post("/api/projects/{project_id}/sessions")
def create_session(project_id: int, current_user: dict = Depends(get_current_user)):
    project = get_project(project_id)
    if not project or project["user_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Project not found")
        
    session_id = str(uuid.uuid4())
    title = f"Chat session - {time.strftime('%Y-%m-%d %H:%M:%S')}"
    create_chat_session(session_id, project_id, current_user["id"], title)
    return {"session_id": session_id, "title": title}

@app.get("/api/projects/{project_id}/sessions")
def list_sessions(project_id: int, current_user: dict = Depends(get_current_user)):
    project = get_project(project_id)
    if not project or project["user_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Project not found")
        
    return get_chat_sessions(project_id, current_user["id"])

@app.get("/api/sessions/{session_id}/messages")
def get_session_messages(session_id: str, current_user: dict = Depends(get_current_user)):
    # Chat session validation
    from backend.database import get_chat_session
    session = get_chat_session(session_id)
    if not session or session["user_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Chat session not found")
    # Retrieve messages
    return get_chat_messages(session_id)

@app.post("/api/sessions/{session_id}/ask")
async def ask_question(
    session_id: str,
    payload: QueryRequestSchema,
    current_user: dict = Depends(get_current_user)
):
    # Verify session and extract project details
    from backend.database import get_chat_session
    session = get_chat_session(session_id)
    if not session or session["user_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Chat session not found")
        
    project_id = session["project_id"]
    
    # Run query rag pipeline
    response = await query_rag_pipeline(
        user_id=current_user["id"],
        project_id=project_id,
        session_id=session_id,
        query=payload.query,
        category_filter=payload.category_filter
    )
    
    return response

# --- EXPORT CONVERSATION ENDPOINT ---

@app.get("/api/sessions/{session_id}/export")
def export_chat(
    session_id: str,
    format: str = Query("json", pattern="^(json|csv|markdown|pdf)$"),
    token: str = Query(...)
):
    """
    Export chat session conversation to requested format.
    Validates token via query parameter since browser download links don't support custom headers.
    """
    from backend.auth import get_current_user
    try:
        current_user = get_current_user(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Authentication failed.")
        
    # Verify session ownership
    from backend.database import get_chat_session
    session = get_chat_session(session_id)
    if not session or session["user_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Chat session not found")
        
    content, filename, content_type = export_chat_session(session_id, format)
    
    return Response(
        content=content,
        media_type=content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

# --- SETTINGS ENDPOINTS ---

@app.get("/api/settings")
def get_settings(current_user: dict = Depends(get_current_user)):
    # Mask API Keys for security representation
    def mask_key(k: str) -> str:
        return f"{k[:4]}...{k[-4:]}" if len(k) > 8 else ("Configured" if k else "")
        
    return {
        "openai_api_key_masked": mask_key(settings.openai_api_key),
        "gemini_api_key_masked": mask_key(settings.gemini_api_key),
        "grok_api_key_masked": mask_key(settings.grok_api_key),
        "grok_model": settings.grok_model,
        "openai_key_configured": bool(settings.openai_api_key),
        "gemini_key_configured": bool(settings.gemini_api_key),
        "grok_key_configured": bool(settings.grok_api_key),
        "chunk_size": settings.chunk_size,
        "chunk_overlap": settings.chunk_overlap,
        "top_k": settings.top_k,
        "temperature": settings.temperature,
        "max_crawl_depth": settings.max_crawl_depth,
        "max_pages": settings.max_pages
    }

@app.post("/api/settings")
def update_settings(payload: SettingsUpdateSchema, current_user: dict = Depends(get_current_user)):
    updates = {}
    
    # Only update keys if a new key is sent (non-masked value)
    if payload.openai_api_key is not None and not payload.openai_api_key.startswith("..."):
        updates["openai_api_key"] = payload.openai_api_key
    if payload.gemini_api_key is not None and not payload.gemini_api_key.startswith("..."):
        updates["gemini_api_key"] = payload.gemini_api_key
    if payload.grok_api_key is not None and not payload.grok_api_key.startswith("..."):
        updates["grok_api_key"] = payload.grok_api_key
    if payload.grok_model is not None:
        updates["grok_model"] = payload.grok_model
        
    if payload.chunk_size is not None: updates["chunk_size"] = payload.chunk_size
    if payload.chunk_overlap is not None: updates["chunk_overlap"] = payload.chunk_overlap
    if payload.top_k is not None: updates["top_k"] = payload.top_k
    if payload.temperature is not None: updates["temperature"] = payload.temperature
    if payload.max_crawl_depth is not None: updates["max_crawl_depth"] = payload.max_crawl_depth
    if payload.max_pages is not None: updates["max_pages"] = payload.max_pages
    
    settings.update(updates)
    return {"message": "Settings updated successfully"}

# --- DASHBOARD METRICS ENDPOINT ---

@app.get("/api/dashboard/stats")
def dashboard_stats(current_user: dict = Depends(get_current_user)):
    return get_dashboard_stats(current_user["id"])

# --- SERVE FRONTEND STATIC FILES ---
FRONTEND_DIST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
if os.path.exists(FRONTEND_DIST_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST_DIR, html=True), name="static")
