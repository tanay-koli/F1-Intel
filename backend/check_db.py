import duckdb
from pathlib import Path

db = Path('warehouse/db/f1.duckdb')
if not db.exists():
    print('NO DB - ingestion has NOT been run yet')
else:
    size_mb = db.stat().st_size / 1024 / 1024
    print(f'DB exists: {size_mb:.1f} MB')
    con = duckdb.connect(str(db))
    tables = con.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='main'").fetchall()
    print(f'Tables found: {[t[0] for t in tables]}')
    print()
    for t in tables:
        name = t[0]
        n = con.execute(f'SELECT COUNT(*) FROM {name}').fetchone()[0]
        try:
            row = con.execute(f'SELECT MIN(season), MAX(season), COUNT(DISTINCT season) FROM {name}').fetchone()
            print(f'  {name:<35} {n:>8} rows   seasons {row[0]}-{row[1]} ({row[2]} seasons)')
        except Exception:
            print(f'  {name:<35} {n:>8} rows')
    con.close()
