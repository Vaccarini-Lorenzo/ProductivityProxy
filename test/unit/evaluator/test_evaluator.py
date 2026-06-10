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
                "def run(input, request, context, params):\n    return {'match': True, 'message': params['message']}\n",
                encoding="utf-8",
            )
            log_path = Path(tmp) / "log.py"
            log_path.write_text(
                textwrap.dedent(
                    """
                    def run(input, request, context, params):
                        context.log('seen', input['message'])
                        return input
                    """
                ),
                encoding="utf-8",
            )
            config = AppConfig.from_dict(
                {
                    "activeModeId": "mode",
                    "policies": [
                        {
                            "id": "policy",
                            "name": "Policy",
                            "steps": [
                                {"id": "start", "kind": "node", "type": "start"},
                                {"id": "detect", "kind": "node", "type": "detect", "params": {"message": "hello"}},
                                {"id": "choice", "kind": "operator", "type": "if", "params": {"code": "def if_condition(input):\n    return input['match']"}},
                                {"id": "log", "kind": "node", "type": "log"},
                                {"id": "end", "kind": "node", "type": "end"},
                            ],
                            "edges": [
                                {"from": "start", "output": "next", "to": "detect"},
                                {"from": "detect", "output": "next", "to": "choice"},
                                {"from": "choice", "output": "then", "to": "log"},
                                {"from": "choice", "output": "else", "to": "end"},
                                {"from": "log", "output": "next", "to": "end"},
                            ],
                        }
                    ],
                    "modes": [{"id": "mode", "name": "Mode", "policyIds": ["policy"]}],
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

            context.event_log.flush()
            self.assertIn("hello", event_path.read_text(encoding="utf-8"))

    def test_start_node_uses_triggered_by_python_function(self):
        with tempfile.TemporaryDirectory() as tmp:
            block_path = Path(tmp) / "block.py"
            block_path.write_text(
                "def run(input, request, context, params):\n    request.block(403, 'blocked')\n    return input\n",
                encoding="utf-8",
            )
            config = AppConfig.from_dict(
                {
                    "activeModeId": "mode",
                    "policies": [
                        {
                            "id": "policy",
                            "name": "Policy",
                            "steps": [
                                {
                                    "id": "start",
                                    "kind": "node",
                                    "type": "start",
                                    "params": {
                                        "code": "def triggered_by(request: Request) -> bool:\n    return request.host == 'work.test'\n"
                                    },
                                },
                                {"id": "block", "kind": "node", "type": "block"},
                            ],
                            "edges": [{"from": "start", "output": "next", "to": "block"}],
                        }
                    ],
                    "modes": [{"id": "mode", "name": "Mode", "policyIds": ["policy"]}],
                    "customNodes": [{"id": "block", "name": "Block", "path": str(block_path)}],
                }
            )
            evaluator = PolicyEvaluator(config)
            skipped = context_for(tmp, config, "play.test")
            matched = context_for(tmp, config, "work.test")

            evaluator.evaluate(skipped)
            evaluator.evaluate(matched)

            self.assertIsNone(skipped.flow.response)
            self.assertEqual(matched.flow.response.status_code, 403)

    def test_stops_ordered_mode_after_response_is_set(self):
        with tempfile.TemporaryDirectory() as tmp:
            block_path = Path(tmp) / "block.py"
            block_path.write_text(
                "def run(input, request, context, params):\n    request.block(403, 'blocked')\n    return input\n",
                encoding="utf-8",
            )
            log_path = Path(tmp) / "log.py"
            log_path.write_text(
                "def run(input, request, context, params):\n    context.log('should_not_run', 'should not run')\n    return input\n",
                encoding="utf-8",
            )
            config = AppConfig.from_dict(
                {
                    "activeModeId": "mode",
                    "policies": [
                        simple_policy("first", "block"),
                        simple_policy("second", "log"),
                    ],
                    "modes": [{"id": "mode", "name": "Mode", "policyIds": ["first", "second"]}],
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

            context.event_log.flush()
            self.assertNotIn("should_not_run", event_path.read_text(encoding="utf-8"))

    def test_loop_guard_raises(self):
        config = AppConfig.from_dict(
            {
                "activeModeId": "mode",
                "policies": [
                    {
                        "id": "policy",
                        "name": "Policy",
                        "steps": [{"id": "start", "kind": "node", "type": "start"}],
                        "edges": [{"from": "start", "output": "next", "to": "start"}],
                    }
                ],
                "modes": [{"id": "mode", "name": "Mode", "policyIds": ["policy"]}],
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


def context_for(tmp: str, config: AppConfig, host: str) -> RequestContext:
    flow = FakeFlow(f"https://{host}/path")
    flow.request.pretty_host = host
    return RequestContext(
        flow=flow,
        config=config,
        state=StateStore(Path(tmp) / f"{host}.state.json"),
        event_log=EventLog(Path(tmp) / f"{host}.events.jsonl"),
    )


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
