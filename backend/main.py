import logging
from contextlib import asynccontextmanager
from datetime import date

import uvicorn
from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

import schemas as s
from ergast import (
    get_circuits,
    get_constructor_points_progression,
    get_constructor_standings,
    get_constructors,
    get_driver_points_progression,
    get_driver_standings,
    get_drivers,
    get_next_race,
    get_pit_stops,
    get_qualifying,
    get_race_results,
    get_schedule,
    get_seasons,
    get_sprint_results,
)
from errors import AppError, Forbidden, InvalidInput
from jobs.precompute import precompute_race
from jobs.scheduler import start_scheduler
from params import Round, Season, SessionType, TelemetryRound, TelemetryYear
from precomputed import store
from services.cache import cache_stats, clear_cache
from services.circuits import circuit_outline
from services.h2h import head_to_head
from services.profiles import circuit_detail, constructor_profile, driver_profile
from services.race import race_analysis, race_analyst
from settings import settings
from telemetry import (
    get_session_drivers,
    get_speed_trace,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Precompute scheduler lives in this process because it owns the
    # precomputed store (see precomputed.py)
    scheduler = start_scheduler() if settings.precompute_enabled else None
    yield
    if scheduler:
        scheduler.shutdown(wait=False)
    store.close()


app = FastAPI(title="F1 Dashboard API", version="1.0.0", lifespan=lifespan)

DEFAULT_SEASON = settings.default_season
# Telemetry takes a numeric year; "current" means this calendar year
DEFAULT_YEAR = int(DEFAULT_SEASON) if DEFAULT_SEASON.isdigit() else date.today().year

logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ── Error responses ───────────────────────────────────────────────────────────
# Every error body is {"error": <code>, "message": <sentence for the user>}.


def _error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": code, "message": message})


@app.exception_handler(AppError)
def app_error_handler(request: Request, exc: AppError):
    return _error(exc.status, exc.code, exc.message)


@app.exception_handler(RequestValidationError)
def validation_error_handler(request: Request, exc: RequestValidationError):
    first = exc.errors()[0]
    field = ".".join(str(p) for p in first["loc"] if p not in ("query", "path", "body"))
    # Messages from our own validators arrive as "Value error, <text>"
    msg = first["msg"].removeprefix("Value error, ")
    return _error(422, InvalidInput.code, f"Invalid '{field}': {msg}.")


@app.exception_handler(StarletteHTTPException)
def http_error_handler(request: Request, exc: StarletteHTTPException):
    code = "not_found" if exc.status_code == 404 else "http_error"
    return _error(exc.status_code, code, str(exc.detail))


@app.exception_handler(Exception)
def unhandled_error_handler(request: Request, exc: Exception):
    # exc_info=exc: this runs outside the original except block, so
    # logger.exception() would have no traceback to attach
    logger.error("Unhandled error on %s %s", request.method, request.url.path, exc_info=exc)
    return _error(500, AppError.code, AppError.default_message)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def route(path: str, model, method: str = "get"):
    """Register a route with its response model; keys a builder omits stay omitted."""
    return getattr(app, method)(path, response_model=model, response_model_exclude_unset=True)


@route("/", s.RootResponse)
def root():
    return {"message": "F1 Dashboard API", "version": "1.0.0"}


# ── Drivers ───────────────────────────────────────────────────────────────────


@route("/api/drivers", s.DriversResponse)
def drivers(season: Season = DEFAULT_SEASON):
    return get_drivers(season)


@route("/api/driver-standings", s.DriverStandingsResponse)
def driver_standings(season: Season = DEFAULT_SEASON):
    return get_driver_standings(season)


@route("/api/drivers/{driver_id}", s.DriverProfileResponse)
def driver_profile_route(driver_id: str, season: Season = DEFAULT_SEASON):
    return driver_profile(driver_id, season)


# ── Constructors ──────────────────────────────────────────────────────────────


@route("/api/constructors", s.ConstructorsResponse)
def constructors(season: Season = DEFAULT_SEASON):
    return get_constructors(season)


@route("/api/constructor-standings", s.ConstructorStandingsResponse)
def constructor_standings(season: Season = DEFAULT_SEASON):
    return get_constructor_standings(season)


@route("/api/constructors/{constructor_id}", s.ConstructorProfileResponse)
def constructor_profile_route(constructor_id: str, season: Season = DEFAULT_SEASON):
    return constructor_profile(constructor_id, season)


# ── Circuits ──────────────────────────────────────────────────────────────────


@route("/api/circuits", s.CircuitsResponse)
def circuits(season: Season = DEFAULT_SEASON):
    return get_circuits(season)


@route("/api/circuits/{circuit_id}", s.Circuit)
def circuit_detail_route(circuit_id: str, season: Season = DEFAULT_SEASON):
    return circuit_detail(circuit_id, season)


@route("/api/circuit-outline", s.CircuitOutlineResponse)
def circuit_outline_route(circuit_id: str, alt: str = ""):
    return circuit_outline(circuit_id, alt)


# ── Seasons, schedule, next race ──────────────────────────────────────────────


@route("/api/seasons", s.SeasonsResponse)
def seasons():
    return get_seasons()


@route("/api/schedule", s.ScheduleResponse)
def schedule(season: Season = DEFAULT_SEASON):
    return get_schedule(season)


@route("/api/next-race", s.NextRaceResponse)
def next_race(season: Season = DEFAULT_SEASON):
    return get_next_race(season)


# ── Race weekend results ──────────────────────────────────────────────────────


@route("/api/results", s.RaceResultsResponse)
def race_results(season: Season = DEFAULT_SEASON, round: Round = "last"):
    return get_race_results(season, round)


@route("/api/qualifying", s.QualifyingResponse)
def qualifying(season: Season = DEFAULT_SEASON, round: Round = "last"):
    return get_qualifying(season, round)


@route("/api/sprint", s.SprintResponse)
def sprint_results(season: Season = DEFAULT_SEASON, round: Round = "last"):
    return get_sprint_results(season, round)


@route("/api/pitstops", s.PitStopsResponse)
def pit_stops(season: Season = DEFAULT_SEASON, round: Round = "last"):
    return get_pit_stops(season, round)


# ── Points progressions ───────────────────────────────────────────────────────


@route("/api/driver-progression", s.DriverProgressionResponse)
def driver_progression(season: Season = DEFAULT_SEASON):
    return get_driver_points_progression(season)


@route("/api/constructor-progression", s.ConstructorProgressionResponse)
def constructor_progression(season: Season = DEFAULT_SEASON):
    return get_constructor_points_progression(season)


# ── Head-to-head ──────────────────────────────────────────────────────────────


@route("/api/h2h", s.H2HResponse)
def h2h(
    season: Season = DEFAULT_SEASON,
    driver1: str = Query(..., description="First driver ID"),
    driver2: str = Query(..., description="Second driver ID"),
):
    return head_to_head(season, driver1, driver2)


# ── Telemetry (FastF1) ────────────────────────────────────────────────────────
# Timing data is only reachable for some seasons; see CLAUDE.md.


@route("/api/telemetry/drivers", s.SessionDriversResponse)
def telemetry_drivers(
    year: TelemetryYear = DEFAULT_YEAR, round: TelemetryRound = 1, session: SessionType = "R"
):
    """Drivers in a session, for driver-picker dropdowns."""
    return get_session_drivers(year, round, session)


@route("/api/telemetry", s.SpeedTraceResponse)
def telemetry(
    year: TelemetryYear = DEFAULT_YEAR,
    round: TelemetryRound = 1,
    session: SessionType = "R",
    driver1: str = "VER",
    driver2: str = "NOR",
):
    """Speed/throttle/brake/gear traces of two drivers' fastest laps on one distance axis."""
    return get_speed_trace(year, round, session, driver1, driver2)


@route("/api/telemetry/race-analysis", s.RaceAnalysisResponse)
def telemetry_race_analysis(year: TelemetryYear = DEFAULT_YEAR, round: TelemetryRound = 1):
    """Whole-race analysis for every driver: positions, laps, stints, fastest laps."""
    return race_analysis(year, round)


@route("/api/race-analyst", s.RaceAnalystResponse)
def race_analyst_route(year: TelemetryYear = DEFAULT_YEAR, round: TelemetryRound = 1):
    """Per-lap rule-based commentary for a race."""
    return race_analyst(year, round)


# ── Admin ─────────────────────────────────────────────────────────────────────

_LOOPBACK = {"127.0.0.1", "::1", "localhost"}


def _require_local(request: Request) -> None:
    # Loopback alone isn't enough: a web page open in the browser (or the Vite
    # proxy) also arrives from 127.0.0.1, but browsers always send Origin on
    # POST/DELETE while the CLI and scripts don't.
    if (
        request.client is None
        or request.client.host not in _LOOPBACK
        or "origin" in request.headers
    ):
        raise Forbidden("This can only be triggered from the server itself.")


@route("/api/admin/precompute", s.PrecomputeResponse, method="post")
def precompute(request: Request, year: TelemetryYear, round: TelemetryRound):
    """Precompute a race's analysis now (used by `python -m jobs.precompute`). Localhost only."""
    _require_local(request)
    return precompute_race(year, round, store)


# ── Cache management ──────────────────────────────────────────────────────────


@route("/api/cache/stats", s.CacheStatsResponse)
def cache_stats_route():
    """Stats about the Jolpica SQLite API cache."""
    return cache_stats()


@route("/api/cache/clear", s.CacheClearResponse, method="delete")
def cache_clear(request: Request, expired_only: bool = False):
    """Clear the Jolpica API cache (everything, or only expired entries). Localhost only."""
    _require_local(request)
    return clear_cache(expired_only)


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
