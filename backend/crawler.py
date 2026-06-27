import httpx
import asyncio
import re
import traceback
from urllib.parse import urlparse, urljoin
from urllib.robotparser import RobotFileParser
from bs4 import BeautifulSoup
import bleach
from backend.database import (
    update_crawler_status,
    add_indexed_page,
    update_project_stats,
    get_project
)
from backend.config import settings, UPLOADS_DIR
from backend.vector_store import index_chunks

# Compile exclusion regex for extensions
EXCLUDE_EXTENSIONS = re.compile(
    r"\.(pdf|jpg|jpeg|png|gif|css|js|zip|mp4|avi|mov|mp3|wav|ogg|tar|gz|exe|dmg|svg|xml)$",
    re.IGNORECASE
)

from typing import Optional
from youtube_transcript_api import YouTubeTranscriptApi

# Helper to normalize URL
def normalize_url(url: str) -> str:
    parsed = urlparse(url)
    # Remove fragments
    return parsed._replace(fragment="").geturl()

def extract_youtube_video_id(url: str) -> Optional[str]:
    parsed = urlparse(url)
    if parsed.netloc in ('youtu.be', 'www.youtu.be'):
        return parsed.path.lstrip('/')
    if parsed.netloc in ('youtube.com', 'www.youtube.com', 'm.youtube.com'):
        if parsed.path == '/watch':
            from urllib.parse import parse_qs
            return parse_qs(parsed.query).get('v', [None])[0]
        if parsed.path.startswith(('/embed/', '/shorts/')):
            parts = parsed.path.split('/')
            if len(parts) > 2:
                return parts[2]
    return None

async def fetch_youtube_video_title(video_id: str) -> str:
    url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            res = await client.get(url)
            if res.status_code == 200:
                data = res.json()
                return data.get("title", f"YouTube Video {video_id}")
        except Exception:
            pass
    return f"YouTube Video {video_id}"

import os
from pathlib import Path
import uuid

def format_timestamp(seconds: float) -> str:
    sec = int(seconds)
    m, s = divmod(sec, 60)
    h, m = divmod(m, 60)
    return f"[{h:02d}:{m:02d}:{s:02d}]" if h > 0 else f"[{m:02d}:{s:02d}]"

def fetch_youtube_transcript(video_id: str) -> str:
    try:
        transcript_list = YouTubeTranscriptApi().list(video_id)
        try:
            transcript = transcript_list.find_transcript(['en'])
        except Exception:
            transcript = next(iter(transcript_list))
            
        snippets = transcript.fetch()
        formatted_lines = []
        for snippet in snippets:
            ts = format_timestamp(snippet.start)
            formatted_lines.append(f"{ts} {snippet.text.strip()}")
        full_text = "\n".join(formatted_lines)
        return full_text
    except Exception as e:
        raise Exception(f"Could not retrieve transcript: {str(e)}")

async def transcribe_audio_gemini(api_key: str, file_path: str) -> str:
    import google.generativeai as genai
    def _transcribe():
        genai.configure(api_key=api_key)
        audio_file = genai.upload_file(path=file_path)
        try:
            model = genai.GenerativeModel("gemini-1.5-flash")
            prompt = (
                "You are a professional audio transcriber.\n"
                "Transcribe this audio file exactly.\n"
                "Include timestamp markings at the beginning of each phrase or every 10-15 seconds in format [MM:SS] (e.g. [01:23] text...).\n"
                "Ensure the timestamps are accurate and align with the audio."
            )
            response = model.generate_content([audio_file, prompt])
            return response.text
        finally:
            audio_file.delete()
    return await asyncio.to_thread(_transcribe)

