"""Race-level services built on the FastF1 analysis."""

from race_analyst import analyze_race
from telemetry import get_full_race_analysis


def race_analyst(year: int, round_num: int) -> dict:
    """Per-lap analyst insights; reuses the memoised race analysis."""
    analysis = get_full_race_analysis(year, round_num)
    return {
        "year": year,
        "round": round_num,
        "raceName": analysis.get("raceName", ""),
        "totalLaps": analysis.get("totalLaps", 0),
        "insights": analyze_race(analysis),
    }
