"""Inspect and clear the Jolpica SQLite response cache."""

import time

from ergast import _CACHE_DB, _LIVE_KEYWORDS, _TTL_LIVE, _TTL_STATIC, _db


def cache_stats() -> dict:
    with _db() as con:
        count, oldest, newest = con.execute(
            "SELECT COUNT(*), MIN(stored_at), MAX(stored_at) FROM api_cache"
        ).fetchone()
    return {
        "total_entries": count,
        "oldest_entry":  oldest,
        "newest_entry":  newest,
        "db_size_bytes": _CACHE_DB.stat().st_size if _CACHE_DB.exists() else 0,
    }


def clear_cache(expired_only: bool = False) -> dict:
    """Delete every entry, or only those whose TTL has passed."""
    with _db() as con:
        if not expired_only:
            cur = con.execute("DELETE FROM api_cache")
            con.commit()
            return {"deleted": cur.rowcount, "mode": "all"}

        now = time.time()
        deleted = 0
        for url, stored_at in con.execute("SELECT url, stored_at FROM api_cache").fetchall():
            ttl = _TTL_LIVE if any(k in url for k in _LIVE_KEYWORDS) else _TTL_STATIC
            if now - stored_at > ttl:
                con.execute("DELETE FROM api_cache WHERE url = ?", (url,))
                deleted += 1
        con.commit()
        return {"deleted": deleted, "mode": "expired_only"}
