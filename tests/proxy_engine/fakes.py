class FakeRequest:
    def __init__(self, url="https://example.com/path"):
        self.url = url
        self.pretty_url = url
        self.headers = {}
        self.content = b""
        self.path = "/path"
        self.pretty_host = "example.com"


class FakeFlow:
    def __init__(self, url="https://example.com/path"):
        self.request = FakeRequest(url)
        self.response = None
