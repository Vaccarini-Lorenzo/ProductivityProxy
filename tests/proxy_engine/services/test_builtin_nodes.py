import tempfile
import unittest
from pathlib import Path

from proxy.models.graph.policy_graph import AppConfig, GraphNode
from proxy.models.runtime.context import RequestContext
from proxy.services.events.event_log import EventLog
from proxy.services.graph.builtin_nodes import BuiltinNodeRunner
from proxy.services.state.state_store import StateStore
from tests.proxy_engine.fakes import FakeFlow


def make_context(tmp, data=None):
    config = AppConfig.from_dict(
        {
            "activeModeId": "mode",
            "modes": [
                {
                    "id": "mode",
                    "name": "Mode",
                    "graph": {
                        "nodes": [{"id": "start", "type": "start"}],
                        "edges": [],
                    },
                }
            ],
            "customBlocks": [],
        }
    )
    return RequestContext(
        flow=FakeFlow(),
        config=config,
        state=StateStore(Path(tmp) / "state.json"),
        event_log=EventLog(Path(tmp) / "events.jsonl"),
        data=data,
        now=lambda: 1000.0,
    )


class BuiltinNodeRunnerTest(unittest.TestCase):
    def test_block_sets_response_and_returns_blocked_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            context = make_context(tmp)
            node = GraphNode("block", "block", {"status": 451, "message": "Nope"})

            result = BuiltinNodeRunner().run(node, context)

            self.assertEqual(result.output, "blocked")
            self.assertEqual(context.flow.response.status_code, 451)
            self.assertIn(b"Nope", context.flow.response.content)

    def test_log_appends_event(self):
        with tempfile.TemporaryDirectory() as tmp:
            context = make_context(tmp)
            node = GraphNode("log", "log", {"eventType": "request_seen", "message": "hello"})

            result = BuiltinNodeRunner().run(node, context)

            self.assertEqual(result.output, "next")
            self.assertEqual(context.event_log.read_recent(1)[0]["type"], "request_seen")

    def test_track_time_updates_state_and_result_data(self):
        with tempfile.TemporaryDirectory() as tmp:
            context = make_context(tmp)
            runner = BuiltinNodeRunner()
            node = GraphNode("track", "track_time", {"platform": "reddit", "idleSeconds": 300})

            runner.run(node, context)
            context.now = lambda: 1060.0
            result = runner.run(node, context)

            self.assertEqual(result.output, "next")
            self.assertEqual(result.data["usage"]["delta_seconds"], 60.0)
            self.assertEqual(context.state.usage_today("reddit", 1060.0), 60.0)

    def test_notify_writes_notification_event(self):
        with tempfile.TemporaryDirectory() as tmp:
            context = make_context(tmp)
            node = GraphNode("notify", "notify", {"title": "Blocked", "body": "Reddit"})

            BuiltinNodeRunner().run(node, context)
            event = context.event_log.read_recent(1)[0]

            self.assertEqual(event["type"], "notification")
            self.assertEqual(event["title"], "Blocked")

    def test_redirect_updates_request_url(self):
        with tempfile.TemporaryDirectory() as tmp:
            context = make_context(tmp)
            node = GraphNode("redirect", "redirect", {"url": "https://example.com/redirected"})

            result = BuiltinNodeRunner().run(node, context)

            self.assertEqual(result.output, "redirected")
            self.assertEqual(context.flow.request.url, "https://example.com/redirected")
            self.assertEqual(context.flow.request.pretty_url, "https://example.com/redirected")

    def test_if_routes_from_context_data(self):
        with tempfile.TemporaryDirectory() as tmp:
            context = make_context(tmp, {"platform": {"name": "reddit"}})
            node = GraphNode("if", "if", {"key": "platform.name", "equals": "reddit"})

            result = BuiltinNodeRunner().run(node, context)

            self.assertEqual(result.output, "true")


if __name__ == "__main__":
    unittest.main()
