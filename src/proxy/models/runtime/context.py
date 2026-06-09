from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Callable

from proxy.models.graph.policy_graph import AppConfig
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

    def merge_data(self, values: dict[str, Any]) -> None:
        if values:
            self.data.update(values)
