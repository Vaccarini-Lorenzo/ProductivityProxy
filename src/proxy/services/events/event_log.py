from __future__ import annotations

import json
import os
import queue
import threading
from pathlib import Path
from typing import Any

_CLOSE = object()


class EventLog:
    """Appends events to a JSONL file from a background thread.

    Writes are enqueued and flushed off the caller's thread, so the mitmproxy
    event loop never blocks on disk I/O. New events are dropped if the bounded
    queue is full. The file is kept under a byte budget: once it grows past
    max_bytes the worker compacts it in place, dropping the oldest half, so reads
    stay bounded. Call flush() to force a sync point before reading in-process.
    """

    def __init__(
        self,
        path: Path,
        max_bytes: int | None = None,
        max_queue_items: int | None = None,
    ):
        self.path = Path(path)
        self.max_bytes = max_bytes if max_bytes is not None else _max_bytes_from_env()
        queue_limit = (
            max_queue_items if max_queue_items is not None else _queue_max_items_from_env()
        )
        if queue_limit <= 0:
            raise ValueError("Event log queue limit must be greater than zero")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._file = self.path.open("a", encoding="utf-8")
        self._bytes = self.path.stat().st_size
        self._queue: queue.Queue = queue.Queue(maxsize=queue_limit)
        self._closed = False
        self._worker = threading.Thread(target=self._drain, daemon=True)
        self._worker.start()

    def append(self, event: dict[str, Any]) -> None:
        if self._closed:
            return
        try:
            self._queue.put_nowait(event)
        except queue.Full:
            pass

    def flush(self) -> None:
        self._queue.join()

    def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        self._queue.put(_CLOSE)
        self._worker.join(timeout=5)
        self._file.close()

    def _drain(self) -> None:
        while True:
            event = self._queue.get()
            try:
                if event is _CLOSE:
                    return
                line = json.dumps(event, sort_keys=True, default=str) + "\n"
                self._file.write(line)
                self._bytes += len(line.encode("utf-8"))
                if self._queue.empty():
                    self._file.flush()
                if self._bytes >= self.max_bytes:
                    self._compact()
            except Exception:
                pass
            finally:
                self._queue.task_done()

    def _compact(self) -> None:
        self._file.flush()
        self._file.close()
        lines = [line for line in self.path.read_text(encoding="utf-8").splitlines() if line.strip()]
        kept = lines[len(lines) // 2:]
        text = ("\n".join(kept) + "\n") if kept else ""
        tmp = self.path.with_suffix(self.path.suffix + ".tmp")
        tmp.write_text(text, encoding="utf-8")
        os.replace(tmp, self.path)
        self._file = self.path.open("a", encoding="utf-8")
        self._bytes = len(text.encode("utf-8"))

    def read_recent(self, limit: int) -> list[dict[str, Any]]:
        self.flush()
        if limit <= 0 or not self.path.exists():
            return []
        lines = self.path.read_text(encoding="utf-8").splitlines()
        return [json.loads(line) for line in lines[-limit:] if line.strip()]


def _max_bytes_from_env() -> int:
    if "PRODUCTIVE_PROXY_EVENT_LOG_MAX_BYTES" not in os.environ:
        raise RuntimeError("Missing PRODUCTIVE_PROXY_EVENT_LOG_MAX_BYTES")
    value = int(os.environ["PRODUCTIVE_PROXY_EVENT_LOG_MAX_BYTES"])
    if value <= 0:
        raise ValueError("PRODUCTIVE_PROXY_EVENT_LOG_MAX_BYTES must be greater than zero")
    return value


def _queue_max_items_from_env() -> int:
    if "PRODUCTIVE_PROXY_EVENT_QUEUE_MAX_ITEMS" not in os.environ:
        raise RuntimeError("Missing PRODUCTIVE_PROXY_EVENT_QUEUE_MAX_ITEMS")
    value = int(os.environ["PRODUCTIVE_PROXY_EVENT_QUEUE_MAX_ITEMS"])
    if value <= 0:
        raise ValueError("PRODUCTIVE_PROXY_EVENT_QUEUE_MAX_ITEMS must be greater than zero")
    return value
