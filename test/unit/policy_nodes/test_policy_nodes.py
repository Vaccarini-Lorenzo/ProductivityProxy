import importlib.util
import tempfile
import unittest
from pathlib import Path

from proxy.api import Context, Request
from proxy.models.policy.flow import PolicyStep
from proxy.models.runtime.context import RequestContext
from proxy.services.events.event_log import EventLog
from proxy.services.policy.operators import OperatorRunner
from proxy.services.state.state_store import StateStore
from test.helpers.fakes import FakeFlow


class OperatorRunnerTest(unittest.TestCase):
    def test_if_routes_then_else_from_code(self):
        step = PolicyStep("choice", "operator", "if", {"code": "def if_condition(input):\n    return input['match']"})

        self.assertEqual(OperatorRunner().evaluate(step, {"match": True}), "then")
        self.assertEqual(OperatorRunner().evaluate(step, {"match": False}), "else")

    def test_switch_routes_by_returned_label(self):
        step = PolicyStep("switch", "operator", "switch", {"code": "def switch_condition(input):\n    return input.get('platform', 'default')"})

        self.assertEqual(OperatorRunner().evaluate(step, {"platform": "reddit"}), "reddit")
        self.assertEqual(OperatorRunner().evaluate(step, {}), "default")

    def test_missing_code_raises(self):
        step = PolicyStep("choice", "operator", "if", {})
        with self.assertRaises(ValueError):
            OperatorRunner().evaluate(step, {})


class DefaultNodeTest(unittest.TestCase):
    def test_block_response_sets_flow_response(self):
        with tempfile.TemporaryDirectory() as tmp:
            context = RequestContext(
                flow=FakeFlow(),
                config=None,
                state=StateStore(Path(tmp) / "state.json"),
                event_log=EventLog(Path(tmp) / "events.jsonl"),
            )
            module = load_default_node("block_response")

            result = module.run({"match": True}, Request(context), Context(context), {"status": 451, "message": "Nope"})

            self.assertEqual(result, {"match": True})
            self.assertEqual(context.flow.response.status_code, 451)
            self.assertIn(b"Nope", context.flow.response.content)


def load_default_node(name: str):
    path = Path("src/proxy/defaults/nodes") / f"{name}.py"
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


if __name__ == "__main__":
    unittest.main()
