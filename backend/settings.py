"""
Runtime configuration, read from environment variables or backend/.env.
See .env.example for the available settings.
"""

from datetime import date
from pathlib import Path
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

from params import _check_season

BACKEND_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    # Comma-separated in the environment: CORS_ORIGINS=http://a,http://b
    cors_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    # Season used when a request doesn't name one
    default_season: str = Field(default_factory=lambda: str(date.today().year))
    # Holds the Jolpica response cache (api_cache.sqlite) and FastF1's cache
    cache_dir: Path = BACKEND_DIR / "f1_cache"
    log_level: str = "INFO"
    # Precomputed race analysis (jobs/): run the scheduler inside the API, and
    # how long after a race's scheduled start to run the job (race ~2 h, then
    # time for timing data to be published)
    precompute_enabled: bool = True
    precompute_delay_hours: float = 5.0
    # Where `python -m jobs.precompute` finds the running API when the
    # precomputed database is locked by it
    api_url: str = "http://127.0.0.1:8000"

    # Seasons FastF1 can actually load lap/telemetry data for. F1's own server
    # returns 401 and FastF1's mirror only hosts 2021-2022 (see CLAUDE.md).
    # Requests for other seasons get a 503 at once instead of a ~5 s doomed
    # load that spends FastF1's 500 calls/hour. Empty = always try.
    telemetry_seasons: Annotated[list[int], NoDecode] = [2021, 2022]

    @field_validator("cors_origins", "telemetry_seasons", mode="before")
    @classmethod
    def _split_list(cls, value):
        if isinstance(value, str):
            return [v.strip() for v in value.split(",") if v.strip()]
        return value

    @field_validator("default_season")
    @classmethod
    def _valid_season(cls, value: str) -> str:
        # Same rule as the `season` query parameter
        return _check_season(value)

    @field_validator("log_level")
    @classmethod
    def _upper(cls, value: str) -> str:
        return value.upper()


settings = Settings()
