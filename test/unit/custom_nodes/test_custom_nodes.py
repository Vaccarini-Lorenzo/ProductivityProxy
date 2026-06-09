import tempfile
import textwrap
import unittest
from pathlib import Path

from proxy.models.policy.flow import AppConfig, PolicyStep
from proxy.models.runtime.context import RequestContext
from proxy.services.events.event_log import EventLog
from proxy.services.policy.custom_nodes import CustomNodeRunner
from proxy.services.state.state_store import StateStore
from test.helpers.fakes import FakeFlow


class CustomNodeRunnerTest(unittest.TestCase):
    def test_runs_python_node_with_input_context_and_params(self):
        with tempfile.TemporaryDirectory() as tmp:
            node_path = Path(tmp) / "detect.py"
            node_path.write_text(
                textwrap.dedent(
                    """
                    def run(input, context, params):
                        context.data["seen"] = params["value"]
                        return {"previous": input, "detected": True}
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
                                    "steps": [{"id": "start", "kind": "node", "type": "start"}],
                                    "edges": [],
                                }
                            ],
                        }
                    ],
                    "customNodes": [{"id": "detect", "name": "Detect", "path": str(node_path)}],
                }
            )
            context = RequestContext(
                flow=FakeFlow(),
                config=config,
                state=StateStore(Path(tmp) / "state.json"),
                event_log=EventLog(Path(tmp) / "events.jsonl"),
            )
            step = PolicyStep("detect-step", "node", "detect", {"value": "ok"})

            result = CustomNodeRunner(config).run(step, {"start": True}, context)

            self.assertEqual(result, {"previous": {"start": True}, "detected": True})
            self.assertEqual(context.data["seen"], "ok")


if __name__ == "__main__":
    unittest.main()
