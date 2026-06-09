import unittest

from proxy.models.runtime.result import NodeResult


class NodeResultTest(unittest.TestCase):
    def test_normalizes_none_string_and_dict(self):
        self.assertEqual(NodeResult.from_value(None).output, "next")
        self.assertEqual(NodeResult.from_value("blocked").output, "blocked")

        result = NodeResult.from_value({"output": "match", "data": {"x": 1}})

        self.assertEqual(result.output, "match")
        self.assertEqual(result.data, {"x": 1})


if __name__ == "__main__":
    unittest.main()
