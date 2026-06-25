from __future__ import annotations

import queue
import threading
from collections.abc import Callable
from typing import Any


class AsyncWorker:
    def __init__(self):
        self._queue: queue.Queue[Callable[[], Any]] = queue.Queue()
        self._thread = threading.Thread(target=self._run, daemon=True, name="policy-async-worker")
        self._thread.start()

    def submit(self, work: Callable[[], Any]) -> None:
        if not callable(work):
            raise TypeError("run_async expects a callable")
        self._queue.put(work)

    def _run(self) -> None:
        while True:
            work = self._queue.get()
            try:
                work()
            except Exception:
                pass
            finally:
                self._queue.task_done()


_WORKER = AsyncWorker()


def submit(work: Callable[[], Any]) -> None:
    _WORKER.submit(work)
