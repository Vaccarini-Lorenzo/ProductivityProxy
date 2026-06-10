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
        self.config_path = None
        self._config_mtime = None

    def configure(self, config_path: Path, state_path: Path, event_log_path: Path) -> None:
        if self.event_log is not None:
            self.event_log.close()
        self.event_log = EventLog(event_log_path)
        self.config_path = config_path
        try:
            self.config = ConfigService(config_path).load()
        except Exception as error:
            observability.config_rejected(self.event_log, config_path, error)
            self.event_log.flush()
            raise
        self._config_mtime = _mtime(config_path)
        observability.config_loaded(self.event_log, config_path, self.config)
        self.state = StateStore(state_path)
        self.evaluator = PolicyEvaluator(self.config)

    def request(self, flow) -> None:
        if not self.evaluator or not self.config or not self.state or not self.event_log:
            raise RuntimeError("PolicyProxyController is not configured")
        self._reload_if_changed()
        context = RequestContext(
            flow=flow,
            config=self.config,
            state=self.state,
            event_log=self.event_log,
        )
        self.evaluator.evaluate(context)

    def close(self) -> None:
        if self.event_log is not None:
            self.event_log.close()

    def _reload_if_changed(self) -> None:
        mtime = _mtime(self.config_path)
        if mtime is None or mtime == self._config_mtime:
            return
        self._config_mtime = mtime
        try:
            config = ConfigService(self.config_path).load()
        except Exception as error:
            observability.config_rejected(self.event_log, self.config_path, error)
            return
        self.config = config
        self.evaluator = PolicyEvaluator(config)
        observability.config_loaded(self.event_log, self.config_path, config)


def _mtime(path) -> int | None:
    try:
        return path.stat().st_mtime_ns
    except OSError:
        return None
