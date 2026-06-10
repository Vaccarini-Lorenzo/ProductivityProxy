from __future__ import annotations

from pathlib import Path

from proxy.models.runtime.context import RequestContext
from proxy.services.config.config_service import ConfigService
from proxy.services.events import observability
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
        if self.event_log is not None:
            self.event_log.close()
        self.event_log = EventLog(event_log_path)
        try:
            self.config = ConfigService(config_path).load()
        except Exception as error:
            observability.config_rejected(self.event_log, config_path, error)
            self.event_log.flush()
            raise
        observability.config_loaded(self.event_log, config_path, self.config)
        self.state = StateStore(state_path)
        self.evaluator = PolicyEvaluator(self.config)

    def close(self) -> None:
        if self.event_log is not None:
            self.event_log.close()

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
