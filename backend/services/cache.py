"""Inspect and clear the Jolpica SQLite response cache."""

import json

from ergast import _CACHE_DB, _db, is_fresh


def cache_stats() -> dict:
    with _db() as con:
        count, oldest, newest = con.execute(
            "SELECT COUNT(*), MIN(stored_at), MAX(stored_at) FROM api_cache"
        ).fetchone()
    return {
        "total_entries": count,
        "oldest_entry": oldest,
        "newest_entry": newest,
        "db_size_bytes": _CACHE_DB.stat().st_size if _CACHE_DB.exists() else 0,
    }


def clear_cache(expired_only: bool = False) -> dict:
    """Delete every entry, or only those the cache policy no longer considers fresh."""
    with _db() as con:
        if not expired_only:
            cur = con.execute("DELETE FROM api_cache")
            con.commit()
            return {"deleted": cur.rowcount, "mode": "all"}

        rows = con.execute("SELECT url, body, stored_at FROM api_cache").fetchall()
        stale = [
            url
            for url, body, stored_at in rows
            if not is_fresh(con, url, json.loads(body), stored_at)
        ]
        con.executemany("DELETE FROM api_cache WHERE url = ?", [(u,) for u in stale])
        con.commit()
        return {"deleted": len(stale), "mode": "expired_only"}
