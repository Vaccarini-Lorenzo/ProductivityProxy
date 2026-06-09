import unittest
from pathlib import Path

from proxy.services.config.config_service import ConfigService


class DefaultConfigTest(unittest.TestCase):
    def test_default_config_loads(self):
        config = ConfigService(Path("src/proxy/defaults/default_config.json")).load()

        self.assertEqual(config.active_mode().id, "productivity")


if __name__ == "__main__":
    unittest.main()
