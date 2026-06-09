import tempfile
import unittest
from pathlib import Path

from proxy.models.graph.policy_graph import AppConfig
from proxy.models.runtime.context import RequestContext
from proxy.services.events.event_log import EventLog
from proxy.services.graph.evaluator import GraphEvaluator
from proxy.services.state.state_store import StateStore
from test.helpers.fakes import FakeFlow


class GraphEvaluatorTest(unittest.TestCase):
    def test_evaluates_nodes_and_routes_by_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            config = AppConfig.from_dict(
                {
                    "activeModeId": "mode",
                    "modes": [
                        {
                            "id": "mode",
                            "name": "Mode",
                            "graph": {
                                "nodes": [
                                    {"id": "start", "type": "start"},
                                    {"id": "log", "type": "log", "params": {"eventType": "seen"}},
                                    {"id": "if", "type": "if", "params": {"key": "shouldBlock", "equals": True}},
                                    {"id": "block", "type": "block", "params": {"message": "blocked"}},
                                    {"id": "end", "type": "end"},
                                ],
                                "edges": [
                                    {"from": "start", "output": "next", "to": "log"},
                                    {"from": "log", "output": "next", "to": "if"},
                                    {"from": "if", "output": "true", "to": "block"},
                                    {"from": "if", "output": "false", "to": "end"},
                                ],
                            },
                        }
                    ],
                    "customBlocks": [],
                }
            )
            context = RequestContext(
                flow=FakeFlow(),
                config=config,
                state=StateStore(Path(tmp) / "state.json"),
                event_log=EventLog(Path(tmp) / "events.jsonl"),
                data={"shouldBlock": True},
            )

            GraphEvaluator(config).evaluate(context)

            self.assertEqual(context.flow.response.status_code, 403)
            self.assertEqual(context.event_log.read_recent(1)[0]["type"], "seen")


if __name__ == "__main__":
    unittest.main()
