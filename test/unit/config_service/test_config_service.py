import json
import tempfile
import unittest
from pathlib import Path

from proxy.services.config.config_service import ConfigService
from proxy.services.config.validation import validate_config


class ConfigServiceTest(unittest.TestCase):
    def test_loads_app_config_from_json_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "config.json"
            path.write_text(
                json.dumps(
                    {
                        "activeModeId": "mode",
                        "policies": [
                            {
                                "id": "policy",
                                "name": "Policy",
                                "steps": [{"id": "start", "kind": "node", "type": "start"}],
                                "edges": [],
                            }
                        ],
                        "modes": [{"id": "mode", "name": "Mode", "policyIds": ["policy"]}],
                        "customNodes": [],
                    }
                ),
                encoding="utf-8",
            )

            config = ConfigService(path).load()

            self.assertEqual(config.active_mode().id, "mode")

    def test_load_rebases_builtin_node_paths(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "config.json"
            path.write_text(
                json.dumps(
                    {
                        "activeModeId": "mode",
                        "policies": [
                            {
                                "id": "policy",
                                "name": "Policy",
                                "steps": [{"id": "start", "kind": "node", "type": "start"}],
                                "edges": [],
                            }
                        ],
                        "modes": [{"id": "mode", "name": "Mode", "policyIds": ["policy"]}],
                        "customNodes": [
                            {"id": "block-response", "name": "Block", "path": "/old/repo/block_response.py"},
                            {"id": "custom", "name": "Custom", "path": "/custom/node.py"},
                        ],
                    }
                ),
                encoding="utf-8",
            )

            config = ConfigService(path).load()
            paths = {node.id: node.path for node in config.custom_nodes}

            self.assertTrue(paths["block-response"].endswith("src/proxy/defaults/nodes/block_response.py"))
            self.assertEqual(paths["custom"], "/custom/node.py")

    def test_validates_app_specific_routing_requires_an_app(self):
        raw = {
            "activeModeId": "mode",
            "proxy": {"localRoutingMode": "appSpecific", "appCaptureTargets": []},
            "policies": [{"id": "policy", "steps": [{"id": "start", "kind": "node", "type": "start"}], "edges": []}],
            "modes": [{"id": "mode", "name": "Mode", "policyIds": ["policy"]}],
            "customNodes": [],
        }

        messages = [issue["message"] for issue in validate_config(raw)]

        self.assertIn("App-specific routing needs at least one app.", messages)

    def test_accepts_non_overlapping_and_overnight_default_times(self):
        raw = {
            "activeModeId": "focus",
            "policies": [],
            "modes": [
                {"id": "focus", "name": "Focus", "policyIds": [], "defaultTime": {"start": "09:00", "end": "17:00"}},
                {"id": "rest", "name": "Rest", "policyIds": [], "defaultTime": {"start": "17:00", "end": "09:00"}},
            ],
            "customNodes": [],
        }

        self.assertEqual(validate_config(raw), [])

    def test_rejects_overlapping_default_times(self):
        raw = {
            "activeModeId": "focus",
            "policies": [],
            "modes": [
                {"id": "focus", "name": "Focus", "policyIds": [], "defaultTime": {"start": "09:00", "end": "17:00"}},
                {"id": "rest", "name": "Rest", "policyIds": [], "defaultTime": {"start": "16:00", "end": "22:00"}},
            ],
            "customNodes": [],
        }

        messages = [issue["message"] for issue in validate_config(raw)]

        self.assertIn("Default times overlap for 'Focus' and 'Rest'.", messages)

    def test_rejects_equal_default_start_and_end(self):
        raw = {
            "activeModeId": "focus",
            "policies": [],
            "modes": [{"id": "focus", "name": "Focus", "policyIds": [], "defaultTime": {"start": "09:00", "end": "09:00"}}],
            "customNodes": [],
        }

        messages = [issue["message"] for issue in validate_config(raw)]

        self.assertIn("Mode 'Focus' default start and end times must differ.", messages)

    def test_validates_registered_node_required_params(self):
        raw = {
            "activeModeId": "mode",
            "policies": [
                {
                    "id": "policy",
                    "name": "Policy",
                    "steps": [
                        {"id": "start", "kind": "node", "type": "start"},
                        {"id": "block", "kind": "node", "type": "block-response", "params": {"status": 403}},
                    ],
                    "edges": [{"from": "start", "output": "next", "to": "block"}],
                }
            ],
            "modes": [{"id": "mode", "name": "Mode", "policyIds": ["policy"]}],
            "customNodes": [{"id": "block-response", "name": "Block", "path": "/tmp/block.py"}],
        }

        messages = [issue["message"] for issue in validate_config(raw)]

        self.assertIn("Step 'block' is missing param: message", messages)


if __name__ == "__main__":
    unittest.main()
