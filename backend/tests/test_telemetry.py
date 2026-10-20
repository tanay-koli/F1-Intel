"""telemetry.py: race-control event classification and the no-data-season fast path."""

import pytest

import telemetry
from errors import DataNotAvailable
from settings import settings


@pytest.mark.parametrize(
    ("message", "flag", "expected"),
    [
        # Real 2022 race-control messages (Monza, Jeddah)
        ("VIRTUAL SAFETY CAR DEPLOYED", "", "VSC"),
        ("VIRTUAL SAFETY CAR ENDING", "", None),
        ("SAFETY CAR DEPLOYED", "", "SC"),
        ("SAFETY CAR IN THIS LAP", "", None),
        (
            "FIA STEWARDS: INCIDENT INVOLVING CARS 55 (SAI) AND 11 (PER) REVIEWED NO FURTHER "
            "INVESTIGATION - SAFETY CAR INFRINGEMENT",
            "",
            None,
        ),
        ("RED FLAG", "RED", "RED"),
        ("RED FLAG", "", "RED"),
        ("RACE WILL RESUME AFTER RED FLAG", "", None),
        ("CHEQUERED FLAG", "CHEQUERED", None),  # contains the substring "RED FLAG"
        ("YELLOW IN TRACK SECTOR 7", "YELLOW", "YELLOW"),
        ("GREEN LIGHT - PIT EXIT OPEN", "GREEN", "GREEN"),
        ("DRS ENABLED", "", None),
    ],
)
def test_classify_race_event(message, flag, expected):
    assert telemetry.classify_race_event(message, flag) == expected


def test_unavailable_season_fails_fast(mocker):
    load = mocker.patch("telemetry._load_session")
    with pytest.raises(DataNotAvailable, match="2021, 2022"):
        telemetry.get_full_race_analysis(2025, 16)
    load.assert_not_called()  # no FastF1 load, no API calls spent


def test_available_season_still_loads(mocker):
    load = mocker.patch("telemetry._load_session", side_effect=DataNotAvailable("probe"))
    with pytest.raises(DataNotAvailable, match="probe"):
        telemetry.get_session_drivers(2022, 16)
    load.assert_called_once()


def test_empty_setting_disables_fast_path(mocker, monkeypatch):
    monkeypatch.setattr(settings, "telemetry_seasons", [])
    load = mocker.patch("telemetry._load_session", side_effect=DataNotAvailable("probe"))
    with pytest.raises(DataNotAvailable, match="probe"):
        telemetry.get_session_drivers(2025, 16)
    load.assert_called_once()
