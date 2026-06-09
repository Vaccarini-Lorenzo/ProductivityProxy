import tempfile
import textwrap
import unittest
from pathlib import Path

from proxy.models.graph.policy_graph import AppConfig, GraphNode
from proxy.models.runtime.context import RequestContext
from proxy.services.events.event_log import EventLog
from proxy.services.graph.custom_blocks import CustomBlockRunner
from proxy.services.state.state_store import StateStore
from tests.proxy_engine.fakes import FakeFlow


class CustomBlockRunnerTest(unittest.TestCase):
    def test_runs_python_block_and_merges_result_data(self):
        with tempfile.TemporaryDirectory() as tmp:
            block_path = Path(tmp) / "detect.py"
            block_path.write_text(
                textwrap.dedent(
                    """
                    def run(context, params):
                        context.data["seen"] = params["value"]
                        return {"output": "match", "data": {"detected": True}}
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
                            "graph": {"nodes": [{"id": "start", "type": "start"}], "edges": []},
                        }
                    ],
                    "customBlocks": [
                        {
                            "id": "detect",
                            "name": "Detect",
                            "path": str(block_path),
                            "entrypoint": "run",
                        }
                    ],
                }
            )
            context = RequestContext(
                flow=FakeFlow(),
                config=config,
                state=StateStore(Path(tmp) / "state.json"),
                event_log=EventLog(Path(tmp) / "events.jsonl"),
            )
            node = GraphNode("detect-node", "python", {"blockId": "detect", "value": "ok"})

            result = CustomBlockRunner(config).run(node, context)

            self.assertEqual(result.output, "match")
            self.assertEqual(result.data, {"detected": True})
            self.assertEqual(context.data["seen"], "ok")


if __name__ == "__main__":
    unittest.main()
