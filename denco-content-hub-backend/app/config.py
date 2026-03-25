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

    # AI Chat microservice
    ai_chat_service_url: str = "http://localhost:8011"
    ai_chat_jwt_secret: str = "ai-chat-jwt-secret-change-me"
    ai_chat_service_secret: str = "ai-chat-service-secret-change-me"

    # Competitor Intelligence — YouTube Data API v3
    youtube_api_key: str | None = None

    # Competitor Intelligence — Apify (Instagram)
    apify_api_key: str | None = None

    # Competitor Intelligence — VK API
    vk_access_token: str | None = None

    # Anthropic (Claude API for analysis)
    anthropic_api_key: str | None = None
    ai_model: str = "claude-sonnet-4-20250514"

    # Hugging Face (pyannote speaker diarization)
    huggingface_token: str | None = None

    # Frontend (for invitation links)
    frontend_url: str = "http://localhost:3000"

    # Knowledge Graph microservice
    kg_service_url: str = "http://localhost:8010"
    kg_service_secret: str = "kg-service-secret-change-me"

    # SSO (Staff Service — Staff IdP)
    staff_jwks_url: str = "http://localhost:8004/api/v1/auth/.well-known/jwks.json"
    staff_issuer: str = "https://auth.denco.store/staff"
    staff_jwks_refresh_seconds: int = 3600

    # SSO (Client IdP)
    client_jwks_url: str = "http://localhost:8007/api/v1/auth/.well-known/jwks.json"
    client_issuer: str = "https://auth.denco.store/client"

    # App
    debug: bool = True
    app_name: str = "DENCO Content Hub API"
    api_v1_prefix: str = "/api/v1"
    default_company_slug: str = "denco"


settings = Settings()
