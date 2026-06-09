import tempfile
import unittest
from pathlib import Path

from proxy.models.policy.flow import AppConfig


def config_dict(node_path: str):
    return {
        "activeModeId": "mode",
        "modes": [
            {
                "id": "mode",
                "name": "Mode",
                "policies": [
                    {
                        "id": "policy",
                        "name": "Policy",
                        "steps": [
                            {"id": "start", "kind": "node", "type": "start"},
                            {"id": "custom", "kind": "node", "type": "custom-node"},
                            {"id": "choice", "kind": "operator", "type": "if", "params": {"code": "def if_condition(input):\n    return True"}},
                            {"id": "end", "kind": "node", "type": "end"},
                        ],
                        "edges": [
                            {"from": "start", "output": "next", "to": "custom"},
                            {"from": "custom", "output": "next", "to": "choice"},
                            {"from": "choice", "output": "then", "to": "end"},
                        ],
                    }
                ],
            }
        ],
        "customNodes": [{"id": "custom-node", "name": "Custom", "path": node_path}],
    }


class PolicyFlowTest(unittest.TestCase):
    def test_loads_active_mode_and_ordered_policies(self):
        with tempfile.TemporaryDirectory() as tmp:
            config = AppConfig.from_dict(config_dict(str(Path(tmp) / "node.py")))

        mode = config.active_mode()
        policy = mode.policies[0]

        self.assertEqual(mode.id, "mode")
        self.assertEqual(policy.start_step().id, "start")
        self.assertEqual(policy.next_step_id("choice", "then"), "end")
        self.assertIsNone(policy.next_step_id("choice", "else"))

    def test_rejects_relative_custom_node_path(self):
        with self.assertRaisesRegex(ValueError, "absolute"):
            AppConfig.from_dict(config_dict("relative.py"))

    def test_rejects_duplicate_routes(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw = config_dict(str(Path(tmp) / "node.py"))
            raw["modes"][0]["policies"][0]["edges"].append({"from": "choice", "output": "then", "to": "end"})

            with self.assertRaisesRegex(ValueError, "Duplicate route"):
                AppConfig.from_dict(raw)

    def test_requires_one_start_node(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw = config_dict(str(Path(tmp) / "node.py"))
            raw["modes"][0]["policies"][0]["steps"] = [
                step for step in raw["modes"][0]["policies"][0]["steps"] if step["type"] != "start"
            ]

            with self.assertRaisesRegex(ValueError, "exactly one start"):
                AppConfig.from_dict(raw)


if __name__ == "__main__":
    unittest.main()
