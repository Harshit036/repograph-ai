from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str = "postgresql+psycopg2://repograph:repograph@localhost:5432/repograph"

    # LLM
    ollama_model: str = "qwen2.5-coder:7b"
    ollama_base_url: str = "http://localhost:11434"

    # Embeddings
    embedding_model: str = "all-MiniLM-L6-v2"
    embedding_dim: int = 384

    # Auth
    api_key: str = "changeme-dev-key"

    # App
    repo_base_path: str = "repositories"
    debug: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
