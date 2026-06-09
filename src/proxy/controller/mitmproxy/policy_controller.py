from __future__ import annotations

from pathlib import Path

from proxy.models.runtime.context import RequestContext
from proxy.services.config.config_service import ConfigService
from proxy.services.events.event_log import EventLog
from proxy.services.policy.evaluator import PolicyEvaluator
from proxy.services.state.state_store import StateStore


class PolicyProxyController:
    def __init__(self):
        self.config = None
        self.state = None
        self.event_log = None
        self.evaluator = None

    def configure(self, config_path: Path, state_path: Path, event_log_path: Path) -> None:
        self.config = ConfigService(config_path).load()
        self.state = StateStore(state_path)
        self.event_log = EventLog(event_log_path)
        self.evaluator = PolicyEvaluator(self.config)

    def request(self, flow) -> None:
        if not self.evaluator or not self.config or not self.state or not self.event_log:
            raise RuntimeError("PolicyProxyController is not configured")
        context = RequestContext(
            flow=flow,
            config=self.config,
            state=self.state,
            event_log=self.event_log,
        )
        self.evaluator.evaluate(context)
