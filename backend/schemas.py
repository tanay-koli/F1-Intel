"""
Response models for every route: documentation (/docs) and a safety net for
the JSON contract the frontend depends on.

They describe the JSON exactly as the builders in ergast.py / telemetry.py /
race_analyst.py produce it:
- Routes set response_model_exclude_unset=True. A field with a default
  (`= None`) is one some code paths leave out entirely (e.g. results for a
  round that hasn't happened yet); it stays absent rather than appearing as null.
- `X | None` without a default means the key is always present but may be null.
- `Number` keeps ints as ints where the code can produce either (e.g. a sum
  that is 0 when there's nothing to add).
Unknown keys are dropped, which the smoke check reports as a shape change.
"""

from pydantic import BaseModel

Number = int | float


class Model(BaseModel):
    pass


# ── Misc ──────────────────────────────────────────────────────────────────────

class RootResponse(Model):
    message: str
    version: str


class SeasonsResponse(Model):
    seasons: list[str]


class CacheStatsResponse(Model):
    total_entries: int
    oldest_entry: float | None
    newest_entry: float | None
    db_size_bytes: int


class CacheClearResponse(Model):
    deleted: int
    mode: str


# ── Drivers ───────────────────────────────────────────────────────────────────

class Driver(Model):
    driverId: str
    code: str
    number: str
    firstName: str
    lastName: str
    fullName: str
    dateOfBirth: str
    nationality: str
    flag: str
    url: str
    season: str


class DriversResponse(Model):
    season: str
    drivers: list[Driver]
    total: int


class DriverStanding(Model):
    position: int
    points: float
    wins: int
    driverId: str
    code: str
    number: str
    fullName: str
    familyName: str
    nationality: str
    flag: str
    constructorId: str
    constructorName: str
    teamColor: str


class DriverStandingsResponse(Model):
    season: str
    round: str | int  # Jolpica's round string; 0 when the season has no standings yet
    standings: list[DriverStanding]


class DriverProfileResponse(Model):
    driver: Driver
    standing: DriverStanding | None


# ── Constructors ──────────────────────────────────────────────────────────────

class Constructor(Model):
    constructorId: str
    name: str
    nationality: str
    flag: str
    url: str
    color: str
    season: str


class ConstructorsResponse(Model):
    season: str
    constructors: list[Constructor]
    total: int


class ConstructorStanding(Model):
    position: int
    points: float
    wins: int
    constructorId: str
    name: str
    nationality: str
    flag: str
    color: str


class ConstructorStandingsResponse(Model):
    season: str
    round: str | int
    standings: list[ConstructorStanding]


class ConstructorProfileResponse(Model):
    constructor: Constructor
    standing: ConstructorStanding | None


# ── Circuits ──────────────────────────────────────────────────────────────────

class Circuit(Model):
    circuitId: str
    name: str
    locality: str
    country: str
    flag: str
    lat: float
    lng: float
    url: str
    season: str


class CircuitsResponse(Model):
    season: str
    circuits: list[Circuit]
    total: int


class CircuitOutlineResponse(Model):
    circuitId: str
    points: list[list[Number]]


# ── Schedule / next race ──────────────────────────────────────────────────────

class ScheduleRace(Model):
    round: int
    raceName: str
    season: str
    date: str
    time: str
    circuitId: str
    circuitName: str
    locality: str
    country: str
    flag: str
    lat: float
    lng: float
    fp1: str
    fp2: str
    fp3: str
    qualifying: str
    sprint: str


class ScheduleResponse(Model):
    season: str
    total: int
    races: list[ScheduleRace]


class WeekendSession(Model):
    key: str
    name: str
    start: str


class NextRace(Model):
    round: int
    raceName: str
    circuitId: str
    circuitName: str
    locality: str
    country: str
    sessions: list[WeekendSession]


class NextRaceResponse(Model):
    season: str
    race: NextRace | None


# ── Race weekend results ──────────────────────────────────────────────────────
# For a round with no data yet these return only {season, round, results: []}
# (round echoes the request, e.g. "next"), hence the defaults.

class RaceResult(Model):
    position: int  # 99 when not classified
    positionText: str
    points: float
    grid: int
    laps: int
    status: str
    driverId: str
    code: str
    number: str
    fullName: str
    familyName: str
    nationality: str
    flag: str
    constructorId: str
    constructorName: str
    teamColor: str
    time: str
    fastestLapTime: str
    fastestLapRank: int
    fastestLapSpeed: str


class RaceResultsResponse(Model):
    season: str
    round: int | str
    raceName: str | None = None
    date: str | None = None
    circuitId: str | None = None
    circuitName: str | None = None
    country: str | None = None
    flag: str | None = None
    results: list[RaceResult]


class QualifyingResult(Model):
    position: int
    driverId: str
    code: str
    number: str
    fullName: str
    nationality: str
    flag: str
    constructorId: str
    constructorName: str
    teamColor: str
    q1: str
    q2: str
    q3: str


class QualifyingResponse(Model):
    season: str
    round: int | str
    raceName: str | None = None
    date: str | None = None
    circuitName: str | None = None
    country: str | None = None
    flag: str | None = None
    results: list[QualifyingResult]


class SprintResult(Model):
    position: int
    positionText: str
    points: float
    grid: int
    laps: int
    status: str
    driverId: str
    code: str
    number: str
    fullName: str
    nationality: str
    flag: str
    constructorId: str
    constructorName: str
    teamColor: str
    time: str
    fastestLapTime: str
    fastestLapRank: int


