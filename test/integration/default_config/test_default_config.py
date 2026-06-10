import unittest

from test.helpers.configs import materialized_default_config


class DefaultConfigTest(unittest.TestCase):
    def test_default_config_loads(self):
        config = materialized_default_config()

        self.assertEqual(config.active_mode().id, "productivity")
        self.assertGreater(len(config.active_policies()), 0)
        self.assertEqual(config.active_mode().policy_ids, ["block-youtube-shorts", "limit-reddit"])


if __name__ == "__main__":
    unittest.main()
