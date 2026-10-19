"""Single driver / constructor / circuit lookups within a season."""

from ergast import (
    get_circuits,
    get_constructor_standings,
    get_constructors,
    get_driver_standings,
    get_drivers,
)
from errors import NotFound


def driver_profile(driver_id: str, season: str) -> dict:
    driver = next((d for d in get_drivers(season)["drivers"] if d["driverId"] == driver_id), None)
    if not driver:
        raise NotFound(f"No driver '{driver_id}' in the {season} season.")
    standing = next(
        (s for s in get_driver_standings(season)["standings"] if s["driverId"] == driver_id),
        None,
    )
    return {"driver": driver, "standing": standing}


def constructor_profile(constructor_id: str, season: str) -> dict:
    constructor = next(
        (c for c in get_constructors(season)["constructors"] if c["constructorId"] == constructor_id),
        None,
    )
    if not constructor:
        raise NotFound(f"No constructor '{constructor_id}' in the {season} season.")
    standing = next(
        (s for s in get_constructor_standings(season)["standings"]
         if s["constructorId"] == constructor_id),
        None,
    )
    return {"constructor": constructor, "standing": standing}


def circuit_detail(circuit_id: str, season: str) -> dict:
    circuit = next((c for c in get_circuits(season)["circuits"] if c["circuitId"] == circuit_id), None)
    if not circuit:
        raise NotFound(f"No circuit '{circuit_id}' on the {season} calendar.")
    return circuit
