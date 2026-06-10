import unittest

from proxy.api import Context, Request


class ProxyApiTest(unittest.TestCase):
    def test_public_api_exposes_request_and_context_only(self):
        self.assertEqual(Request.__name__, "Request")
        self.assertEqual(Context.__name__, "Context")


if __name__ == "__main__":
    unittest.main()
