import unittest

from proxy.api import RequestContext
from proxy.models.runtime.context import RequestContext as RuntimeRequestContext


class ProxyApiTest(unittest.TestCase):
    def test_public_request_context_is_the_runtime_context(self):
        # Custom nodes import RequestContext from the public proxy.api surface.
        # It must stay the same class the evaluator passes as `context`.
        self.assertIs(RequestContext, RuntimeRequestContext)


if __name__ == "__main__":
    unittest.main()
