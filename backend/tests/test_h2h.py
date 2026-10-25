"""services/h2h.py: constructor head-to-head aggregates and the best-car-ahead rule."""

import pytest
from test_ergast import roundtrip

import schemas
from errors import InvalidInput
from services.h2h import constructor_head_to_head

NAMES = {"RUS": "Russell", "ANT": "Antonelli", "LEC": "Leclerc", "HAM": "Hamilton"}


def row(rnd, code, pos, points, team, fl=99):
    return {
        "round": rnd,
        "raceName": f"Race {rnd}",
        "constructorName": team.title(),
        "driverId": code.lower(),
        "code": code,
        "familyName": NAMES[code],
        "position": pos if isinstance(pos, int) else 99,
        "positionText": str(pos),
        "points": float(points),
        "fastestLapRank": fl,
    }


DATA = {
    # Round 1: Mercedes wins (P1 beats Ferrari's best, P2). Round 2: Mercedes' best
    # is P4 after a retirement; Ferrari's P3 is ahead.
    ("mercedes", "results"): [
        row(1, "RUS", 1, 25, "mercedes", fl=1),
        row(1, "ANT", 5, 10, "mercedes"),
        row(2, "RUS", "R", 0, "mercedes"),
        row(2, "ANT", 4, 12, "mercedes"),
    ],
    ("ferrari", "results"): [
        row(1, "LEC", 2, 18, "ferrari"),
        row(1, "HAM", 3, 15, "ferrari"),
        row(2, "LEC", 3, 15, "ferrari"),
        row(2, "HAM", 6, 8, "ferrari"),
    ],
    ("mercedes", "sprint"): [row(2, "RUS", 1, 8, "mercedes")],
    ("ferrari", "sprint"): [],
    # Quali: Mercedes on pole in round 1, Ferrari ahead in round 2
    ("mercedes", "qualifying"): [row(1, "RUS", 1, 0, "mercedes"), row(2, "ANT", 5, 0, "mercedes")],
    ("ferrari", "qualifying"): [row(1, "LEC", 3, 0, "ferrari"), row(2, "HAM", 2, 0, "ferrari")],
}


@pytest.fixture
def h2h(mocker):
    mocker.patch(
        "services.h2h.get_constructor_season", side_effect=lambda s, cid, ep: DATA[(cid, ep)]
    )
    return constructor_head_to_head("2026", "mercedes", "ferrari")


def test_constructor_aggregates(h2h):
    merc, fer = h2h["constructor1"], h2h["constructor2"]
    assert (merc["name"], merc["drivers"]) == ("Mercedes", ["Russell", "Antonelli"])
    assert (merc["points"], merc["sprintPoints"], merc["totalPoints"]) == (47.0, 8.0, 55.0)
    assert (merc["wins"], merc["podiums"], merc["fastestLaps"], merc["dnf"]) == (1, 1, 1, 1)
    assert merc["avgPosition"] == round((1 + 5 + 4) / 3, 2)  # the retirement doesn't count
    assert (fer["points"], fer["wins"], fer["podiums"], fer["dnf"]) == (56.0, 0, 3, 0)
    assert merc["races"] == fer["races"] == 2


def test_best_car_decides_each_round(h2h):
    assert [r["winner"] for r in h2h["races"]] == ["mercedes", "ferrari"]
    assert h2h["constructor1"]["headToHeadWins"] == h2h["constructor2"]["headToHeadWins"] == 1
    assert h2h["constructor1"]["qualiWins"] == h2h["constructor2"]["qualiWins"] == 1
    # Cars listed best first, with the team's points for the round
    r2 = h2h["races"][1]["c1"]
    assert [c["code"] for c in r2["cars"]] == ["ANT", "RUS"] and r2["points"] == 12.0


def test_constructor_h2h_matches_its_schema(h2h):
    roundtrip(schemas.ConstructorH2HResponse, h2h)


def test_same_constructor_twice_is_rejected():
    with pytest.raises(InvalidInput):
        constructor_head_to_head("2026", "ferrari", "ferrari")
