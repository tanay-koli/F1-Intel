import fastf1, json, argparse
from pathlib import Path

# Need to set up FastF1 cache properly
cache_dir = Path(__file__).parent.parent / "raw" / "fastf1" / "f1_cache"
cache_dir.mkdir(parents=True, exist_ok=True)
fastf1.Cache.enable_cache(str(cache_dir))

def export_circuit_svg_data(year: int, gp: str):
    session = fastf1.get_session(year, gp, 'Q')
    session.load(telemetry=False, laps=True, weather=False, messages=False)
    lap = session.laps.pick_fastest()
    
    if lap is None or str(lap.LapTime) == "NaT":
        print(f"No fast lap found for {gp} {year}")
        return
        
    pos = lap.get_pos_data()
    if pos is None:
        print(f"No telemetry found for {gp} {year}")
        return
        
    # Scale and center logic? For now, just raw coords.
    coords = pos[['X', 'Y']].dropna().values.tolist()
    
    out = Path(__file__).parent.parent / "raw" / "circuits" / f"{gp.lower().replace(' ', '_')}.json"
    out.parent.mkdir(exist_ok=True, parents=True)
    out.write_text(json.dumps(coords))
    print(f"Saved {gp} circuit SVG (year: {year}) with {len(coords)} points to {out}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int, default=2024, help="Year to extract from")
    parser.add_argument("--gp", type=str, help="GP name to extract. If omitted, fetches all for the year.")
    args = parser.parse_args()

    if args.gp:
        export_circuit_svg_data(args.year, args.gp)
    else:
        # loop through all events in that year
        events = fastf1.get_event_schedule(args.year)
        for _, event in events.iterrows():
            if event['EventFormat'] != 'testing':
                try:
                    export_circuit_svg_data(args.year, event['EventName'])
                except Exception as e:
                    print(f"Failed to fetch track map for {event['EventName']}: {e}")
