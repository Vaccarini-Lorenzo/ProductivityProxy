import tempfile
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


if __name__ == "__main__":
    unittest.main()
