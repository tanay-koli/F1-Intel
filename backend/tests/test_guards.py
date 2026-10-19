import pytest
import requests


def test_network_is_blocked():
    """The conftest guard must stop real HTTP calls (so tests never hit Jolpica/F1)."""
    with pytest.raises(Exception, match="Network access in tests is disabled"):
        requests.get("https://api.jolpi.ca/ergast/f1/seasons.json", timeout=2)
