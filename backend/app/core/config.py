"""App-wide configuration loaded from environment variables."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    openai_api_key: str = ""
    chroma_persist_dir: str = "./data/chroma"
    allowed_origins: str = "chrome-extension://*"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
