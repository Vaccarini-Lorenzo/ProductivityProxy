import tempfile
import unittest
from pathlib import Path

from proxy.services.config.config_service import ConfigService
from proxy.models.runtime.context import RequestContext
from proxy.services.events.event_log import EventLog
from proxy.services.graph.evaluator import GraphEvaluator
from proxy.services.state.state_store import StateStore
from test.helpers.fakes import FakeFlow


class DefaultPolicyGraphTest(unittest.TestCase):
    def test_default_productivity_graph_blocks_youtube_shorts(self):
        with tempfile.TemporaryDirectory() as tmp:
            config = ConfigService(Path("src/proxy/defaults/default_config.json")).load()
            flow = FakeFlow("https://www.youtube.com/shorts/test")
            flow.request.pretty_host = "www.youtube.com"
            flow.request.path = "/shorts/test"
            context = RequestContext(
                flow=flow,
                config=config,
                state=StateStore(Path(tmp) / "state.json"),
                event_log=EventLog(Path(tmp) / "events.jsonl"),
            )

            GraphEvaluator(config).evaluate(context)

            self.assertEqual(flow.response.status_code, 403)

    def test_default_productivity_graph_blocks_reddit_after_limit(self):
        with tempfile.TemporaryDirectory() as tmp:
            config = ConfigService(Path("src/proxy/defaults/default_config.json")).load()
            store = StateStore(Path(tmp) / "state.json")
            store.save({
                "usage": {
                    "reddit": {
                        "total_seconds": 1800.0,
                        "daily_seconds": {"1970-01-01": 1800.0},
                        "last_seen_at": 2800.0,
                    }
                }
            })
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

            GraphEvaluator(config).evaluate(context)

            self.assertEqual(flow.response.status_code, 403)


if __name__ == "__main__":
    unittest.main()
