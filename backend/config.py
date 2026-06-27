import os
import json
from pathlib import Path
from dotenv import load_dotenv

# Load root .env
load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

# Base Directory Setup
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("DATA_DIR", str(BASE_DIR / "data")))
FAISS_DIR = Path(os.getenv("FAISS_DIR", str(DATA_DIR / "faiss")))
UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", str(DATA_DIR / "uploads")))
SETTINGS_FILE = DATA_DIR / "settings.json"

# Ensure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
FAISS_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

class Settings:
    def __init__(self):
        # Load environment defaults
        self.jwt_secret = os.getenv("JWT_SECRET", "supersecretjwtsecretkeyforragchatbotapp12345")
        self.jwt_algorithm = os.getenv("JWT_ALGORITHM", "HS256")
        self.access_token_expire_minutes = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
        
        self.openai_api_key = os.getenv("OPENAI_API_KEY", "")
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "")
        self.grok_api_key = os.getenv("GROK_API_KEY", "")
        self.grok_model = os.getenv("GROK_MODEL", "grok-beta")
        
        self.chunk_size = int(os.getenv("DEFAULT_CHUNK_SIZE", "500"))
        self.chunk_overlap = int(os.getenv("DEFAULT_CHUNK_OVERLAP", "50"))
        self.top_k = int(os.getenv("DEFAULT_TOP_K", "5"))
        self.temperature = float(os.getenv("DEFAULT_TEMPERATURE", "0.2"))
        self.max_crawl_depth = int(os.getenv("DEFAULT_MAX_CRAWL_DEPTH", "1"))
        self.max_pages = int(os.getenv("DEFAULT_MAX_PAGES", "20"))
        
        # Load persistent user settings if available
        self.load_from_disk()

    def load_from_disk(self):
        if SETTINGS_FILE.exists():
            try:
                with open(SETTINGS_FILE, "r") as f:
                    data = json.load(f)
                    self.jwt_secret = data.get("jwt_secret", self.jwt_secret)
                    self.jwt_algorithm = data.get("jwt_algorithm", self.jwt_algorithm)
                    self.openai_api_key = data.get("openai_api_key", self.openai_api_key)
                    self.gemini_api_key = data.get("gemini_api_key", self.gemini_api_key)
                    self.grok_api_key = data.get("grok_api_key", self.grok_api_key)
                    self.grok_model = data.get("grok_model", self.grok_model)
                    self.chunk_size = int(data.get("chunk_size", self.chunk_size))
                    self.chunk_overlap = int(data.get("chunk_overlap", self.chunk_overlap))
                    self.top_k = int(data.get("top_k", self.top_k))
                    self.temperature = float(data.get("temperature", self.temperature))
                    self.max_crawl_depth = int(data.get("max_crawl_depth", self.max_crawl_depth))
                    self.max_pages = int(data.get("max_pages", self.max_pages))
            except Exception as e:
                print(f"Error loading settings.json: {e}")

    def save_to_disk(self):
        try:
            with open(SETTINGS_FILE, "w") as f:
                json.dump({
                    "jwt_secret": self.jwt_secret,
                    "jwt_algorithm": self.jwt_algorithm,
                    "openai_api_key": self.openai_api_key,
                    "gemini_api_key": self.gemini_api_key,
                    "grok_api_key": self.grok_api_key,
                    "grok_model": self.grok_model,
                    "chunk_size": self.chunk_size,
                    "chunk_overlap": self.chunk_overlap,
                    "top_k": self.top_k,
                    "temperature": self.temperature,
                    "max_crawl_depth": self.max_crawl_depth,
                    "max_pages": self.max_pages
                }, f, indent=4)
        except Exception as e:
            print(f"Error saving settings.json: {e}")

    def update(self, new_settings: dict):
        if "jwt_secret" in new_settings: self.jwt_secret = new_settings["jwt_secret"]
        if "openai_api_key" in new_settings: self.openai_api_key = new_settings["openai_api_key"]
        if "gemini_api_key" in new_settings: self.gemini_api_key = new_settings["gemini_api_key"]
        if "grok_api_key" in new_settings: self.grok_api_key = new_settings["grok_api_key"]
        if "grok_model" in new_settings: self.grok_model = new_settings["grok_model"]
        if "chunk_size" in new_settings: self.chunk_size = int(new_settings["chunk_size"])
        if "chunk_overlap" in new_settings: self.chunk_overlap = int(new_settings["chunk_overlap"])
        if "top_k" in new_settings: self.top_k = int(new_settings["top_k"])
        if "temperature" in new_settings: self.temperature = float(new_settings["temperature"])
        if "max_crawl_depth" in new_settings: self.max_crawl_depth = int(new_settings["max_crawl_depth"])
        if "max_pages" in new_settings: self.max_pages = int(new_settings["max_pages"])
        self.save_to_disk()

# Instantiate global settings
settings = Settings()
