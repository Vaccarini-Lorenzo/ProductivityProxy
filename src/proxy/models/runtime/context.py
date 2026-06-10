from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable

from proxy.models.policy.flow import AppConfig
from proxy.services.events.event_log import EventLog
from proxy.services.events.observability import CustomNodeLogger
from proxy.services.state.state_store import StateStore


@dataclass
class RequestContext:
    flow: Any
    config: AppConfig
    state: StateStore
    event_log: EventLog
    data: dict[str, Any] = field(default_factory=dict)
    now: Callable[[], float] = time.time
    request_id: str = field(default_factory=lambda: uuid.uuid4().hex)

    @property
    def log(self) -> CustomNodeLogger:
        return CustomNodeLogger(self)
