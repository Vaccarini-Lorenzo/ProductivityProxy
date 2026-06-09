from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any, Callable

from proxy.models.policy.flow import AppConfig
from proxy.services.events.event_log import EventLog
from proxy.services.state.state_store import StateStore


@dataclass
class RequestContext:
    flow: Any
    config: AppConfig
    state: StateStore
    event_log: EventLog
    data: dict[str, Any] | None = None
    now: Callable[[], float] = time.time

    def __post_init__(self) -> None:
        if self.data is None:
            self.data = {}
