# 🏎 F1 Dashboard — MVP

A full-stack F1 data dashboard built with **React + FastAPI**, powered by the **Ergast API** and **FastF1**.

---

## Project Structure

```
f1-dashboard/
├── backend/
│   ├── main.py           # FastAPI app & routes
│   ├── ergast.py         # Ergast API wrapper
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── api.js
    │   ├── components/
    │   │   ├── ui.jsx
    │   │   └── SeasonSelector.jsx
    │   └── pages/
    │       ├── DriversPage.jsx
    │       ├── ConstructorsPage.jsx
    │       └── TracksPage.jsx
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## Quick Start

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend runs at: http://localhost:8000
Swagger docs:    http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: http://localhost:5173

---

## MVP Features

| Module         | Features                                              |
|----------------|-------------------------------------------------------|
| **Drivers**    | Championship standings, driver profile panel, stats  |
| **Constructors**| Team standings, color-coded cards, points bar chart |
| **Circuits**   | Track list with search, OSM map embed, coordinates   |
| **Season**     | Switch between any F1 season (2000–2025)             |

---

## API Endpoints

```
GET /api/drivers?season=2025
GET /api/drivers/{driver_id}?season=2025
GET /api/driver-standings?season=2025

GET /api/constructors?season=2025
GET /api/constructors/{constructor_id}?season=2025
GET /api/constructor-standings?season=2025

GET /api/circuits?season=2025
GET /api/circuits/{circuit_id}?season=2025

GET /api/seasons
```

---

## Scaling Roadmap

### Phase 2 — Race Data
- [ ] Race results per round
- [ ] Qualifying results
- [ ] Fastest lap data
- [ ] Points progression charts (season arc)

### Phase 3 — FastF1 Telemetry
- [ ] Lap time breakdown per driver
- [ ] Speed traces (FastF1 `get_telemetry()`)
- [ ] Gear map / throttle-brake overlay
- [ ] Tyre compound strategy per race

### Phase 4 — Live Timing
- [ ] FastF1 `livetiming` module integration
- [ ] WebSocket push via FastAPI `websockets`
- [ ] Live leaderboard during race
- [ ] Real-time lap delta

### Phase 5 — Advanced UX
- [ ] Circuit SVG maps with sector coloring
- [ ] Head-to-head driver comparisons
- [ ] Pit stop strategy visualizer
- [ ] Mobile responsive layout

---

## Notes

- Ergast API has no auth required but rate-limit kindly (cache responses)
- FastF1 requires a local cache dir; set with `fastf1.Cache.enable_cache('./f1_cache')`
- For live 2025 data, Ergast updates ~1h after each session
