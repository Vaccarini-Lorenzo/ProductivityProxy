import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from proxy.models.runtime.context import RequestContext
from proxy.services.events.event_log import EventLog
from proxy.services.policy.evaluator import PolicyEvaluator
from proxy.services.state.state_store import StateStore
from test.helpers.configs import materialized_default_config
from test.helpers.fakes import FakeFlow


class DefaultPolicyTest(unittest.TestCase):
    def test_default_productivity_policies_block_youtube_shorts(self):
        with tempfile.TemporaryDirectory() as tmp:
            config = materialized_default_config()
            flow = FakeFlow("https://www.youtube.com/shorts/test")
            flow.request.pretty_host = "www.youtube.com"
            flow.request.path = "/shorts/test"
            context = RequestContext(
                flow=flow,
                config=config,
                state=StateStore(Path(tmp) / "state.json"),
                event_log=EventLog(Path(tmp) / "events.jsonl"),
            )

            PolicyEvaluator(config).evaluate(context)

            self.assertEqual(flow.response.status_code, 403)

    def test_default_productivity_policies_do_not_block_regular_youtube(self):
        with tempfile.TemporaryDirectory() as tmp:
            config = materialized_default_config()
            flow = FakeFlow("https://www.youtube.com/watch?v=abc")
            flow.request.pretty_host = "www.youtube.com"
            flow.request.path = "/watch"
            context = RequestContext(
                flow=flow,
                config=config,
                state=StateStore(Path(tmp) / "state.json"),
                event_log=EventLog(Path(tmp) / "events.jsonl"),
            )

            PolicyEvaluator(config).evaluate(context)

            self.assertIsNone(flow.response)

    def test_default_productivity_policies_block_reddit_after_limit(self):
        with tempfile.TemporaryDirectory() as tmp:
            config = materialized_default_config()
            store = StateStore(Path(tmp) / "state.json")
            day = datetime.now(timezone.utc).date().isoformat()
            flow = FakeFlow("https://www.reddit.com/r/test")
            flow.request.pretty_host = "www.reddit.com"
            flow.request.path = "/r/test"
            context = RequestContext(
                flow=flow,
                config=config,
                state=store,
                event_log=EventLog(Path(tmp) / "events.jsonl"),
                now=lambda: 2800.0,
            )
            store.set_value("usage", {
                "reddit": {"total_seconds": 1800.0, "daily_seconds": {day: 1800.0}, "last_seen_at": None}
            })

            PolicyEvaluator(config).evaluate(context)

            self.assertEqual(flow.response.status_code, 403)


if __name__ == "__main__":
    unittest.main()
