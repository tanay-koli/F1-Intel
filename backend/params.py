"""
Typed query parameters shared by the routes.

Season and round stay strings after validation because they are spliced into
Jolpica URLs as-is ("current", "last" and "next" are Jolpica keywords).
Invalid values fail FastAPI validation, which main.py turns into a 422 with
the message raised here.
"""

from datetime import date
from typing import Annotated, Literal

from fastapi import Query
from pydantic import AfterValidator

FIRST_SEASON = 1950
# FastF1 timing data (laps, telemetry) exists from 2018 onwards
FIRST_TELEMETRY_YEAR = 2018


def _latest_season() -> int:
    # Next year's calendar is usually published before the current season ends
    return date.today().year + 1


def _check_season(value: str) -> str:
    value = value.strip().lower()
    if value == "current":
        return value
    if not value.isdigit() or not FIRST_SEASON <= int(value) <= _latest_season():
        raise ValueError(
            f"use a year from {FIRST_SEASON} to {_latest_season()}, or 'current'"
        )
    return str(int(value))


def _check_round(value: str) -> str:
    value = value.strip().lower()
    if value in ("last", "next"):
        return value
    if not value.isdigit() or int(value) < 1:
        raise ValueError("use a round number (1 or higher), 'last' or 'next'")
    return str(int(value))


def _check_telemetry_year(value: int) -> int:
    if not FIRST_TELEMETRY_YEAR <= value <= _latest_season():
        raise ValueError(
            f"telemetry is available from {FIRST_TELEMETRY_YEAR} to {_latest_season()}"
        )
    return value


Season = Annotated[str, AfterValidator(_check_season)]
Round = Annotated[str, AfterValidator(_check_round)]
TelemetryYear = Annotated[int, AfterValidator(_check_telemetry_year)]
TelemetryRound = Annotated[int, Query(ge=1, le=30)]
SessionType = Literal["R", "Q", "S", "SQ", "SS", "FP1", "FP2", "FP3"]
