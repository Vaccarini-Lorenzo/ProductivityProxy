from __future__ import annotations

import json
import queue
import threading
from pathlib import Path
from typing import Any

_CLOSE = object()


class EventLog:
    """Appends events to a JSONL file from a background thread.

    Writes are enqueued and flushed off the caller's thread, so the mitmproxy
    event loop never blocks on disk I/O. Call flush() to force a sync point
    before reading in-process (read_recent does this automatically).
    """

    def __init__(self, path: Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._file = self.path.open("a", encoding="utf-8")
        self._queue: queue.Queue = queue.Queue()
        self._closed = False
        self._worker = threading.Thread(target=self._drain, daemon=True)
        self._worker.start()

    def append(self, event: dict[str, Any]) -> None:
        if self._closed:
            return
        self._queue.put(event)

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
                self._file.write(json.dumps(event, sort_keys=True, default=str) + "\n")
                self._file.flush()
            except Exception:
                pass
            finally:
                self._queue.task_done()

    def read_recent(self, limit: int) -> list[dict[str, Any]]:
        self.flush()
        if limit <= 0 or not self.path.exists():
            return []
        lines = self.path.read_text(encoding="utf-8").splitlines()
        return [json.loads(line) for line in lines[-limit:] if line.strip()]
