import threading
import unittest

from proxy.services.policy.async_worker import AsyncWorker


class AsyncWorkerTest(unittest.TestCase):
    def test_rejects_work_when_queue_is_full(self):
        started = threading.Event()
        release = threading.Event()
        completed = threading.Event()
        worker = AsyncWorker(max_queue_items=1)

        def blocking_work():
            started.set()
            release.wait(timeout=2)

        worker.submit(blocking_work)
        self.assertTrue(started.wait(timeout=1))
        worker.submit(completed.set)

        with self.assertRaisesRegex(RuntimeError, "queue is full"):
            worker.submit(lambda: None)

        release.set()
        self.assertTrue(completed.wait(timeout=1))


if __name__ == "__main__":
    unittest.main()
