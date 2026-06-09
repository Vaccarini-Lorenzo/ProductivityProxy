from __future__ import annotations

import json
from pathlib import Path

from proxy.models.policy.flow import AppConfig


class ConfigService:
    def __init__(self, path: Path):
        self.path = Path(path)

    def load(self) -> AppConfig:
        with self.path.open("r", encoding="utf-8") as file:
            return AppConfig.from_dict(json.load(file))
