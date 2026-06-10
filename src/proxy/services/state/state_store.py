from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def utc_day(timestamp: float) -> str:
    return datetime.fromtimestamp(timestamp, timezone.utc).date().isoformat()


class StateStore:
    """In-memory state with write-behind persistence.

    State is read from disk once and mutated in memory. It is flushed back to
    disk at most every flush_seconds (and on close), so the mitmproxy event loop
    no longer rewrites the whole file on every request. A crash can lose at most
    the last flush_seconds of updates, which is acceptable for usage counters.
    """

    def __init__(self, path: Path, flush_seconds: float | None = None):
        self.path = Path(path)
        self._flush_seconds = flush_seconds if flush_seconds is not None else _flush_seconds_from_env()
        self._state: dict[str, Any] | None = None
        self._dirty = False
        self._last_flush = time.monotonic()

    def load(self) -> dict[str, Any]:
        if self._state is None:
            self._state = self._read_disk()
        return self._state

    def get_value(self, key: str) -> Any:
        state = self.load()
        if key not in state:
            raise KeyError(key)
        return state[key]

    def set_value(self, key: str, value: Any) -> None:
        json.dumps(value)
        self.load()[key] = value
        self._mark_dirty()

    def track_usage(self, platform: str, idle_seconds: int, now: float) -> dict[str, Any]:
        state = self.load()
        usage = state.setdefault("usage", {})
        record = usage.setdefault(platform, self._empty_usage_record())
        day = utc_day(now)
        daily = record.setdefault("daily_seconds", {})
        last_seen = record.get("last_seen_at")
        delta = 0.0
        event = "session_start"

        if last_seen is not None:
            elapsed = max(0.0, float(now) - float(last_seen))
            if elapsed <= idle_seconds:
                delta = elapsed
                event = "activity"
                record["total_seconds"] = float(record.get("total_seconds", 0.0)) + delta
                daily[day] = float(daily.get(day, 0.0)) + delta

        record["last_seen_at"] = float(now)
        self._mark_dirty()
        return {
            "platform": platform,
            "event": event,
            "delta_seconds": delta,
            "daily_seconds": float(daily.get(day, 0.0)),
            "total_seconds": float(record.get("total_seconds", 0.0)),
        }

    def usage_today(self, platform: str, now: float) -> float:
        state = self.load()
        record = state.get("usage", {}).get(platform, {})
        return float(record.get("daily_seconds", {}).get(utc_day(now), 0.0))

    def flush(self) -> None:
        if not self._dirty or self._state is None:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(self.path.suffix + ".tmp")
        with tmp.open("w", encoding="utf-8") as file:
            json.dump(self._state, file, indent=2, sort_keys=True)
        os.replace(tmp, self.path)
        self._dirty = False
        self._last_flush = time.monotonic()

    def close(self) -> None:
        self.flush()

    def _mark_dirty(self) -> None:
        self._dirty = True
        if time.monotonic() - self._last_flush >= self._flush_seconds:
            self.flush()

    def _read_disk(self) -> dict[str, Any]:
        if not self.path.exists():
            return {}
        with self.path.open("r", encoding="utf-8") as file:
            return json.load(file)

    def _empty_usage_record(self) -> dict[str, Any]:
        return {
            "total_seconds": 0.0,
            "daily_seconds": {},
            "last_seen_at": None,
        }


def _flush_seconds_from_env() -> float:
    if "PRODUCTIVE_PROXY_STATE_FLUSH_SECONDS" not in os.environ:
        raise RuntimeError("Missing PRODUCTIVE_PROXY_STATE_FLUSH_SECONDS")
    value = float(os.environ["PRODUCTIVE_PROXY_STATE_FLUSH_SECONDS"])
    if value < 0:
        raise ValueError("PRODUCTIVE_PROXY_STATE_FLUSH_SECONDS must be >= 0")
    return value
