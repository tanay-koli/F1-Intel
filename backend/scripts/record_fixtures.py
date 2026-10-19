"""
Record real data for the test suite. Uses the network; run it by hand.

    python scripts/record_fixtures.py

- Jolpica: runs the ergast.py / services calls the tests use with `_get`
  wrapped, and saves every raw response to tests/fixtures/jolpica/ plus a
  manifest (url -> file). Tests replay them by patching `_get`.
- FastF1: saves get_full_race_analysis(2022, 16) and the race analyst's
  output for it (the snapshot test's input and expected output). 2022 is
  one of the seasons whose timing data is still reachable.
"""

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import ergast  # noqa: E402
from race_analyst import analyze_race  # noqa: E402
from services.h2h import head_to_head  # noqa: E402
from telemetry import get_full_race_analysis  # noqa: E402

FIXTURES = Path(__file__).resolve().parent.parent / "tests" / "fixtures"
JOLPICA = FIXTURES / "jolpica"

# The calls the tests replay
CALLS = [
    lambda: ergast.get_driver_standings("2026"),
    lambda: ergast.get_driver_standings("1985"),  # entries with no position
    lambda: ergast.get_constructor_standings("2026"),
    lambda: ergast.get_constructor_standings("2007"),  # McLaren excluded
    lambda: ergast.get_race_results("2026", "last"),
    lambda: ergast.get_race_results("2024", "1"),
    lambda: ergast.get_qualifying("2026", "17"),
    lambda: ergast.get_sprint_results("2026", "17"),
    lambda: ergast.get_pit_stops("2026", "17"),
    lambda: ergast.get_schedule("2026"),
    lambda: ergast.get_next_race("2026"),
    lambda: ergast.get_next_race("2024"),  # Jolpica answers with 2025's opener
    lambda: head_to_head("2026", "norris", "piastri"),
]


def slug(url: str) -> str:
    path = url.removeprefix(ergast.BASE_URL + "/").split("?")[0].removesuffix(".json")
    return re.sub(r"[^a-z0-9]+", "_", path.lower()).strip("_") + ".json"


def record_jolpica():
    JOLPICA.mkdir(parents=True, exist_ok=True)
    manifest = {}
    real_get = ergast._get

    def recording_get(url):
        data = real_get(url)
        name = slug(url)
        (JOLPICA / name).write_text(json.dumps(data, indent=1), encoding="utf-8")
        manifest[url] = name
        return data

    ergast._get = recording_get
    try:
        for call in CALLS:
            call()
    finally:
        ergast._get = real_get
    (JOLPICA / "manifest.json").write_text(
        json.dumps(manifest, indent=1, sort_keys=True), encoding="utf-8"
    )
    print(f"jolpica: {len(manifest)} responses")


def record_race_analysis():
    analysis = get_full_race_analysis(2022, 16)
    (FIXTURES / "race_analysis_2022_16.json").write_text(json.dumps(analysis), encoding="utf-8")
    insights = analyze_race(analysis)
    (FIXTURES / "race_analyst_2022_16.json").write_text(
        json.dumps(insights, indent=1), encoding="utf-8"
    )
    print(f"race analysis: {len(analysis['drivers'])} drivers, {len(insights)} laps")


if __name__ == "__main__":
    record_jolpica()
    record_race_analysis()
