import unittest

from proxy.models.graph.policy_graph import AppConfig


class PolicyGraphTest(unittest.TestCase):
    def test_loads_active_mode_and_routes_by_output(self):
        config = AppConfig.from_dict(
            {
                "activeModeId": "productivity",
                "proxy": {"port": 8080},
                "modes": [
                    {
                        "id": "productivity",
                        "name": "Productivity",
                        "graph": {
                            "nodes": [
                                {"id": "start", "type": "start"},
                                {"id": "yes", "type": "log"},
                                {"id": "fallback", "type": "end"},
                            ],
                            "edges": [
                                {"from": "start", "output": "match", "to": "yes"},
                                {"from": "start", "output": "*", "to": "fallback"},
                            ],
                        },
                    }
                ],
                "customBlocks": [],
            }
        )

        graph = config.active_mode().graph

        self.assertEqual(graph.start_node().id, "start")
        self.assertEqual(graph.next_node_id("start", "match"), "yes")
        self.assertEqual(graph.next_node_id("start", "miss"), "fallback")
        self.assertIsNone(graph.next_node_id("yes", "next"))

    def test_rejects_missing_active_mode(self):
        with self.assertRaises(ValueError):
            AppConfig.from_dict(
                {
                    "activeModeId": "missing",
                    "modes": [{"id": "other", "name": "Other", "graph": {"nodes": [], "edges": []}}],
                }
            )

    def test_requires_one_start_node(self):
        with self.assertRaises(ValueError):
            AppConfig.from_dict(
                {
                    "activeModeId": "mode",
                    "modes": [
                        {
                            "id": "mode",
                            "name": "Mode",
                            "graph": {
                                "nodes": [
                                    {"id": "a", "type": "start"},
                                    {"id": "b", "type": "start"},
                                ],
                                "edges": [],
                            },
                        }
                    ],
                }
            )


if __name__ == "__main__":
    unittest.main()
