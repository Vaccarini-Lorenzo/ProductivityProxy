import json
import tempfile
import unittest
from pathlib import Path

from proxy.services.config.config_service import ConfigService


class ConfigServiceTest(unittest.TestCase):
    def test_loads_app_config_from_json_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "config.json"
            path.write_text(
                json.dumps(
                    {
                        "activeModeId": "mode",
                        "modes": [
                            {
                                "id": "mode",
                                "name": "Mode",
                                "graph": {"nodes": [{"id": "start", "type": "start"}], "edges": []},
                            }
                        ],
                        "customBlocks": [],
                    }
                ),
                encoding="utf-8",
            )

            config = ConfigService(path).load()

            self.assertEqual(config.active_mode().id, "mode")


if __name__ == "__main__":
    unittest.main()