async def transcribe_audio_openai(api_key: str, file_path: str) -> str:
    url = "https://api.openai.com/v1/audio/transcriptions"
    headers = {"Authorization": f"Bearer {api_key}"}
    data = {
        "model": "whisper-1",
        "response_format": "verbose_json"
    }
    with open(file_path, "rb") as f:
        files = {"file": (os.path.basename(file_path), f, "audio/m4a")}
        async with httpx.AsyncClient(timeout=120.0) as client:
            res = await client.post(url, headers=headers, files=files, data=data)
    if res.status_code == 200:
        res_data = res.json()
        segments = res_data.get("segments", [])
        formatted = []
        for seg in segments:
            start_sec = int(seg["start"])
            m, s = divmod(start_sec, 60)
            h, m = divmod(m, 60)
            timestamp = f"[{h:02d}:{m:02d}:{s:02d}]" if h > 0 else f"[{m:02d}:{s:02d}]"
            formatted.append(f"{timestamp} {seg['text'].strip()}")
        return "\n".join(formatted)
    else:
        raise Exception(f"OpenAI Whisper API error: {res.status_code} - {res.text}")

async def transcribe_audio_groq(api_key: str, file_path: str) -> str:
    url = "https://api.groq.com/openai/v1/audio/transcriptions"
    headers = {"Authorization": f"Bearer {api_key}"}
    data = {
        "model": "whisper-large-v3",
        "response_format": "verbose_json"
    }
    with open(file_path, "rb") as f:
        files = {"file": (os.path.basename(file_path), f, "audio/m4a")}
        async with httpx.AsyncClient(timeout=120.0) as client:
            res = await client.post(url, headers=headers, files=files, data=data)
    if res.status_code == 200:
        res_data = res.json()
        segments = res_data.get("segments", [])
        formatted = []
        for seg in segments:
            start_sec = int(seg["start"])
            m, s = divmod(start_sec, 60)
            h, m = divmod(m, 60)
            timestamp = f"[{h:02d}:{m:02d}:{s:02d}]" if h > 0 else f"[{m:02d}:{s:02d}]"
            formatted.append(f"{timestamp} {seg['text'].strip()}")
        return "\n".join(formatted)
    else:
        raise Exception(f"Groq Whisper API error: {res.status_code} - {res.text}")

