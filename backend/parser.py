import pypdf
import docx2txt
import traceback
from pathlib import Path
from backend.database import add_indexed_page, update_project_stats, get_project
from backend.config import settings
from backend.vector_store import index_chunks

def parse_pdf(file_path: Path) -> str:
    text = ""
    try:
        reader = pypdf.PdfReader(file_path)
        for page_num in range(len(reader.pages)):
            page = reader.pages[page_num]
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    except Exception as e:
        print(f"Error parsing PDF {file_path}: {e}")
        raise e
    return text

def parse_docx(file_path: Path) -> str:
    try:
        text = docx2txt.process(str(file_path))
        return text
    except Exception as e:
        print(f"Error parsing DOCX {file_path}: {e}")
        raise e

def parse_txt(file_path: Path) -> str:
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except Exception as e:
        print(f"Error parsing TXT {file_path}: {e}")
        raise e

def parse_file(file_path: str, filename: str) -> str:
    path = Path(file_path)
    ext = path.suffix.lower()
    
    if ext == ".pdf":
        return parse_pdf(path)
    elif ext in (".docx", ".doc"):
        return parse_docx(path)
    elif ext in (".txt", ".md"):
        return parse_txt(path)
    else:
        raise ValueError(f"Unsupported file format: {ext}")


def chunk_text(text: str, filename: str, chunk_size: int, chunk_overlap: int) -> list:
    words = text.split()
    chunks = []
    
    current_chunk = []
    current_size = 0
    
    for word in words:
        current_chunk.append(word)
        current_size += len(word) + 1 # +1 for space
        
        if current_size >= chunk_size:
            chunk_text = " ".join(current_chunk)
            chunks.append({
                "text": f"Source Document: {filename}\n\n{chunk_text}",
                "metadata": {
                    "source_url": f"upload://{filename}",
                    "title": filename,
                    "category": "documentation",
                    "length": len(chunk_text)
                }
            })
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
            "text": f"Source Document: {filename}\n\n{chunk_text}",
            "metadata": {
                "source_url": f"upload://{filename}",
                "title": filename,
                "category": "documentation",
                "length": len(chunk_text)
            }
        })
        
    return chunks

def process_uploaded_file(project_id: int, file_path: str, filename: str) -> dict:
    try:
        # Get active project config
        project = get_project(project_id)
        if not project:
            raise ValueError(f"Project with ID {project_id} does not exist.")
            
        # Parse file text
        raw_text = parse_file(file_path, filename)
        if not raw_text.strip():
            raise ValueError("No extractable text was found in the file.")
            
        # Chunk file text
        chunk_size = settings.chunk_size
        chunk_overlap = settings.chunk_overlap
        chunks = chunk_text(raw_text, filename, chunk_size, chunk_overlap)
        
        # Append to active FAISS index
        index_chunks(project_id, chunks)
        
        # Log to DB
        add_indexed_page(project_id, f"upload://{filename}", filename, len(chunks))
        
        # Update project statistics
        new_pages_count = project["indexed_pages_count"] + 1
        new_chunks_count = project["chunks_count"] + len(chunks)
        update_project_stats(project_id, new_pages_count, new_chunks_count)
        
        return {
            "success": True,
            "filename": filename,
            "chunks_created": len(chunks)
        }
    except Exception as e:
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e)
        }
