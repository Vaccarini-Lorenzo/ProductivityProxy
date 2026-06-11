import json
import tempfile
import textwrap
import unittest
from pathlib import Path

from proxy.controller.mitmproxy.policy_controller import PolicyProxyController
from proxy.models.policy.flow import AppConfig
from proxy.models.runtime.context import RequestContext
from proxy.services.events.event_log import EventLog
from proxy.services.policy.evaluator import PolicyEvaluator
from proxy.services.state.state_store import StateStore
from test.helpers.fakes import FakeFlow


class ObservabilityTest(unittest.TestCase):
    def test_emits_policy_trace_and_custom_node_logs(self):
        with tempfile.TemporaryDirectory() as tmp:
            node_path = Path(tmp) / "custom.py"
            node_path.write_text(
                textwrap.dedent(
                    """
                    def run(input, request, context, params):
                        context.log("custom_node_log", "custom node saw request", value=params["value"])
                        return {"match": True}
                    """
                ),
                encoding="utf-8",
            )
            config = AppConfig.from_dict(config_raw(node_path))
            event_path = Path(tmp) / "events.jsonl"
            context = RequestContext(
                flow=FakeFlow("https://example.com/path"),
                config=config,
                state=StateStore(Path(tmp) / "state.json"),
                event_log=EventLog(event_path),
                request_id="request-1",
            )

            PolicyEvaluator(config, max_steps=10, verbose=True).evaluate(context)

            context.event_log.flush()
            events = read_events(event_path)
            custom = first_event(events, "custom_node_log")
            step = first_event(events, "policy_step")
            finished = first_event(events, "request_finished")

            self.assertEqual(custom["category"], "custom_node")
            self.assertEqual(custom["policyId"], "policy")
            self.assertEqual(custom["stepId"], "custom")
            self.assertEqual(custom["requestId"], "request-1")
            self.assertEqual(custom["data"], {"value": "ok"})
            self.assertEqual(step["policyId"], "policy")
            self.assertEqual(finished["outcome"], "allowed")

    def test_request_finished_reports_request_bytes(self):
        with tempfile.TemporaryDirectory() as tmp:
            node_path = Path(tmp) / "custom.py"
            node_path.write_text("def run(input, request, context, params):\n    return input\n", encoding="utf-8")
            config = AppConfig.from_dict(config_raw(node_path))
            event_path = Path(tmp) / "events.jsonl"
            flow = FakeFlow("https://example.com/path")
            flow.request.content = b"hello"
            flow.request.headers = {"x": "yz"}
            context = RequestContext(
                flow=flow,
                config=config,
                state=StateStore(Path(tmp) / "state.json"),
                event_log=EventLog(event_path),
                request_id="request-1",
            )

            PolicyEvaluator(config, max_steps=10, verbose=False).evaluate(context)

            context.event_log.flush()
            finished = first_event(read_events(event_path), "request_finished")
            # body (5) + header "x":"yz" (1 + 2 + 4 for ": " and CRLF)
            self.assertEqual(finished["requestBytes"], 12)
            self.assertIsInstance(finished["evalMs"], (int, float))
            self.assertGreaterEqual(finished["evalMs"], 0)

    def test_controller_logs_rejected_config(self):
        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "config.json"
            event_path = Path(tmp) / "events.jsonl"
            config_path.write_text(
                json.dumps({"activeModeId": "missing", "modes": [], "customNodes": []}),
                encoding="utf-8",
            )

            with self.assertRaisesRegex(ValueError, "Unknown active mode"):
                PolicyProxyController().configure(config_path, Path(tmp) / "state.json", event_path)

            event = first_event(read_events(event_path), "config_rejected")
            self.assertEqual(event["level"], "error")
            self.assertIn("Unknown active mode", event["error"])


def config_raw(node_path: Path) -> dict:
    return {
        "activeModeId": "mode",
        "policies": [
            {
                "id": "policy",
                "name": "Policy",
                "steps": [
                    {"id": "start", "kind": "node", "type": "start"},
                    {"id": "custom", "kind": "node", "type": "custom-node", "params": {"value": "ok"}},
                    {"id": "end", "kind": "node", "type": "end"},
                ],
                "edges": [
                    {"from": "start", "output": "next", "to": "custom"},
                    {"from": "custom", "output": "next", "to": "end"},
                ],
            }
        ],
        "modes": [{"id": "mode", "name": "Mode", "policyIds": ["policy"]}],
        "customNodes": [{"id": "custom-node", "name": "Custom", "path": str(node_path)}],
    }


def read_events(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]


def first_event(events: list[dict], event_type: str) -> dict:
    for event in events:
        if event.get("type") == event_type:
            return event
    raise AssertionError(f"Missing event: {event_type}")


if __name__ == "__main__":
    unittest.main()
