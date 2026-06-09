import tempfile
import textwrap
import unittest
from pathlib import Path

from proxy.models.policy.flow import AppConfig
from proxy.models.runtime.context import RequestContext
from proxy.services.events.event_log import EventLog
from proxy.services.policy.evaluator import PolicyEvaluator
from proxy.services.state.state_store import StateStore
from test.helpers.fakes import FakeFlow


class PolicyEvaluatorTest(unittest.TestCase):
    def test_passes_custom_node_output_to_operator_and_next_node(self):
        with tempfile.TemporaryDirectory() as tmp:
            detect_path = Path(tmp) / "detect.py"
            detect_path.write_text(
                "def run(input, context, params):\n    return {'match': True, 'message': params['message']}\n",
                encoding="utf-8",
            )
            log_path = Path(tmp) / "log.py"
            log_path.write_text(
                textwrap.dedent(
                    """
                    def run(input, context, params):
                        context.event_log.append({'type': 'seen', 'message': input['message']})
                        return input
                    """
                ),
                encoding="utf-8",
            )
            config = AppConfig.from_dict(
                {
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
                                        {"id": "detect", "kind": "node", "type": "detect", "params": {"message": "hello"}},
                                        {"id": "choice", "kind": "operator", "type": "if", "params": {"path": "match"}},
                                        {"id": "log", "kind": "node", "type": "log"},
                                        {"id": "end", "kind": "node", "type": "end"},
                                    ],
                                    "edges": [
                                        {"from": "start", "output": "next", "to": "detect"},
                                        {"from": "detect", "output": "next", "to": "choice"},
                                        {"from": "choice", "output": "true", "to": "log"},
                                        {"from": "choice", "output": "false", "to": "end"},
                                        {"from": "log", "output": "next", "to": "end"},
                                    ],
                                }
                            ],
                        }
                    ],
                    "customNodes": [
                        {"id": "detect", "name": "Detect", "path": str(detect_path)},
                        {"id": "log", "name": "Log", "path": str(log_path)},
                    ],
                }
            )
            event_path = Path(tmp) / "events.jsonl"
            context = RequestContext(
                flow=FakeFlow(),
                config=config,
                state=StateStore(Path(tmp) / "state.json"),
                event_log=EventLog(event_path),
            )

            PolicyEvaluator(config).evaluate(context)

            self.assertIn("hello", event_path.read_text(encoding="utf-8"))

    def test_stops_ordered_mode_after_response_is_set(self):
        with tempfile.TemporaryDirectory() as tmp:
            block_path = Path(tmp) / "block.py"
            block_path.write_text(
                "def run(input, context, params):\n    context.flow.response = 'blocked'\n    return input\n",
                encoding="utf-8",
            )
            log_path = Path(tmp) / "log.py"
            log_path.write_text(
                "def run(input, context, params):\n    context.event_log.append({'type': 'should_not_run'})\n    return input\n",
                encoding="utf-8",
            )
            config = AppConfig.from_dict(
                {
                    "activeModeId": "mode",
                    "modes": [
                        {
                            "id": "mode",
                            "name": "Mode",
                            "policies": [
                                simple_policy("first", "block"),
                                simple_policy("second", "log"),
                            ],
                        }
                    ],
                    "customNodes": [
                        {"id": "block", "name": "Block", "path": str(block_path)},
                        {"id": "log", "name": "Log", "path": str(log_path)},
                    ],
                }
            )
            event_path = Path(tmp) / "events.jsonl"
            context = RequestContext(
                flow=FakeFlow(),
                config=config,
                state=StateStore(Path(tmp) / "state.json"),
                event_log=EventLog(event_path),
            )

            PolicyEvaluator(config).evaluate(context)

            self.assertNotIn("should_not_run", event_path.read_text(encoding="utf-8"))

    def test_loop_guard_raises(self):
        config = AppConfig.from_dict(
            {
                "activeModeId": "mode",
                "modes": [
                    {
                        "id": "mode",
                        "name": "Mode",
                        "policies": [
                            {
                                "id": "policy",
                                "name": "Policy",
                                "steps": [{"id": "start", "kind": "node", "type": "start"}],
                                "edges": [{"from": "start", "output": "next", "to": "start"}],
                            }
                        ],
                    }
                ],
                "customNodes": [],
            }
        )
        with tempfile.TemporaryDirectory() as tmp:
            context = RequestContext(
                flow=FakeFlow(),
                config=config,
                state=StateStore(Path(tmp) / "state.json"),
                event_log=EventLog(Path(tmp) / "events.jsonl"),
            )
            with self.assertRaisesRegex(RuntimeError, "max steps"):
                PolicyEvaluator(config, max_steps=2).evaluate(context)


def simple_policy(policy_id: str, node_type: str):
    return {
        "id": policy_id,
        "name": policy_id,
        "steps": [
            {"id": f"{policy_id}-start", "kind": "node", "type": "start"},
            {"id": f"{policy_id}-node", "kind": "node", "type": node_type},
        ],
        "edges": [{"from": f"{policy_id}-start", "output": "next", "to": f"{policy_id}-node"}],
    }


if __name__ == "__main__":
    unittest.main()
