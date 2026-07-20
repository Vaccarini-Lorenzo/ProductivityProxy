from __future__ import annotations

from pathlib import Path
import sys

SRC_ROOT = Path(__file__).resolve().parents[2]
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from proxy.controller.mitmproxy.policy_controller import PolicyProxyController


class PolicyProxyAddon:
    def __init__(self, controller=None):
        self.controller = controller or PolicyProxyController()

    def load(self, loader) -> None:
        loader.add_option("productive_config_path", str, "", "ProductivityProxy config path")
        loader.add_option("productive_state_path", str, "", "ProductivityProxy state path")
        loader.add_option("productive_event_log_path", str, "", "ProductivityProxy event log path")

    def configure(self, updated) -> None:
        from mitmproxy import ctx

        self.configure_from_options(ctx.options)

    def configure_from_options(self, options) -> None:
        self.controller.configure(
            Path(options.productive_config_path),
            Path(options.productive_state_path),
            Path(options.productive_event_log_path),
        )

    def requestheaders(self, flow) -> None:
        self.controller.request_headers(flow)

    def request(self, flow) -> None:
        self.controller.request(flow)

    def responseheaders(self, flow) -> None:
        if flow.request.method != "CONNECT" and flow.response.status_code != 101:
            flow.response.stream = True

    def websocket_message(self, flow) -> None:
        flow.websocket.messages.clear()

    def done(self) -> None:
        self.controller.close()


addons = [PolicyProxyAddon()]
