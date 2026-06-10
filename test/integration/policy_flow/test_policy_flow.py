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


class PolicyFlowTest(unittest.TestCase):
    def test_custom_detection_track_time_limit_and_block_flow(self):
        with tempfile.TemporaryDirectory() as tmp:
            detect_path = write_node(
                tmp,
                "detect_reddit.py",
                """
                def run(input, context, params):
                    host = context.flow.request.pretty_host
                    return {'match': host.endswith('reddit.com'), 'platform': 'reddit'}
                """,
            )
            track_path = write_node(
                tmp,
                "track.py",
                """
                def run(input, context, params):
                    usage = context.state.track_usage(params['platform'], params['idleSeconds'], context.now())
                    return {**input, 'usage': usage}
                """,
            )
            limit_path = write_node(
                tmp,
                "limit.py",
                """
                def run(input, context, params):
                    used = context.state.usage_today(params['platform'], context.now())
                    return {**input, 'used': used, 'over_limit': used >= params['seconds']}
                """,
            )
            block_path = write_node(
                tmp,
                "block.py",
                """
                class Response:
                    def __init__(self, status_code, content):
                        self.status_code = status_code
                        self.content = content

                def run(input, context, params):
                    context.flow.response = Response(params['status'], params['message'].encode('utf-8'))
                    return input
                """,
            )
            config = AppConfig.from_dict(
                {
                    "activeModeId": "productivity",
                    "policies": [
                        {
                            "id": "reddit-limit",
                            "name": "Reddit limit",
                            "steps": [
                                {"id": "start", "kind": "node", "type": "start"},
                                {"id": "detect", "kind": "node", "type": "detect-reddit"},
                                {"id": "is-reddit", "kind": "operator", "type": "if", "params": {"code": "def if_condition(input):\n    return input['match']"}},
                                {"id": "track", "kind": "node", "type": "track", "params": {"platform": "reddit", "idleSeconds": 9999}},
                                {"id": "limit", "kind": "node", "type": "limit", "params": {"platform": "reddit", "seconds": 1800}},
                                {"id": "is-over", "kind": "operator", "type": "if", "params": {"code": "def if_condition(input):\n    return input['over_limit']"}},
                                {"id": "block", "kind": "node", "type": "block", "params": {"status": 403, "message": "Reddit limit reached"}},
                                {"id": "end", "kind": "node", "type": "end"},
                            ],
                            "edges": [
                                {"from": "start", "output": "next", "to": "detect"},
                                {"from": "detect", "output": "next", "to": "is-reddit"},
                                {"from": "is-reddit", "output": "then", "to": "track"},
                                {"from": "is-reddit", "output": "else", "to": "end"},
                                {"from": "track", "output": "next", "to": "limit"},
                                {"from": "limit", "output": "next", "to": "is-over"},
                                {"from": "is-over", "output": "then", "to": "block"},
                                {"from": "is-over", "output": "else", "to": "end"},
                            ],
                        }
                    ],
                    "modes": [
                        {"id": "productivity", "name": "Productivity", "policyIds": ["reddit-limit"]}
                    ],
                    "customNodes": [
                        {"id": "detect-reddit", "name": "Detect Reddit", "path": str(detect_path)},
                        {"id": "track", "name": "Track", "path": str(track_path)},
                        {"id": "limit", "name": "Limit", "path": str(limit_path)},
                        {"id": "block", "name": "Block", "path": str(block_path)},
                    ],
                }
            )
            store = StateStore(Path(tmp) / "state.json")
            store.track_usage("reddit", idle_seconds=9999, now=1000.0)
            flow = FakeFlow("https://www.reddit.com/r/test")
            flow.request.pretty_host = "www.reddit.com"
            context = RequestContext(
                flow=flow,
                config=config,
                state=store,
                event_log=EventLog(Path(tmp) / "events.jsonl"),
                now=lambda: 2800.0,
            )

            PolicyEvaluator(config).evaluate(context)

            self.assertEqual(flow.response.status_code, 403)
            self.assertIn(b"Reddit limit reached", flow.response.content)
            self.assertEqual(store.usage_today("reddit", 2800.0), 1800.0)


def write_node(tmp: str, name: str, code: str) -> Path:
    path = Path(tmp) / name
    path.write_text(textwrap.dedent(code), encoding="utf-8")
    return path


if __name__ == "__main__":
    unittest.main()
