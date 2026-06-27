import sqlite3
import json
from backend.config import DATA_DIR

DB_PATH = DATA_DIR / "rag_chatbot.db"

def get_db_connection():
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # 2. Projects table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        url TEXT,
        crawl_depth INTEGER DEFAULT 1,
        max_pages INTEGER DEFAULT 20,
        indexed_pages_count INTEGER DEFAULT 0,
        chunks_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
    """)
    
    # 3. Indexed Pages table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS indexed_pages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        url TEXT NOT NULL,
        title TEXT,
        chunk_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
    )
    """)
    
    # 4. Chat Sessions table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        project_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
    """)
    
    # 5. Chat Messages table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        sources TEXT, -- JSON string representing source list
        confidence REAL,
        response_time REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES chat_sessions (id) ON DELETE CASCADE
    )
    """)
    
    # 6. Crawler Status table (Live tracking of background crawl jobs)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS crawler_status (
        project_id INTEGER PRIMARY KEY,
        status TEXT DEFAULT 'pending', -- 'pending', 'crawling', 'completed', 'failed'
        pages_crawled INTEGER DEFAULT 0,
        chunks_created INTEGER DEFAULT 0,
        current_url TEXT DEFAULT '',
        estimated_remaining_seconds INTEGER DEFAULT 0,
        error_message TEXT DEFAULT '',
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
    )
    """)
    
    # 7. Queries Stats table (for metrics dashboards)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS query_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        project_id INTEGER NOT NULL,
        query TEXT NOT NULL,
        response_time REAL NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
    )
    """)
    
    # --- Performance Optimization Indexes ---
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects (user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_indexed_pages_project_id ON indexed_pages (project_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_chat_sessions_project_user ON chat_sessions (project_id, user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages (session_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_query_stats_user_id ON query_stats (user_id)")
    
    conn.commit()
    conn.close()

# Initialize database on module load
init_db()

# --- HELPER DATABASE CRUD OPERATIONS ---

# User Ops
def create_user(username, password_hash):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", (username, password_hash))
        conn.commit()
        user_id = cursor.lastrowid
        return user_id
    except sqlite3.IntegrityError:
        return None
    finally:
        conn.close()

def get_user_by_username(username):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

# Project Ops
def create_project(user_id, name, url, crawl_depth, max_pages):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO projects (user_id, name, url, crawl_depth, max_pages) VALUES (?, ?, ?, ?, ?)",
        (user_id, name, url, crawl_depth, max_pages)
    )
    conn.commit()
    project_id = cursor.lastrowid
    # Create matching crawler_status
    cursor.execute("INSERT OR REPLACE INTO crawler_status (project_id) VALUES (?)", (project_id,))
    conn.commit()
    conn.close()
    return project_id

def get_projects(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC", (user_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_project(project_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def update_project_stats(project_id, pages_count, chunks_count):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE projects SET indexed_pages_count = ?, chunks_count = ? WHERE id = ?",
        (pages_count, chunks_count, project_id)
    )
    conn.commit()
    conn.close()

def delete_project(project_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    conn.commit()
    conn.close()
    return True

# Page Ops
def add_indexed_page(project_id, url, title, chunk_count):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO indexed_pages (project_id, url, title, chunk_count) VALUES (?, ?, ?, ?)",
        (project_id, url, title, chunk_count)
    )
    conn.commit()
    page_id = cursor.lastrowid
    conn.close()
    return page_id

def get_indexed_pages(project_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM indexed_pages WHERE project_id = ? ORDER BY created_at ASC", (project_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

# Crawler Status Ops
def update_crawler_status(project_id, status=None, pages_crawled=None, chunks_created=None, current_url=None, remaining=None, error=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    updates = []
    params = []
    if status is not None:
        updates.append("status = ?")
        params.append(status)
    if pages_crawled is not None:
        updates.append("pages_crawled = ?")
        params.append(pages_crawled)
    if chunks_created is not None:
        updates.append("chunks_created = ?")
        params.append(chunks_created)
    if current_url is not None:
        updates.append("current_url = ?")
        params.append(current_url)
    if remaining is not None:
        updates.append("estimated_remaining_seconds = ?")
        params.append(remaining)
    if error is not None:
        updates.append("error_message = ?")
        params.append(error)
        
    if updates:
        params.append(project_id)
        query = f"UPDATE crawler_status SET {', '.join(updates)} WHERE project_id = ?"
        cursor.execute(query, tuple(params))
        conn.commit()
    conn.close()

def get_crawler_status(project_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM crawler_status WHERE project_id = ?", (project_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

# Chat Session Ops
def create_chat_session(session_id, project_id, user_id, title):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO chat_sessions (id, project_id, user_id, title) VALUES (?, ?, ?, ?)",
        (session_id, project_id, user_id, title)
    )
    conn.commit()
    conn.close()

def get_chat_sessions(project_id, user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM chat_sessions WHERE project_id = ? AND user_id = ? ORDER BY created_at DESC",
        (project_id, user_id)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_chat_session(session_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM chat_sessions WHERE id = ?", (session_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

# Message Ops
def add_chat_message(session_id, role, content, sources=None, confidence=None, response_time=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    sources_str = json.dumps(sources) if sources else None
    cursor.execute(
        "INSERT INTO chat_messages (session_id, role, content, sources, confidence, response_time) VALUES (?, ?, ?, ?, ?, ?)",
        (session_id, role, content, sources_str, confidence, response_time)
    )
    conn.commit()
    msg_id = cursor.lastrowid
    conn.close()
    return msg_id

def get_chat_messages(session_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC", (session_id,))
    rows = cursor.fetchall()
    conn.close()
    
    messages = []
    for r in rows:
        d = dict(r)
        if d.get("sources"):
            d["sources"] = json.loads(d["sources"])
        else:
            d["sources"] = []
        messages.append(d)
    return messages

# Dashboard / Stats Ops
def log_query_stat(user_id, project_id, query, response_time):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO query_stats (user_id, project_id, query, response_time) VALUES (?, ?, ?, ?)",
        (user_id, project_id, query, response_time)
    )
    conn.commit()
    conn.close()

def get_dashboard_stats(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # KPIs
    cursor.execute("SELECT COUNT(*) FROM projects WHERE user_id = ?", (user_id,))
    total_websites = cursor.fetchone()[0]
    
    cursor.execute("""
    SELECT IFNULL(SUM(indexed_pages_count), 0), IFNULL(SUM(chunks_count), 0) 
    FROM projects WHERE user_id = ?
    """, (user_id,))
    row = cursor.fetchone()
    total_pages = row[0]
    total_chunks = row[1]
    
    cursor.execute("SELECT COUNT(*) FROM query_stats WHERE user_id = ?", (user_id,))
    total_questions = cursor.fetchone()[0]
    
    cursor.execute("SELECT IFNULL(AVG(response_time), 0) FROM query_stats WHERE user_id = ?", (user_id,))
    avg_response_time = round(cursor.fetchone()[0], 2)
    
    # Calculate file size of FAISS indices dynamically or just give SQLite database size
    db_size_kb = 0
    if DB_PATH.exists():
        db_size_kb = DB_PATH.stat().st_size / 1024
        
    stats = {
        "total_websites": total_websites,
        "total_pages": total_pages,
        "total_chunks": total_chunks,
        "total_questions": total_questions,
        "avg_response_time": avg_response_time,
        "vector_size_kb": round(db_size_kb, 2)
    }
    
    # Queries per day (last 7 days)
    cursor.execute("""
    SELECT DATE(created_at) as date, COUNT(*) as count 
    FROM query_stats 
    WHERE user_id = ? AND created_at >= date('now', '-7 days')
    GROUP BY date
    ORDER BY date ASC
    """, (user_id,))
    queries_per_day = [dict(r) for r in cursor.fetchall()]
    stats["queries_per_day"] = queries_per_day
    
    # Response times (last 7 queries)
    cursor.execute("""
    SELECT query, response_time, created_at 
    FROM query_stats 
    WHERE user_id = ? 
    ORDER BY created_at DESC LIMIT 7
    """, (user_id,))
    recent_response_times = [dict(r) for r in cursor.fetchall()]
    recent_response_times.reverse()
    stats["recent_response_times"] = recent_response_times
    
    # Most asked questions (top 5)
    cursor.execute("""
    SELECT query, COUNT(*) as count 
    FROM query_stats 
    WHERE user_id = ? 
    GROUP BY query 
    ORDER BY count DESC LIMIT 5
    """, (user_id,))
    most_asked = [dict(r) for r in cursor.fetchall()]
    stats["most_asked"] = most_asked
    
    conn.close()
    return stats
