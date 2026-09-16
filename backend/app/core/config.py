"""App-wide configuration loaded from environment variables."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    google_api_key: str = ""
    # gemini-2.5-flash-lite was deprecated for new users (404'd with a
    # message pointing here) - gemini-3.5-flash-lite is the current
    # lightweight model with a similarly generous free-tier quota, vs.
    # gemini-3.6-flash's old, much tighter 20/day limit.
    gemini_model: str = "gemini-3.5-flash-lite"
    allowed_origins: str = "chrome-extension://*"

    # MySQL - stores memory, users, and login sessions. A local MySQL server
    # must be running with this database already created (see README).
    database_url: str = "mysql+pymysql://root:password@localhost:3306/browsermind"

    # Google Sign-In: must match the extension's oauth2.client_id in manifest.json,
    # so we know the access token we're checking was actually issued for our app.
    google_oauth_client_id: str = ""

    # Email/password auth: forgot-password codes are sent from this Gmail
    # account. smtp_app_password is a 16-character "app password" generated
    # from the Google Account's Security settings - NOT the account's real
    # login password (Gmail rejects the real one for SMTP).
    smtp_email: str = ""
    smtp_app_password: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
