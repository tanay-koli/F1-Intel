from datetime import date

import pytest
from pydantic import ValidationError

from settings import Settings


def make(monkeypatch, **env):
    for key in ("CORS_ORIGINS", "DEFAULT_SEASON", "CACHE_DIR", "LOG_LEVEL"):
        monkeypatch.delenv(key, raising=False)
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    return Settings(_env_file=None)  # ignore any local backend/.env


def test_defaults(monkeypatch):
    s = make(monkeypatch)
    assert s.default_season == str(date.today().year)
    assert "http://127.0.0.1:5173" in s.cors_origins
    assert s.cache_dir.name == "f1_cache"
    assert s.log_level == "INFO"


def test_from_environment(monkeypatch, tmp_path):
    s = make(
        monkeypatch,
        CORS_ORIGINS="http://a.test, http://b.test",
        DEFAULT_SEASON="current",
        CACHE_DIR=str(tmp_path),
        LOG_LEVEL="debug",
    )
    assert s.cors_origins == ["http://a.test", "http://b.test"]
    assert s.default_season == "current"
    assert s.cache_dir == tmp_path
    assert s.log_level == "DEBUG"


def test_invalid_default_season_fails_at_startup(monkeypatch):
    with pytest.raises(ValidationError, match="use a year from 1950"):
        make(monkeypatch, DEFAULT_SEASON="1900")
