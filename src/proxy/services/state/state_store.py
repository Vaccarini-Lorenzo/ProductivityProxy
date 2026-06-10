from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def utc_day(timestamp: float) -> str:
    return datetime.fromtimestamp(timestamp, timezone.utc).date().isoformat()


class StateStore:
    def __init__(self, path: Path):
        self.path = Path(path)

    def load(self) -> dict[str, Any]:
        if not self.path.exists():
            return {}
        with self.path.open("r", encoding="utf-8") as file:
            return json.load(file)

    def save(self, state: dict[str, Any]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("w", encoding="utf-8") as file:
            json.dump(state, file, indent=2, sort_keys=True)

    def get_value(self, key: str) -> Any:
        state = self.load()
        if key not in state:
            raise KeyError(key)
        return state[key]

    def set_value(self, key: str, value: Any) -> None:
        json.dumps(value)
        state = self.load()
        state[key] = value
        self.save(state)

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
        self.save(state)
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

    def _empty_usage_record(self) -> dict[str, Any]:
        return {
            "total_seconds": 0.0,
            "daily_seconds": {},
            "last_seen_at": None,
        }
