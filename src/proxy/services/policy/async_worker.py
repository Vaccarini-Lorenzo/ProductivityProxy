from __future__ import annotations

import os
import queue
import threading
from collections.abc import Callable
from typing import Any


class AsyncWorker:
    def __init__(self, max_queue_items: int | None = None):
        queue_limit = max_queue_items if max_queue_items is not None else _queue_max_items_from_env()
        if queue_limit <= 0:
            raise ValueError("Async worker queue limit must be greater than zero")
        self._queue: queue.Queue[Callable[[], Any]] = queue.Queue(maxsize=queue_limit)
        self._thread = threading.Thread(target=self._run, daemon=True, name="policy-async-worker")
        self._thread.start()

    def submit(self, work: Callable[[], Any]) -> None:
        if not callable(work):
            raise TypeError("run_async expects a callable")
        try:
            self._queue.put_nowait(work)
        except queue.Full as error:
            raise RuntimeError("Policy async worker queue is full") from error

    def _run(self) -> None:
        while True:
            work = self._queue.get()
            try:
                work()
            except Exception:
                pass
            finally:
                self._queue.task_done()


def _queue_max_items_from_env() -> int:
    if "PRODUCTIVE_PROXY_ASYNC_QUEUE_MAX_ITEMS" not in os.environ:
        raise RuntimeError("Missing PRODUCTIVE_PROXY_ASYNC_QUEUE_MAX_ITEMS")
    value = int(os.environ["PRODUCTIVE_PROXY_ASYNC_QUEUE_MAX_ITEMS"])
    if value <= 0:
        raise ValueError("PRODUCTIVE_PROXY_ASYNC_QUEUE_MAX_ITEMS must be greater than zero")
    return value


_WORKER = AsyncWorker()


def submit(work: Callable[[], Any]) -> None:
    _WORKER.submit(work)
