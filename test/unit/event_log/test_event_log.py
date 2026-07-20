import tempfile
import threading
import unittest
from pathlib import Path

from proxy.services.events.event_log import EventLog


class EventLogTest(unittest.TestCase):
    def test_appends_and_reads_recent_events(self):
        with tempfile.TemporaryDirectory() as tmp:
            log = EventLog(Path(tmp) / "nested" / "events.jsonl")

            log.append({"type": "first"})
            log.append({"type": "second"})
            log.append({"type": "third"})

            recent = log.read_recent(2)

        self.assertEqual([event["type"] for event in recent], ["second", "third"])

    def test_drops_new_events_when_queue_is_full(self):
        started = threading.Event()
        release = threading.Event()

        class BlockingValue:
            def __str__(self):
                started.set()
                release.wait(timeout=2)
                return "ready"

        with tempfile.TemporaryDirectory() as tmp:
            log = EventLog(Path(tmp) / "events.jsonl", max_queue_items=1)
            log.append({"type": "first", "value": BlockingValue()})
            self.assertTrue(started.wait(timeout=1))
            log.append({"type": "second"})
            log.append({"type": "dropped"})
            release.set()

            events = log.read_recent(10)
            log.close()

        self.assertEqual([event["type"] for event in events], ["first", "second"])

    def test_compacts_file_to_stay_within_byte_budget(self):
        with tempfile.TemporaryDirectory() as tmp:
            log = EventLog(Path(tmp) / "events.jsonl", max_bytes=500)

            for index in range(200):
                log.append({"type": "event", "index": index})
            log.flush()

            size = (Path(tmp) / "events.jsonl").stat().st_size
            recent = log.read_recent(1)

        self.assertLessEqual(size, 500)
        self.assertEqual(recent[0]["index"], 199)


if __name__ == "__main__":
    unittest.main()
