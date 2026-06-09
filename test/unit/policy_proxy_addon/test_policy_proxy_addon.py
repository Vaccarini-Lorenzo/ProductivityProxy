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
        self.flow = None

    def configure(self, config_path, state_path, event_log_path):
        self.configured = (config_path, state_path, event_log_path)

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
            addon.request("flow")

            self.assertEqual([item[0] for item in loader.names], [
                "productive_config_path",
                "productive_state_path",
                "productive_event_log_path",
            ])
            self.assertEqual(controller.flow, "flow")
            self.assertEqual(controller.configured[0], Path(tmp) / "config.json")


if __name__ == "__main__":
    unittest.main()
