import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from proxy.services.state.state_store import StateStore


class StateStoreTest(unittest.TestCase):
    def test_persistent_key_value_store_round_trips_json_data(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = StateStore(Path(tmp) / "state.json")

            store.set_value("settings", {"enabled": True, "count": 2})

            self.assertEqual(store.get_value("settings"), {"enabled": True, "count": 2})

    def test_persistent_key_value_store_rejects_non_json_data(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = StateStore(Path(tmp) / "state.json")

            with self.assertRaises(TypeError):
                store.set_value("bad", {"value": object()})

    def test_persistent_key_value_store_raises_for_missing_key(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = StateStore(Path(tmp) / "state.json")

            with self.assertRaises(KeyError):
                store.get_value("missing")

    def test_tracks_usage_when_request_gap_is_within_idle_window(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = StateStore(Path(tmp) / "state.json")

            first = store.track_usage("reddit", idle_seconds=300, now=1000.0)
            second = store.track_usage("reddit", idle_seconds=300, now=1060.0)

            self.assertEqual(first["event"], "session_start")
            self.assertEqual(second["event"], "activity")
            self.assertEqual(second["delta_seconds"], 60.0)
            self.assertEqual(store.usage_today("reddit", 1060.0), 60.0)

    def test_starts_new_session_when_gap_exceeds_idle_window(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = StateStore(Path(tmp) / "state.json")

            store.track_usage("reddit", idle_seconds=10, now=1000.0)
            result = store.track_usage("reddit", idle_seconds=10, now=1020.0)

            self.assertEqual(result["event"], "session_start")
            self.assertEqual(result["delta_seconds"], 0.0)
            self.assertEqual(store.usage_today("reddit", 1020.0), 0.0)

    def test_uses_utc_day_bucket(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = StateStore(Path(tmp) / "state.json")
            now = datetime(2026, 6, 9, 12, 0, tzinfo=timezone.utc).timestamp()

            store.track_usage("reddit", idle_seconds=300, now=now)
            store.track_usage("reddit", idle_seconds=300, now=now + 30)
            state = store.load()

            self.assertEqual(state["usage"]["reddit"]["daily_seconds"]["2026-06-09"], 30.0)


if __name__ == "__main__":
    unittest.main()
