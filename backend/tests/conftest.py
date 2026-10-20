import json
import socket
from pathlib import Path

import pytest

import ergast
import jobs.scheduler
import main
import precomputed
import telemetry

FIXTURES = Path(__file__).parent / "fixtures"


_LOOPBACK = {"127.0.0.1", "::1", "localhost"}
_real_connect = socket.socket.connect


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    """Tests must never reach the network; any attempt fails loudly.

    Loopback stays allowed: on Windows, asyncio (used by TestClient) builds its
    internal socket pair by connecting to 127.0.0.1.
    """

    def guarded_connect(sock, address):
        host = address[0] if isinstance(address, tuple) else address
        if host not in _LOOPBACK:
            raise RuntimeError(f"Network access in tests is disabled ({host}); use fixtures.")
        return _real_connect(sock, address)

    monkeypatch.setattr(socket.socket, "connect", guarded_connect)


@pytest.fixture(autouse=True)
def no_fastf1_loads(monkeypatch):
    """No test may load a real FastF1 session (it would read the local cache or
    the network). Mock get_full_race_analysis / the telemetry function instead."""

    def blocked(*args, **kwargs):
        raise RuntimeError("Loading FastF1 sessions in tests is disabled; mock it.")

    monkeypatch.setattr(telemetry.fastf1, "get_session", blocked)


@pytest.fixture(autouse=True)
def tmp_api_cache(monkeypatch, tmp_path):
    """Point the Jolpica SQLite cache at a throwaway file."""
    path = tmp_path / "api_cache.sqlite"
    monkeypatch.setattr(ergast, "_CACHE_DB", path)
    return path


@pytest.fixture(autouse=True)
def tmp_store(monkeypatch, tmp_path):
    """A throwaway precomputed store, used wherever the app's store is referenced."""
    store = precomputed.Store(tmp_path / "precomputed.duckdb")
    monkeypatch.setattr(precomputed, "store", store)
    monkeypatch.setattr(main, "store", store)
    monkeypatch.setattr(jobs.scheduler, "store", store)
    yield store
    store.close()


@pytest.fixture
def jolpica(monkeypatch):
    """Replay recorded Jolpica responses (scripts/record_fixtures.py) through ergast._get."""
    folder = FIXTURES / "jolpica"
    manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))

    def fake_get(url):
        if url not in manifest:
            raise AssertionError(f"No recorded fixture for {url}; re-run record_fixtures.py")
        return json.loads((folder / manifest[url]).read_text(encoding="utf-8"))

    monkeypatch.setattr(ergast, "_get", fake_get)
    return manifest


def load_fixture(name: str):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


@pytest.fixture
def race_analysis():
    """get_full_race_analysis(2022, 16) as recorded."""
    return load_fixture("race_analysis_2022_16.json")
