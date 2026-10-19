from datetime import date

import pytest

import params


@pytest.mark.parametrize(
    ("raw", "expected"),
    [("2026", "2026"), (" 1950 ", "1950"), ("CURRENT", "current"), ("02024", "2024")],
)
def test_season_valid(raw, expected):
    assert params._check_season(raw) == expected


@pytest.mark.parametrize("raw", ["1949", str(date.today().year + 2), "abc", "", "-2020", "20.5"])
def test_season_invalid(raw):
    with pytest.raises(ValueError):
        params._check_season(raw)


@pytest.mark.parametrize(
    ("raw", "expected"), [("1", "1"), ("07", "7"), ("last", "last"), ("NEXT", "next")]
)
def test_round_valid(raw, expected):
    assert params._check_round(raw) == expected


@pytest.mark.parametrize("raw", ["0", "-3", "first", "", "1.5"])
def test_round_invalid(raw):
    with pytest.raises(ValueError):
        params._check_round(raw)


def test_telemetry_year_bounds():
    assert params._check_telemetry_year(params.FIRST_TELEMETRY_YEAR) == params.FIRST_TELEMETRY_YEAR
    with pytest.raises(ValueError):
        params._check_telemetry_year(params.FIRST_TELEMETRY_YEAR - 1)
