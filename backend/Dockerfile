# Production Dockerfile for FastAPI RAG backend
FROM python:3.10-slim

# Set environment paths and configurations
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=off \
    PIP_DISABLE_PIP_VERSION_CHECK=on \
    PIP_DEFAULT_TIMEOUT=100

WORKDIR /app

# Install system dependencies needed for compiling sqlite or other packages if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend app codebase
# Docker-compose will execute from root, so we structure import scopes correctly
COPY . /app/backend

# Create directory structure for persistent volume mapping
RUN mkdir -p /app/data /app/data/faiss /app/data/uploads

# Expose port
EXPOSE 8000

# Run FastAPI app
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
