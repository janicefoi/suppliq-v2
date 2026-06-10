from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ── App ────────────────────────────────────────────────────────────────
    app_name: str = "SUPPLIQ AI"
    app_version: str = "0.1.0"
    debug: bool = False

    # ── Database (same Postgres as Next.js) ───────────────────────────────
    database_url: str  # e.g. postgresql://user:pass@localhost:5435/suppliq_dev

    # ── Anthropic ─────────────────────────────────────────────────────────
    anthropic_api_key: str
    claude_model: str = "claude-opus-4-8"  # model used for analysis

    # ── Next.js origin (for CORS) ─────────────────────────────────────────
    nextjs_origin: str = "http://localhost:3000"

    # ── External data sources ─────────────────────────────────────────────
    # Alpha Vantage — free commodity & FX rates (https://www.alphavantage.co)
    alpha_vantage_api_key: str = ""

    # NewsAPI — supply chain & industry headlines (https://newsapi.org)
    news_api_key: str = ""

    # OpenWeatherMap — weather-driven demand signals (https://openweathermap.org)
    openweather_api_key: str = ""

    # Exchange Rates API — KES/USD/EUR live rates (https://exchangeratesapi.io)
    exchange_rates_api_key: str = ""

    # ── Scheduler ─────────────────────────────────────────────────────────
    # How often (in minutes) the background forecast job runs
    forecast_interval_minutes: int = 60


settings = Settings()
