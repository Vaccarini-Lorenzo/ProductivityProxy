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
    data: dict[str, Any] | None = None
    now: Callable[[], float] = time.time
    request_id: str | None = None
    log: CustomNodeLogger = field(init=False)

    def __post_init__(self) -> None:
        if self.data is None:
            self.data = {}
        if self.request_id is None:
            self.request_id = uuid.uuid4().hex
        self.log = CustomNodeLogger(self)
