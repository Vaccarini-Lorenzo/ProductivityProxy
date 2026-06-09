import json
import tempfile
import unittest
from pathlib import Path

from proxy.controller.mitmproxy.graph_controller import GraphProxyController
from tests.proxy_engine.fakes import FakeFlow


class GraphProxyControllerTest(unittest.TestCase):
    def test_configures_paths_and_evaluates_request_graph(self):
        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "config.json"
            state_path = Path(tmp) / "state.json"
            event_path = Path(tmp) / "events.jsonl"
            config_path.write_text(
                json.dumps(
                    {
                        "activeModeId": "mode",
                        "modes": [
                            {
                                "id": "mode",
                                "name": "Mode",
                                "graph": {
                                    "nodes": [
                                        {"id": "start", "type": "start"},
                                        {"id": "log", "type": "log", "params": {"eventType": "controller_seen"}},
                                    ],
                                    "edges": [{"from": "start", "output": "next", "to": "log"}],
                                },
                            }
                        ],
                        "customBlocks": [],
                    }
                ),
                encoding="utf-8",
            )
            controller = GraphProxyController()
            controller.configure(config_path, state_path, event_path)

            controller.request(FakeFlow("https://example.com"))

            self.assertIn("controller_seen", event_path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
