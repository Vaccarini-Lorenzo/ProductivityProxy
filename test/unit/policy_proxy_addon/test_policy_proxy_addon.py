import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from proxy.addons.policy_proxy import PolicyProxyAddon


class FakeLoader:
    def __init__(self):
        self.names = []

    def add_option(self, name, _type, default, help_text):
        self.names.append((name, _type, default, help_text))


class FakeController:
    def __init__(self):
        self.configured = None
        self.headers_flow = None
        self.flow = None

    def configure(self, config_path, state_path, event_log_path):
        self.configured = (config_path, state_path, event_log_path)

    def request_headers(self, flow):
        self.headers_flow = flow

    def request(self, flow):
        self.flow = flow


class PolicyProxyAddonTest(unittest.TestCase):
    def test_registers_options_and_delegates_requests(self):
        with tempfile.TemporaryDirectory() as tmp:
            controller = FakeController()
            addon = PolicyProxyAddon(controller)
            loader = FakeLoader()

            addon.load(loader)
            addon.configure_from_options(
                SimpleNamespace(
                    productive_config_path=str(Path(tmp) / "config.json"),
                    productive_state_path=str(Path(tmp) / "state.json"),
                    productive_event_log_path=str(Path(tmp) / "events.jsonl"),
                )
            )
            addon.requestheaders("headers-flow")
            addon.request("flow")

            self.assertEqual([item[0] for item in loader.names], [
                "productive_config_path",
                "productive_state_path",
                "productive_event_log_path",
            ])
            self.assertEqual(controller.headers_flow, "headers-flow")
            self.assertEqual(controller.flow, "flow")
            self.assertEqual(controller.configured[0], Path(tmp) / "config.json")

    def test_streams_responses_and_discards_websocket_history(self):
        addon = PolicyProxyAddon(FakeController())
        response = SimpleNamespace(status_code=200, stream=False)
        messages = ["first", "second"]
        flow = SimpleNamespace(
            request=SimpleNamespace(method="GET"),
            response=response,
            websocket=SimpleNamespace(messages=messages),
        )

        addon.responseheaders(flow)
        addon.websocket_message(flow)

        self.assertTrue(response.stream)
        self.assertEqual(messages, [])

    def test_does_not_stream_protocol_upgrade_response(self):
        addon = PolicyProxyAddon(FakeController())
        response = SimpleNamespace(status_code=101, stream=False)
        flow = SimpleNamespace(request=SimpleNamespace(method="GET"), response=response)

        addon.responseheaders(flow)

        self.assertFalse(response.stream)


if __name__ == "__main__":
    unittest.main()
