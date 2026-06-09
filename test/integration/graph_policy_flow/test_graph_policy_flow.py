import tempfile
import textwrap
import unittest
from pathlib import Path

from proxy.models.graph.policy_graph import AppConfig
from proxy.models.runtime.context import RequestContext
from proxy.services.events.event_log import EventLog
from proxy.services.graph.evaluator import GraphEvaluator
from proxy.services.state.state_store import StateStore
from test.helpers.fakes import FakeFlow


class GraphPolicyFlowTest(unittest.TestCase):
    def test_custom_detection_track_time_limit_and_block_flow(self):
        with tempfile.TemporaryDirectory() as tmp:
            detect_path = Path(tmp) / "detect_reddit.py"
            detect_path.write_text(
                textwrap.dedent(
                    """
                    def run(context, params):
                        host = context.flow.request.pretty_host
                        if host.endswith("reddit.com"):
                            return {"output": "match", "data": {"platform": "reddit"}}
                        return {"output": "no_match"}
                    """
                ),
                encoding="utf-8",
            )
            limit_path = Path(tmp) / "limit.py"
            limit_path.write_text(
                textwrap.dedent(
                    """
                    def run(context, params):
                        used = context.state.usage_today(params["platform"], context.now())
                        if used >= params["seconds"]:
                            return {"output": "over", "data": {"used": used}}
                        return {"output": "under", "data": {"used": used}}
                    """
                ),
                encoding="utf-8",
            )
            config = AppConfig.from_dict(
                {
                    "activeModeId": "productivity",
                    "modes": [
                        {
                            "id": "productivity",
                            "name": "Productivity",
                            "graph": {
                                "nodes": [
                                    {"id": "start", "type": "start"},
                                    {"id": "detect", "type": "python", "params": {"blockId": "detect-reddit"}},
                                    {
                                        "id": "track",
                                        "type": "track_time",
                                        "params": {"platform": "reddit", "idleSeconds": 9999},
                                    },
                                    {
                                        "id": "limit",
                                        "type": "python",
                                        "params": {"blockId": "limit", "platform": "reddit", "seconds": 1800},
                                    },
                                    {"id": "block", "type": "block", "params": {"message": "Reddit limit reached"}},
                                    {"id": "end", "type": "end"},
                                ],
                                "edges": [
                                    {"from": "start", "output": "next", "to": "detect"},
                                    {"from": "detect", "output": "match", "to": "track"},
                                    {"from": "detect", "output": "no_match", "to": "end"},
                                    {"from": "track", "output": "next", "to": "limit"},
                                    {"from": "limit", "output": "over", "to": "block"},
                                    {"from": "limit", "output": "under", "to": "end"},
                                ],
                            },
                        }
                    ],
                    "customBlocks": [
                        {"id": "detect-reddit", "name": "Detect Reddit", "path": str(detect_path), "entrypoint": "run"},
                        {"id": "limit", "name": "Limit", "path": str(limit_path), "entrypoint": "run"},
                    ],
                }
            )
            store = StateStore(Path(tmp) / "state.json")
            store.track_usage("reddit", idle_seconds=9999, now=1000.0)
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
            self.assertIn(b"Reddit limit reached", flow.response.content)
            self.assertEqual(store.usage_today("reddit", 2800.0), 1800.0)


if __name__ == "__main__":
    unittest.main()
