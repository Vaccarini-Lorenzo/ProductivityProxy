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
