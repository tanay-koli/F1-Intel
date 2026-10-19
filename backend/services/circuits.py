"""Circuit outlines exported by warehouse/ingest/ingest_fastf1.py."""

import json
import re
from pathlib import Path

from errors import InvalidInput, NotFound

# One JSON file of [x, y] points per GP
CIRCUITS_DIR = Path(__file__).resolve().parent.parent / "warehouse" / "raw" / "circuits"
OUTLINE_POINTS = 300


def circuit_outline(circuit_id: str, alt: str = "") -> dict:
    """
    X/Y outline of a circuit, downsampled to ~300 points.
    Files are named after the GP passed to the export script, so `alt`
    (e.g. the locality) is tried as a second filename.
    """
    names = [n.strip().lower().replace(" ", "_") for n in (circuit_id, alt) if n.strip()]
    for name in names:
        # Validates before touching the filesystem (no path traversal)
        if not re.fullmatch(r"[a-z0-9_]+", name):
            raise InvalidInput("Circuit ids contain only lowercase letters, digits and underscores.")
        path = CIRCUITS_DIR / f"{name}.json"
        if path.exists():
            points = json.loads(path.read_text())
            step = max(1, len(points) // OUTLINE_POINTS)
            return {"circuitId": circuit_id, "points": points[::step]}
    raise NotFound("No track outline has been exported for this circuit.")
