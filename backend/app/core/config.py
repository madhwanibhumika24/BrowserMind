"""App-wide configuration loaded from environment variables."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    google_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    memory_file: str = "./data/memory.json"
    allowed_origins: str = "chrome-extension://*"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
