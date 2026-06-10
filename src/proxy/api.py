"""Public API for custom node and operator code.

Custom nodes receive a :class:`RequestContext` as their ``context`` argument.
Import it only for type hints:

    from proxy.api import RequestContext

    def run(input: Any, context: RequestContext, params: dict[str, Any]) -> Any:
        return input
"""

from __future__ import annotations

from proxy.models.runtime.context import RequestContext

__all__ = ["RequestContext"]
