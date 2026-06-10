import json
import os
import tempfile
import textwrap
import time
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

            controller.event_log.flush()
            self.assertIn("controller_seen", event_path.read_text(encoding="utf-8"))

    def test_reloads_config_when_file_changes(self):
        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "config.json"
            block_path = Path(tmp) / "block.py"
            block_path.write_text(
                "def run(input, context, params):\n    context.flow.response = 'blocked'\n    return input\n",
                encoding="utf-8",
            )
            config_path.write_text(json.dumps(_config("work", str(block_path))), encoding="utf-8")

            controller = PolicyProxyController()
            controller.configure(config_path, Path(tmp) / "state.json", Path(tmp) / "events.jsonl")

            blocked = FakeFlow()
            controller.request(blocked)
            self.assertIsNotNone(blocked.response)

            config_path.write_text(json.dumps(_config("off", str(block_path))), encoding="utf-8")
            future = time.time() + 5
            os.utime(config_path, (future, future))

            allowed = FakeFlow()
            controller.request(allowed)
            controller.close()

            self.assertIsNone(allowed.response)


def _config(active_mode_id: str, block_path: str) -> dict:
    return {
        "activeModeId": active_mode_id,
        "policies": [
            {
                "id": "p",
                "name": "P",
                "steps": [
                    {"id": "start", "kind": "node", "type": "start"},
                    {"id": "block", "kind": "node", "type": "block"},
                ],
                "edges": [{"from": "start", "output": "next", "to": "block"}],
            }
        ],
        "modes": [
            {"id": "work", "name": "Work", "policyIds": ["p"]},
            {"id": "off", "name": "Off", "policyIds": []},
        ],
        "customNodes": [{"id": "block", "name": "Block", "path": block_path}],
    }


if __name__ == "__main__":
    unittest.main()