async def fetch_youtube_transcript_stt(video_id: str) -> str:
    temp_dir = Path(UPLOADS_DIR)
    temp_dir.mkdir(parents=True, exist_ok=True)
    temp_file_name = f"yt_audio_{uuid.uuid4()}.m4a"
    temp_file_path = temp_dir / temp_file_name
    
    def _download():
        import yt_dlp
        ydl_opts = {
            'format': 'm4a/bestaudio/best',
            'outtmpl': str(temp_file_path),
            'quiet': True,
            'no_warnings': True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([f'https://www.youtube.com/watch?v={video_id}'])
            
    try:
        await asyncio.to_thread(_download)
        
        # Resolve downloaded file (handles cases where yt-dlp appends .webm or other extension)
        actual_file_path = temp_file_path
        if not temp_file_path.exists():
            prefix = temp_file_path.name.replace(".m4a", "")
            matching_files = list(temp_dir.glob(f"{prefix}*"))
            if matching_files:
                actual_file_path = matching_files[0]
            else:
                raise Exception("Failed to download video audio stream.")
            
        if settings.gemini_api_key:
            return await transcribe_audio_gemini(settings.gemini_api_key, str(actual_file_path))
        elif settings.openai_api_key:
            return await transcribe_audio_openai(settings.openai_api_key, str(actual_file_path))
        elif settings.grok_api_key:
            return await transcribe_audio_groq(settings.grok_api_key, str(actual_file_path))
        else:
            raise Exception(
                "Video has no captions, and no Gemini, OpenAI, or Grok API key is configured to run audio transcription."
            )
    finally:
        # Clean up whatever file was actually created on disk
        if 'actual_file_path' in locals() and actual_file_path.exists():
            try:
                os.remove(actual_file_path)
            except Exception:
                pass
        elif temp_file_path.exists():
            try:
                os.remove(temp_file_path)
            except Exception:
                pass


# Check robots.txt
def is_allowed_by_robots(url: str, user_agent: str = "*") -> bool:
    try:
        parsed = urlparse(url)
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
        
        rp = RobotFileParser()
        rp.set_url(robots_url)
        # Fetch robots.txt with a brief timeout
        import urllib.request
        with urllib.request.urlopen(robots_url, timeout=3) as response:
            rp.parse(response.read().decode('utf-8').splitlines())
        return rp.can_fetch(user_agent, url)
    except Exception:
        # If robots.txt doesn't exist or times out, default to allowed
        return True

# HTML Cleaning and Structured Extraction
def extract_page_data(html_content: str, url: str) -> dict:
    soup = BeautifulSoup(html_content, "html.parser")
    
    # 1. Remove scripts, styles, forms, navigation
    for element in soup(["script", "style", "nav", "footer", "form", "iframe", "noscript"]):
        element.decompose()
        
    title = soup.title.string.strip() if soup.title else "Untitled Page"
    
    # Metadata extraction
    metadata = {}
    for meta in soup.find_all("meta"):
        name = meta.get("name") or meta.get("property")
        content = meta.get("content")
        if name and content:
            metadata[name.strip().lower()] = content.strip()
            
    # Heading hierarchy
    headings = []
    for h in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6"]):
        h_text = h.get_text().strip()
        if h_text:
            headings.append(f"{h.name}: {h_text}")
            
    # Text Extraction & Cleansing
    # Convert tables to Markdown or text blocks
    tables = []
    for table in soup.find_all("table"):
        table_text = []
        for row in table.find_all("tr"):
            cells = [c.get_text().strip() for c in row.find_all(["td", "th"])]
            if cells:
                table_text.append(" | ".join(cells))
        if table_text:
            tables.append("\n".join(table_text))
            table.decompose() # Remove table from body text to prevent double extraction
            
    # List extraction
    lists = []
    for lst in soup.find_all(["ul", "ol"]):
        list_items = [li.get_text().strip() for li in lst.find_all("li") if li.get_text().strip()]
        if list_items:
            lists.append("\n".join([f"- {item}" for item in list_items]))
        lst.decompose()
        
    # Main body paragraphs
    paragraphs = []
    for p in soup.find_all("p"):
        p_text = p.get_text().strip()
        if p_text:
            paragraphs.append(p_text)
            
    # Clean fallback text if body is empty
    fallback_text = soup.get_text()
    cleaned_fallback = bleach.clean(fallback_text, strip=True)
    cleaned_fallback = re.sub(r'\s+', ' ', cleaned_fallback).strip()
    
    # Assemble content sections
    raw_content = ""
    if headings:
        raw_content += "Headings:\n" + "\n".join(headings) + "\n\n"
    if paragraphs:
        raw_content += "Body:\n" + "\n".join(paragraphs) + "\n\n"
    if lists:
        raw_content += "Lists:\n" + "\n".join(lists) + "\n\n"
    if tables:
        raw_content += "Tables:\n" + "\n\n".join(tables) + "\n\n"
        
    if not raw_content.strip():
        raw_content = cleaned_fallback

    # Auto-categorize page category for search filters (FAQ, Blog, Documentation, Tables)
    category = "documentation" # Default
    url_lower = url.lower()
    
    if "faq" in url_lower or "question" in url_lower or len(soup.find_all(string=re.compile(r"\b(FAQ|Frequently Asked Questions)\b", re.IGNORECASE))) > 0:
        category = "faq"
    elif "blog" in url_lower or "news" in url_lower or soup.find("article"):
        category = "blog"
    elif len(tables) > 0:
        category = "tables"
        
    return {
        "title": title,
        "content": raw_content,
        "tables": tables,
        "category": category,
        "metadata": metadata
    }

# Dynamic Chunking
def chunk_document(doc_data: dict, url: str, chunk_size: int, chunk_overlap: int) -> list:
    text = doc_data["content"]
    title = doc_data["title"]
    category = doc_data["category"]
    
    chunks = []
    words = text.split()
    
    # Simple character-based chunking with word boundary respect
    current_chunk = []
    current_size = 0
    
    # Loop word by word to keep words intact
    for word in words:
        current_chunk.append(word)
        current_size += len(word) + 1 # +1 for space
        
        if current_size >= chunk_size:
            chunk_text = " ".join(current_chunk)
            chunks.append({
                "text": f"Source: {title} ({url})\n\n{chunk_text}",
                "metadata": {
                    "source_url": url,
                    "title": title,
                    "category": category,
                    "length": len(chunk_text)
                }
            })
            # Overlap handling (approximate by taking trailing slice of words)
            overlap_words = int((chunk_overlap / chunk_size) * len(current_chunk))
            if overlap_words > 0:
                current_chunk = current_chunk[-overlap_words:]
                current_size = sum(len(w) + 1 for w in current_chunk)
            else:
                current_chunk = []
                current_size = 0
                
    if current_chunk:
        chunk_text = " ".join(current_chunk)
        chunks.append({
            "text": f"Source: {title} ({url})\n\n{chunk_text}",
            "metadata": {
                "source_url": url,
                "title": title,
                "category": category,
                "length": len(chunk_text)
            }
        })
        
    # Also chunk tables separately to make sure they match target table searches
    for idx, table in enumerate(doc_data["tables"]):
        chunks.append({
            "text": f"Source (Table): {title} ({url})\n\n{table}",
            "metadata": {
                "source_url": url,
                "title": title,
                "category": "tables",
                "length": len(table)
            }
        })
        
    return chunks

# Async Crawler Loop
async def crawl_and_index_website(
    project_id: int,
    base_url: str,
    max_depth: int,
    max_pages: int,
    chunk_size: int = None,
    chunk_overlap: int = None
):
    chunk_size = chunk_size or settings.chunk_size
    chunk_overlap = chunk_overlap or settings.chunk_overlap
    
    # Validate Base URL
    parsed_base = urlparse(base_url)
    if not parsed_base.scheme or not parsed_base.netloc:
        update_crawler_status(project_id, status="failed", error="Invalid URL scheme or domain.")
        return
        
    # Check if this is a YouTube URL
    youtube_id = extract_youtube_video_id(base_url)
    if youtube_id:
        try:
            update_crawler_status(
                project_id, 
                status="crawling", 
                pages_crawled=0, 
                chunks_created=0, 
                current_url=f"Fetching YouTube video {youtube_id}...",
                remaining=15
            )
            
            video_title = await fetch_youtube_video_title(youtube_id)
            
            update_crawler_status(
                project_id, 
                current_url="Retrieving transcript..."
            )
            
            try:
                transcript_text = await asyncio.to_thread(fetch_youtube_transcript, youtube_id)
            except Exception as caption_err:
                update_crawler_status(
                    project_id,
                    current_url="Captions unavailable. Transcribing video audio (Speech-to-Text)...",
                    remaining=45
                )
                transcript_text = await fetch_youtube_transcript_stt(youtube_id)
            
            page_data = {
                "title": video_title,
                "content": f"YouTube Video: {video_title}\n\nTranscript:\n{transcript_text}",
                "tables": [],
                "category": "documentation",
                "metadata": {"video_id": youtube_id, "source": "youtube"}
            }
            
            chunks = chunk_document(page_data, base_url, chunk_size, chunk_overlap)
            
            # Save page status to DB
            add_indexed_page(project_id, base_url, video_title, len(chunks))
            
            project = get_project(project_id)
            current_pages = project["indexed_pages_count"] if project else 0
            current_chunks = project["chunks_count"] if project else 0
            
            update_crawler_status(project_id, pages_crawled=current_pages + 1, chunks_created=current_chunks + len(chunks))
            
            if chunks:
                update_crawler_status(project_id, current_url="Generating embeddings...", remaining=5)
                index_chunks(project_id, chunks)
                update_project_stats(project_id, current_pages + 1, current_chunks + len(chunks))
                update_crawler_status(
                    project_id, 
                    status="completed", 
                    pages_crawled=current_pages + 1, 
                    chunks_created=current_chunks + len(chunks), 
                    current_url="Index Complete", 
                    remaining=0
                )
            else:
                update_crawler_status(
                    project_id, 
                    status="failed", 
                    error="No transcript content found in the video."
                )
            return
        except Exception as e:
            update_crawler_status(
                project_id, 
                status="failed", 
                error=f"YouTube indexing failed: {str(e)}"
            )
            return
        
    target_domain = parsed_base.netloc
    
    # Stay within the base URL's directory path to avoid wandering off-topic
    base_path = parsed_base.path
    if not base_path.endswith('/'):
        if '.' in base_path.split('/')[-1]:
            base_path = '/'.join(base_path.split('/')[:-1]) + '/'
        else:
            base_path = base_path + '/'
            
    update_crawler_status(
        project_id, 
        status="crawling", 
        pages_crawled=0, 
        chunks_created=0, 
        current_url=base_url,
        remaining=15
    )
    
    queue = [(base_url, 0)] # (URL, Depth)
    visited = set()
    all_chunks = []
    pages_crawled_count = 0
    
    # HTTP client headers
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
    }
    
    timeout = httpx.Timeout(10.0, connect=5.0)
    
    # Check robots.txt once
    if not is_allowed_by_robots(base_url, "AntigravityRAGBot"):
        update_crawler_status(
            project_id,
            status="failed",
            error="Crawling disallowed by robots.txt"
        )
        return

    async with httpx.AsyncClient(headers=headers, timeout=timeout, follow_redirects=True) as client:
        while queue and pages_crawled_count < max_pages:
            url, depth = queue.pop(0)
            normalized = normalize_url(url)
            
            if normalized in visited:
                continue
                
            visited.add(normalized)
            pages_crawled_count += 1
            
            update_crawler_status(
                project_id, 
                current_url=url, 
                pages_crawled=pages_crawled_count,
                remaining=max(5, (max_pages - pages_crawled_count) * 2) # Estimate 2 sec/page
            )
            
            try:
                # Crawl page
                response = await client.get(url)
                if response.status_code != 200:
                    continue
                    
                # Verify HTML
                content_type = response.headers.get("content-type", "")
                if "text/html" not in content_type:
                    continue
                    
                # Extract
                page_data = extract_page_data(response.text, url)
                
                # Chunk
                chunks = chunk_document(page_data, url, chunk_size, chunk_overlap)
                all_chunks.extend(chunks)
                
                # Save page status to SQL DB
                add_indexed_page(project_id, url, page_data["title"], len(chunks))
                update_crawler_status(project_id, chunks_created=len(all_chunks))
                
                # Extract Links if not reached max depth
                if depth < max_depth:
                    soup = BeautifulSoup(response.text, "html.parser")
                    for link in soup.find_all("a", href=True):
                        href = link["href"]
                        full_url = urljoin(url, href)
                        parsed_link = urlparse(full_url)
                        
                        # 1. Stay in same domain
                        # 2. Match base scheme (http/https)
                        # 3. Exclude structural documents (pdf, images, zip etc)
                        # 4. Check normalization
                        if (parsed_link.netloc == target_domain and 
                            parsed_link.scheme in ("http", "https") and 
                            parsed_link.path.startswith(base_path) and
                            not EXCLUDE_EXTENSIONS.search(parsed_link.path)):
                            
                            norm_link = normalize_url(full_url)
                            if norm_link not in visited and norm_link not in [q[0] for q in queue]:
                                queue.append((full_url, depth + 1))
                                
            except Exception as e:
                # Log single page crawl failure but continue indexing others
                print(f"Failed to crawl {url}: {str(e)}")
                continue
                
            # Yield control to prevent event loop blocking
            await asyncio.sleep(0.1)
            
    # Index All Chunks in Vector Database
    if all_chunks:
        try:
            update_crawler_status(project_id, current_url="Generating embeddings...", remaining=5)
            index_chunks(project_id, all_chunks)
            
            project = get_project(project_id)
            current_pages = project["indexed_pages_count"] if project else 0
            current_chunks = project["chunks_count"] if project else 0
            
            update_project_stats(project_id, current_pages + pages_crawled_count, current_chunks + len(all_chunks))
            update_crawler_status(
                project_id, 
                status="completed", 
                pages_crawled=current_pages + pages_crawled_count, 
                chunks_created=current_chunks + len(all_chunks), 
                current_url="Index Complete", 
                remaining=0
            )
        except Exception as e:
            traceback.print_exc()
            update_crawler_status(
                project_id, 
                status="failed", 
                error=f"Indexing failed: {str(e)}"
            )
    else:
        update_crawler_status(
            project_id, 
            status="failed", 
            error="No crawlable content or text found on site."
        )
