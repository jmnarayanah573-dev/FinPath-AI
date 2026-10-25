import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = "FinPath AI – Intelligent Financial Journey Assistant"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"

    # Server settings
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))

    # Security
    JWT_SECRET: str = os.getenv("JWT_SECRET", "finpath-super-secret-production-grade-key-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # -------------------------------------------------------------------------
    # Database — Supabase PostgreSQL
    # -------------------------------------------------------------------------
    # Set SUPABASE_DB_URL to the "Direct connection" string from:
    #   Supabase Dashboard → Settings → Database → Connection string → URI
    # Example:
    #   postgresql://postgres:<PASSWORD>@db.<project-ref>.supabase.co:5432/postgres
    #
    # Do NOT use the pooler URL for the psycopg2 driver unless you pin
    # to session mode (port 5432) on the pooler; transaction-mode pooler
    # (port 6543) is incompatible with SET statements used by psycopg2.
    SUPABASE_DB_URL: str = os.getenv("SUPABASE_DB_URL", "")

    # Legacy Supabase REST-API credentials (kept for reference; not used by the
    # backend database layer — only needed if you later use supabase-py client).
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")

    # SQLite fallback path (kept for the migration script only; not used at runtime)
    SQLITE_DB_PATH: str = os.getenv("SQLITE_DB_PATH", "finpath.db")

    # LLM API keys
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

    # Storage
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "uploads")

settings = Settings()
