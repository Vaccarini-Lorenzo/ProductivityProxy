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


class ProxyBehaviorChangeTest(unittest.TestCase):
    def test_registered_custom_node_is_inert_until_active_policy_uses_it(self):
        with tempfile.TemporaryDirectory() as tmp:
            block_path = write_block_node(tmp)
            raw = config_raw(
                active_mode_id="work",
                modes=[
                    mode_raw("work", [allow_policy("work-allow")]),
                    mode_raw("break", [block_policy("break-block")]),
                ],
                custom_nodes=[custom_node_raw("block", block_path)],
            )

            inactive_flow = evaluate(raw, tmp)
            raw["activeModeId"] = "break"
            active_flow = evaluate(raw, tmp)

            self.assertIsNone(inactive_flow.response)
            self.assertEqual(active_flow.response.status_code, 451)

    def test_unconnected_custom_step_is_inert_until_edge_points_to_it(self):
        with tempfile.TemporaryDirectory() as tmp:
            block_path = write_block_node(tmp)
            raw = config_raw(
                active_mode_id="work",
                modes=[mode_raw("work", [unconnected_block_policy("draft")])],
                custom_nodes=[custom_node_raw("block", block_path)],
            )

            draft_flow = evaluate(raw, tmp)
            raw["policies"][0]["edges"] = [
                {"from": "draft-start", "output": "next", "to": "draft-block"}
            ]
            connected_flow = evaluate(raw, tmp)

            self.assertIsNone(draft_flow.response)
            self.assertEqual(connected_flow.response.status_code, 451)

    def test_empty_policy_added_to_active_mode_does_not_stop_later_policies(self):
        with tempfile.TemporaryDirectory() as tmp:
            block_path = write_block_node(tmp)
            raw = config_raw(
                active_mode_id="work",
                modes=[mode_raw("work", [allow_policy("new-empty"), block_policy("existing-block")])],
                custom_nodes=[custom_node_raw("block", block_path)],
            )

            flow = evaluate(raw, tmp)

            self.assertEqual(flow.response.status_code, 451)

    def test_missing_custom_node_file_is_inert_until_used(self):
        with tempfile.TemporaryDirectory() as tmp:
            missing_path = Path(tmp) / "missing.py"
            raw = config_raw(
                active_mode_id="work",
                modes=[mode_raw("work", [allow_policy("work-allow")])],
                custom_nodes=[custom_node_raw("missing", missing_path)],
            )

            unused_flow = evaluate(raw, tmp)
            raw["policies"] = [node_policy("uses-missing", "missing")]
            raw["modes"][0]["policyIds"] = ["uses-missing"]

            self.assertIsNone(unused_flow.response)
            with self.assertRaises(FileNotFoundError):
                evaluate(raw, tmp)

    def test_inactive_mode_with_unknown_node_type_is_rejected_at_load(self):
        raw = config_raw(
            active_mode_id="work",
            modes=[
                mode_raw("work", [allow_policy("work-allow")]),
                mode_raw("draft", [node_policy("broken", "missing-registration")]),
            ],
            custom_nodes=[],
        )

        with self.assertRaisesRegex(ValueError, "Unknown node type"):
            AppConfig.from_dict(raw)


def evaluate(raw: dict, tmp: str) -> FakeFlow:
    config = AppConfig.from_dict(raw)
    flow = FakeFlow()
    context = RequestContext(
        flow=flow,
        config=config,
        state=StateStore(Path(tmp) / "state.json"),
        event_log=EventLog(Path(tmp) / "events.jsonl"),
    )
    PolicyEvaluator(config, max_steps=20).evaluate(context)
    return flow


def write_block_node(tmp: str) -> Path:
    path = Path(tmp) / "block.py"
    path.write_text(
        textwrap.dedent(
            """
            class Response:
                def __init__(self, status_code):
                    self.status_code = status_code
                    self.content = b"blocked"

            def run(input, context, params):
                context.flow.response = Response(451)
                return input
            """
        ),
        encoding="utf-8",
    )
    return path


def config_raw(active_mode_id: str, modes: list[dict], custom_nodes: list[dict]) -> dict:
    policies: list[dict] = []
    seen: set[str] = set()
    out_modes: list[dict] = []
    for mode in modes:
        ids: list[str] = []
        for policy in mode.get("policies", []):
            if policy["id"] not in seen:
                policies.append(policy)
                seen.add(policy["id"])
            ids.append(policy["id"])
        out_modes.append({"id": mode["id"], "name": mode["name"], "policyIds": ids})
    return {"activeModeId": active_mode_id, "policies": policies, "modes": out_modes, "customNodes": custom_nodes}


def mode_raw(mode_id: str, policies: list[dict]) -> dict:
    return {"id": mode_id, "name": mode_id, "policies": policies}


def custom_node_raw(node_id: str, path: Path) -> dict:
    return {"id": node_id, "name": node_id, "path": str(path)}


def allow_policy(policy_id: str) -> dict:
    return {
        "id": policy_id,
        "name": policy_id,
        "steps": [
            {"id": f"{policy_id}-start", "kind": "node", "type": "start"},
            {"id": f"{policy_id}-end", "kind": "node", "type": "end"},
        ],
        "edges": [{"from": f"{policy_id}-start", "output": "next", "to": f"{policy_id}-end"}],
    }


def block_policy(policy_id: str) -> dict:
    return node_policy(policy_id, "block")


def node_policy(policy_id: str, node_type: str) -> dict:
    return {
        "id": policy_id,
        "name": policy_id,
        "steps": [
            {"id": f"{policy_id}-start", "kind": "node", "type": "start"},
            {"id": f"{policy_id}-node", "kind": "node", "type": node_type},
        ],
        "edges": [{"from": f"{policy_id}-start", "output": "next", "to": f"{policy_id}-node"}],
    }


def unconnected_block_policy(policy_id: str) -> dict:
    return {
        "id": policy_id,
        "name": policy_id,
        "steps": [
            {"id": f"{policy_id}-start", "kind": "node", "type": "start"},
            {"id": f"{policy_id}-end", "kind": "node", "type": "end"},
            {"id": f"{policy_id}-block", "kind": "node", "type": "block"},
        ],
        "edges": [{"from": f"{policy_id}-start", "output": "next", "to": f"{policy_id}-end"}],
    }


if __name__ == "__main__":
    unittest.main()