class SprintResponse(Model):
    season: str
    round: int | str
    raceName: str | None = None
    date: str | None = None
    circuitId: str | None = None
    circuitName: str | None = None
    country: str | None = None
    flag: str | None = None
    results: list[SprintResult]


class PitStop(Model):
    driverId: str
    code: str
    fullName: str
    teamColor: str
    constructorName: str
    finishPosition: int
    stop: int
    lap: int
    time: str
    duration: float


class PitStopsResponse(Model):
    season: str
    round: int | str
    raceName: str | None = None
    date: str | None = None
    country: str | None = None
    flag: str | None = None
    totalLaps: int
    pitstops: list[PitStop]


# ── Points progression ────────────────────────────────────────────────────────

class DriverSeries(Model):
    driverId: str
    code: str
    fullName: str
    teamColor: str
    points: list[Number]


class DriverProgressionResponse(Model):
    season: str
    rounds: list[str]
    series: list[DriverSeries]


class ConstructorSeries(Model):
    constructorId: str
    name: str
    color: str
    points: list[Number]


class ConstructorProgressionResponse(Model):
    season: str
    rounds: list[str]
    series: list[ConstructorSeries]


# ── Head-to-head ──────────────────────────────────────────────────────────────

class H2HDriverSummary(Model):
    # Driver details, absent when the driver has no results that season
    driverId: str | None = None
    fullName: str | None = None
    code: str | None = None
    flag: str | None = None
    constructorId: str | None = None
    constructorName: str | None = None
    teamColor: str | None = None
    # Season aggregates
    points: Number
    sprintPoints: Number
    totalPoints: Number
    wins: int
    podiums: int
    fastestLaps: int
    dnf: int
    avgPosition: float
    races: int
    qualiWins: int
    avgQualiPosition: float
    headToHeadWins: int


class H2HRaceResult(Model):
    round: int
    raceName: str
    date: str
    position: int
    positionText: str
    points: float
    grid: int
    laps: int
    status: str
    constructorId: str
    constructorName: str
    teamColor: str
    fastestLapRank: int
    time: str


class H2HSprintResult(Model):
    round: int
    points: float
    position: int
    status: str


class H2HQualiResult(Model):
    round: int
    position: int
    q1: str
    q2: str
    q3: str


class H2HSprintPair(Model):
    d1: H2HSprintResult | None
    d2: H2HSprintResult | None


class H2HQualiPair(Model):
    d1: H2HQualiResult | None
    d2: H2HQualiResult | None


class H2HRace(Model):
    round: int
    raceName: str
    d1: H2HRaceResult | None
    d2: H2HRaceResult | None
    winner: str | None
    sprint: H2HSprintPair
    quali: H2HQualiPair


class H2HResponse(Model):
    season: str
    driver1: H2HDriverSummary
    driver2: H2HDriverSummary
    races: list[H2HRace]


# ── Telemetry (FastF1) ────────────────────────────────────────────────────────

class SessionDriver(Model):
    driverId: str  # FastF1 uses the car number, e.g. "1"
    code: str
    fullName: str
    teamColor: str


class SessionDriversResponse(Model):
    year: int
    round: int
    session: str
    drivers: list[SessionDriver]


class SpeedTraceDriver(Model):
    code: str
    fullName: str
    teamColor: str
    lapTime: str
    speed: list[float]
    throttle: list[float]
    brake: list[float]
    gear: list[int]


class SpeedTraceResponse(Model):
    year: int
    round: int
    session: str
    raceName: str
    distance: list[float]
    driver1: SpeedTraceDriver
    driver2: SpeedTraceDriver


class Lap(Model):
    lap: int | None
    lapTime: float | None
    lapTimeStr: str
    position: int | None
    gapToLeader: float | None
    compound: str
    tyreLife: int | None
    isPitLap: bool


class RaceLapDriver(Model):
    code: str
    fullName: str
    teamColor: str
    laps: list[Lap]
    pitLaps: list[int]
    fastestLap: int | None
    fastestLapTime: float | None
    fastestLapTimeStr: str
    avgLapTime: float | None
    finishPosition: int | None
    totalLaps: int


class RaceLapResponse(Model):
    year: int
    round: int
    session: str
    raceName: str
    maxLap: int
    driver1: RaceLapDriver
    driver2: RaceLapDriver


class Stint(Model):
    compound: str
    startLap: int | None
    endLap: int | None
    length: int


class AnalysisDriver(Model):
    driverId: str
    code: str
    fullName: str
    team: str | None
    teamColor: str
    gridPosition: int | None
    finishPosition: int | None
    positionsGained: int | None
    fastestLap: int | None
    fastestLapTime: float | None
    fastestLapTimeStr: str
    fastestLapCompound: str | None
    avgLapTime: float | None
    avgLapTimeStr: str
    pitStops: int
    pitLaps: list[int]
    stints: list[Stint]
    totalLaps: int
    laps: list[Lap]


class OverallFastestLap(Model):
    driver: str | None
    lap: int | None
    time: float | None
    timeStr: str
    compound: str | None


class RaceEvent(Model):
    type: str  # SC, VSC, RED, YELLOW, GREEN
    lap: int | None
    message: str


class RaceAnalysisResponse(Model):
    year: int
    round: int
    session: str
    raceName: str
    totalLaps: int
    overallFastestLap: OverallFastestLap
    raceEvents: list[RaceEvent]
    drivers: list[AnalysisDriver]


class LapInsight(Model):
    lap: int
    headline: str
    key_battles: str
    strategy_watch: str
    lap_mover: str


class RaceAnalystResponse(Model):
    year: int
    round: int
    raceName: str
    totalLaps: int
    insights: list[LapInsight]
