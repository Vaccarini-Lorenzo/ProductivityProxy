import json
import tempfile
import textwrap
import unittest
from pathlib import Path

from proxy.controller.mitmproxy.policy_controller import PolicyProxyController
from test.helpers.fakes import FakeFlow


class PolicyProxyControllerTest(unittest.TestCase):
    def test_configures_paths_and_evaluates_request_policy(self):
        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "config.json"
            state_path = Path(tmp) / "state.json"
            event_path = Path(tmp) / "events.jsonl"
            node_path = Path(tmp) / "log.py"
            node_path.write_text(
                textwrap.dedent(
                    """
                    def run(input, context, params):
                        context.event_log.append({'type': 'controller_seen'})
                        return input
                    """
                ),
                encoding="utf-8",
            )
            config_path.write_text(
                json.dumps(
                    {
                        "activeModeId": "mode",
                        "policies": [
                            {
                                "id": "policy",
                                "name": "Policy",
                                "steps": [
                                    {"id": "start", "kind": "node", "type": "start"},
                                    {"id": "log", "kind": "node", "type": "log-event"},
                                ],
                                "edges": [{"from": "start", "output": "next", "to": "log"}],
                            }
                        ],
                        "modes": [{"id": "mode", "name": "Mode", "policyIds": ["policy"]}],
                        "customNodes": [{"id": "log-event", "name": "Log", "path": str(node_path)}],
                    }
                ),
                encoding="utf-8",
            )
            controller = PolicyProxyController()
            controller.configure(config_path, state_path, event_path)

            controller.request(FakeFlow("https://example.com"))

            self.assertIn("controller_seen", event_path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
