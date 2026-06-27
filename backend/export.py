import json
import csv
import io
from typing import List, Dict, Any, Tuple
from backend.database import get_chat_session, get_chat_messages

def generate_markdown(session_title: str, messages: List[Dict[str, Any]]) -> str:
    md = []
    md.append(f"# Chat Conversation: {session_title}")
    md.append(f"Generated on: {messages[0]['created_at'] if messages else 'N/A'}\n")
    md.append("---")
    
    for m in messages:
        role = m["role"].capitalize()
        content = m["content"]
        md.append(f"### **{role}**:")
        if m["role"] == "assistant":
            md.append(f"> {content}")
            if m.get("confidence") is not None:
                md.append(f"\n*Confidence Score:* `{m['confidence']}`")
            if m.get("sources"):
                md.append("\n*Sources Used:*")
                for s in m["sources"]:
                    md.append(f"- [{s['title']}]({s['url']}) (Similarity: {s['score']})")
        else:
            md.append(content)
        md.append("\n")
        
    return "\n".join(md)

def generate_csv(messages: List[Dict[str, Any]]) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    
    # CSV Headers
    writer.writerow(["Message ID", "Timestamp", "Role", "Content", "Confidence", "Response Time", "Sources"])
    
    for m in messages:
        sources_list = []
        if m.get("sources"):
            for s in m["sources"]:
                sources_list.append(f"{s['title']} ({s['url']})")
        sources_str = " | ".join(sources_list)
        
        writer.writerow([
            m.get("id", ""),
            m.get("created_at", ""),
            m.get("role", ""),
            m.get("content", ""),
            m.get("confidence", ""),
            m.get("response_time", ""),
            sources_str
        ])
        
    return output.getvalue()

def generate_pdf_from_messages(session_title: str, messages: List[Dict[str, Any]]) -> bytes:
    """
    Pure Python PDF encoder to generate a basic PDF file of the conversation
    without relying on ReportLab or other binary external dependencies.
    """
    pdf = []
    # PDF Header
    pdf.append("%PDF-1.4")
    
    # 1. Catalog Object
    pdf.append("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj")
    
    # 2. Pages list (Single page for simplicity, but accommodates long text stream)
    pdf.append("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj")
    
    # 3. Page Object
    pdf.append("3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources 4 0 R /MediaBox [0 0 595.275 841.889] /Contents 5 0 R >>\nendobj")
    
    # 4. Resources (Register Helvetica and Helvetica-Bold fonts)
    pdf.append("4 0 obj\n<< /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >>\nendobj")
    
    # 5. Build Content Stream
    stream_content = []
    stream_content.append("BT")
    
    # Title
    stream_content.append("/F2 16 Tf")
    stream_content.append("50 800 Td")
    escaped_title = session_title.replace("(", "\\(").replace(")", "\\)").encode("latin1", "ignore").decode("latin1")
    stream_content.append(f"({escaped_title}) Tj")
    stream_content.append("0 -30 Td")
    
    # Message Body
    stream_content.append("/F1 10 Tf")
    
    line_y = 750
    for m in messages:
        role = m["role"].upper()
        content = m["content"]
        
        # Word wrapping helper for standard PDF width (80-90 characters limit)
        words = content.split()
        lines = []
        curr_line = []
        for w in words:
            if sum(len(x)+1 for x in curr_line) + len(w) < 85:
                curr_line.append(w)
            else:
                lines.append(" ".join(curr_line))
                curr_line = [w]
        if curr_line:
            lines.append(" ".join(curr_line))
            
        # Draw Role Header (Bold)
        stream_content.append("0 -20 Td")
        stream_content.append("/F2 10 Tf")
        stream_content.append(f"({role}:) Tj")
        stream_content.append("/F1 10 Tf")
        line_y -= 20
        
        # Draw Content lines
        for line in lines:
            # Escape parentheses inside PDF strings
            escaped_line = line.replace("(", "\\(").replace(")", "\\)")
            escaped_line = escaped_line.encode("latin1", "ignore").decode("latin1")
            
            stream_content.append("0 -13 Td")
            stream_content.append(f"({escaped_line}) Tj")
            line_y -= 13
            
            # Simple page layout protection (reset vertical alignment if page overflow)
            if line_y < 50:
                stream_content.append("ET")
                # For safety in single-page viewer, just terminate early if conversation is huge
                break
                
        # Extra spacer between QA bubbles
        stream_content.append("0 -10 Td")
        line_y -= 10
        if line_y < 50:
            break
            
    stream_content.append("ET")
    stream_text = "\n".join(stream_content)
    
    pdf.append(f"5 0 obj\n<< /Length {len(stream_text)} >>\nstream\n{stream_text}\nendstream\nendobj")
    
    # Trailer Catalog (Bypasses offset table calculation)
    pdf.append("trailer\n<< /Root 1 0 R >>\n%%EOF")
    
    return "\n".join(pdf).encode("latin-1")

def export_chat_session(session_id: str, format_type: str) -> Tuple[bytes, str, str]:
    """
    Exports a chat session conversation into the requested format.
    Returns: (bytes, filename, content_type)
    """
    session = get_chat_session(session_id)
    if not session:
        raise ValueError(f"Chat session {session_id} not found.")
        
    messages = get_chat_messages(session_id)
    session_title = session["title"]
    clean_title = "".join(c for c in session_title if c.isalnum() or c in (" ", "_", "-")).strip().replace(" ", "_")
    
    if format_type == "json":
        data = {
            "session": session,
            "messages": messages
        }
        content = json.dumps(data, indent=2).encode("utf-8")
        return content, f"chat_export_{clean_title}.json", "application/json"
        
    elif format_type == "csv":
        csv_str = generate_csv(messages)
        return csv_str.encode("utf-8"), f"chat_export_{clean_title}.csv", "text/csv"
        
    elif format_type == "markdown":
        md_str = generate_markdown(session_title, messages)
        return md_str.encode("utf-8"), f"chat_export_{clean_title}.md", "text/markdown"
        
    elif format_type == "pdf":
        pdf_bytes = generate_pdf_from_messages(session_title, messages)
        return pdf_bytes, f"chat_export_{clean_title}.pdf", "application/pdf"
        
    else:
        raise ValueError(f"Unsupported export format: {format_type}")
