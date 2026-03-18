from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://app:app@localhost:5432/app_db"
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_timeout: int = 30

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Celery
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # Auth
    secret_key: str = "change-me-generate-with-openssl-rand-hex-32"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]

    # Whisper / Audio pipeline
    whisper_model_size: str = "small"
    audio_storage_path: str = "/var/denco/audio"
    max_video_duration_minutes: int = 180

    # Claude API
    anthropic_api_key: str | None = None

    # AI Assistant defaults (overridable via DB ai_settings)
    ai_master_prompt: str = (
        "You are a helpful marketing assistant for DENCO Content Hub. "
        "Use the provided knowledge graph context to give accurate, "
        "relevant answers about the company's marketing strategy."
    )
    ai_max_tool_rounds: int = 5
    ai_max_history_messages: int = 20
    ai_rate_limit_per_hour: int = 30
    ai_max_sessions_shown: int = 50
    ai_provider: str = "anthropic"
    ai_model: str = "claude-sonnet-4-20250514"

    # AI Attachments
    ai_attachments_path: str = "/var/denco/ai-attachments"
    ai_attachment_max_size_mb: int = 10
    ai_attachment_max_per_message: int = 3

    # Competitor Intelligence — YouTube Data API v3
    youtube_api_key: str | None = None

    # Competitor Intelligence — Apify (Instagram)
    apify_api_key: str | None = None

    # Competitor Intelligence — VK API
    vk_access_token: str | None = None

    # Hugging Face (pyannote speaker diarization)
    huggingface_token: str | None = None

    # Frontend (for invitation links)
    frontend_url: str = "http://localhost:3000"

    # Knowledge Graph microservice
    kg_service_url: str = "http://localhost:8010"
    kg_service_secret: str = "kg-service-secret-change-me"

    # App
    debug: bool = True
    app_name: str = "DENCO Content Hub API"
    api_v1_prefix: str = "/api/v1"
    default_company_slug: str = "denco"


settings = Settings()
