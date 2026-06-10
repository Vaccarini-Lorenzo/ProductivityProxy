# Python Proxy Engine

## Location

```text
src/proxy/
```

The Python engine runs inside `mitmdump`. It owns request policy evaluation.

## mitmproxy addon

`src/proxy/addons/policy_proxy.py` exposes:

```python
addons = [PolicyProxyAddon()]
```

The addon registers mitmproxy options:

- `productive_config_path`,
- `productive_state_path`,
- `productive_event_log_path`.

When configured, it delegates to `PolicyProxyController`.

## Controller

`proxy.controller.mitmproxy.policy_controller.PolicyProxyController`

Responsibilities:

- load config from disk,
- create the state store,
- create the event log,
- create the policy evaluator,
- build a `RequestContext` for each request,
- evaluate the active mode policies.

The controller loads config during `configure`. On each request, it checks the config file mtime and hot-reloads if the file changed. Invalid reloads are rejected and the previous valid config keeps running.

## Config model

`proxy.models.policy.flow`

Important objects:

- `AppConfig`,
- `Mode`,
- `Policy`,
- `PolicyStep`,
- `PolicyEdge`,
- `CustomNode`.

Validation performed while parsing:

- `activeModeId` must match an existing mode,
- each `mode.policyIds[]` value must reference a top-level policy,
- custom node paths must be absolute,
- each policy must have exactly one `start` node,
- policy step IDs must be unique,
- edges must point to existing steps,
- routes must be unique by `from` + `output`,
- step types must be known built-in nodes, operators, or custom nodes.

## Semantic model

### Nodes

Nodes do work.

Built-in nodes:

- `start`,
- `end`.

`start` returns `next` or `skip` by executing inline Python from `params["code"]`. The code must define:

```python
def triggered_by(context: RequestContext) -> bool:
    return True
```

A truthy return value routes to `next`; a falsy value routes to `skip`. `end` returns `end` and stops that policy.

Custom nodes are trusted Python files with this entrypoint:

```python
from typing import Any

from proxy.api import RequestContext


def run(input: Any, context: RequestContext, params: dict[str, Any]) -> Any:
    return input
```

Reference functions are typed. `RequestContext` is re-exported from the public `proxy.api` module so node code does not import internal paths. The dashboard's Python editor has an API reference drawer documenting `context`, `params`, and the entry points.

Rules:

- `input` is the previous node return value,
- the return value becomes the next input,
- custom nodes always route through the fixed `next` edge,
- side effects happen through `context`.

### Operators

Operators route by executing inline Python stored in `params["code"]`.

Built-in operators:

- `if`,
- `switch`.

`if` requires this function:

```python
def if_condition(input) -> bool:
    return True
```

It routes to `then` when the function returns truthy and `else` otherwise.

`switch` requires this function:

```python
def switch_condition(input) -> str:
    return "case_label"
```

It routes to the returned string. If no exact route exists, the evaluator tries a `default` route.

## Request context

`RequestContext` is a plain dataclass. It contains:

- mitmproxy flow,
- app config,
- state store,
- event log,
- mutable per-request `data` dictionary (defaults to empty),
- clock function `now`,
- `request_id` (defaults to a random hex id),
- derived `log` property returning a `CustomNodeLogger`.

It has no `__post_init__`: defaults use `field(default_factory=...)` and `log` is a `@property`, so the object stays light.

The evaluator does not merge node outputs into `context.data`. Custom nodes own their return shape.

## Evaluation loop

`PolicyEvaluator.evaluate(context)`:

1. gets the active mode,
2. runs that mode's policies in order,
3. starts each policy at its `start` node,
4. passes each custom node return value to the next step as `input`,
5. lets operators choose the next edge,
6. stops a policy at `end` or when no edge matches,
7. stops the whole mode when `context.flow.response` is set.

Loop protection is controlled by the required `POLICY_MAX_STEPS` environment variable.

## Default custom nodes

Bundled node files live in:

```text
src/proxy/defaults/nodes/
```

Current bundled files include:

- `detect_youtube_shorts.py`,
- `detect_platform.py`,
- `block_response.py`,
- `track_time.py`,
- `is_usage_over_limit.py`,
- `redirect_request.py`,
- `log_event.py`,
- `notify.py`.

Default-node parameter contracts live in [Data Layer](../4_data_layer/config-state-events.md#default-node-parameter-contracts).

Security note: custom nodes are imported and executed directly. There is no sandbox, timeout, or permissions boundary.

## Persistent state

`StateStore` stores usage data in JSON.

Usage tracking counts elapsed time only when the previous request for a platform was within the configured idle window. Daily buckets use UTC dates.

## Events

`EventLog` appends one JSON object per line to `events.jsonl`.

The evaluator emits config, request, policy, step, and error events. Custom nodes receive `context.log` for filterable custom events.

Event schemas and query contracts live in [Data Layer](../4_data_layer/config-state-events.md#event-log-schema).

## Tests

Python tests live under:

```text
test/unit/
test/integration/
```

Coverage includes config loading, policy parsing/routing, operators, custom node loading, evaluator input passing, loop guard, state store usage tracking, event log reads/writes, addon/controller delegation, config hot reload, and default policy behavior.
