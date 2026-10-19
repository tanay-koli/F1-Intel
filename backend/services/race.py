"""
Race-level services built on the FastF1 analysis.

Both read precomputed payloads first (see precomputed.py, written by
jobs/precompute.py) and fall back to computing live, with identical JSON.
"""

import logging

from precomputed import read_or_none
from race_analyst import analyze_race
from telemetry import get_full_race_analysis

logger = logging.getLogger(__name__)


def race_analysis(year: int, round_num: int) -> dict:
    stored = read_or_none(year, round_num, "race_analysis")
    if stored is not None:
        logger.debug("race analysis %s R%s served precomputed", year, round_num)
        return stored
    return get_full_race_analysis(year, round_num)


def build_race_analyst(year: int, round_num: int, analysis: dict) -> dict:
    """The /api/race-analyst response for an analysis."""
    return {
        "year": year,
        "round": round_num,
        "raceName": analysis.get("raceName", ""),
        "totalLaps": analysis.get("totalLaps", 0),
        "insights": analyze_race(analysis),
    }


def race_analyst(year: int, round_num: int) -> dict:
    """Per-lap analyst insights; precomputed, else built from the (possibly stored) analysis."""
    stored = read_or_none(year, round_num, "race_analyst")
    if stored is not None:
        logger.debug("race analyst %s R%s served precomputed", year, round_num)
        return stored
    return build_race_analyst(year, round_num, race_analysis(year, round_num))
