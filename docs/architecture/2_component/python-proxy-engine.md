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

Validation is delegated to `proxy.services.config.validation.validate_config`, the single source of truth shared with the desktop save path (`validate_cli.py`). `AppConfig.from_dict` runs it and raises on any issue. Rules:

- `activeModeId` must match an existing mode,
- each `mode.policyIds[]` value must reference a top-level policy,
- ids must be unique (modes, policies, custom nodes, and steps within a policy),
- custom node paths must be absolute,
- each policy must have exactly one `start` node,
- edges must point to existing steps,
- routes must be unique by `from` + `output`,
- step types must be known built-in nodes, operators, or custom nodes,
- every step must be reachable from `start` (no disconnected steps),
- registered bundled nodes must have required params with basic expected types,
- inline `start`/operator code must parse and define its required function.

## Semantic model

### Nodes

Nodes do work.

Built-in nodes:

- `start`,
- `end`.

`start` returns `next` or `skip` by executing inline Python from `params["code"]`. The code must define:

```python
from proxy.api import Request


def triggered_by(request: Request) -> bool:
    return True
```

A truthy return value routes to `next`; a falsy value routes to `skip`. `end` returns `end` and stops that policy.

Custom nodes are trusted Python files with this entrypoint:

```python
from typing import Any

from proxy.api import Context, Request


def run(input: Any, request: Request, context: Context, params: dict[str, Any]) -> Any:
    return input
```

Reference functions are typed. `proxy.api` exposes only the small authoring surface: `Request` for HTTP request data/actions and `Context` for in-memory state, persistent state, logging, and notifications. The dashboard's Python editor has an API reference drawer documenting that surface.

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

## Runtime context vs author API

`RequestContext` is internal runtime plumbing. It carries the mitmproxy flow, app config, persistent usage store, event log, per-request data, clock, and request id.

Python authors do not receive `RequestContext` directly:

- start triggers receive only `request`,
- custom nodes receive `input`, `request`, `context`, and `params`,
- operators receive only `input`.

Public `request` exposes HTTP fields/actions such as `host`, `url`, `headers`, `text()`, `redirect(url)`, and `block(status, message)`. Public `context` exposes `state`, `persistent_state`, `log(type, message, level, **data)`, and `notify(type, message, level, **data)`.

`context.state` is an in-memory key/value store shared by requests handled by the same evaluator; stored dict/list values are passed by reference and disappear when the proxy process restarts.

`context.persistent_state` is a raw global JSON-backed store. It has `get(keyword)` and `set(keyword, data)`. `get` raises `KeyError` when the top-level key is absent. `set` writes immediately and accepts JSON-serializable values only. Mutating a nested dict/list returned by `get` has no durable side effect until code calls `set` with the updated top-level value.

The evaluator does not merge node outputs into either state store. Custom nodes own their return shape.

## Evaluation loop

`PolicyEvaluator.evaluate(context)`:

1. gets the active mode,
2. runs that mode's policies in order,
3. starts each policy at its `start` node,
4. passes each custom node return value to the next step as `input`,
5. lets operators choose the next edge,
6. stops a policy at `end` or when no edge matches,
7. stops the whole mode when a node sets a response (for author code, usually through `request.block(...)`).

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

Only these three bundled nodes are registered in the default config and visible in the default node library:

- `block-response`,
- `track-time`,
- `is-usage-over-limit`.

Default-node parameter contracts live in [Data Layer](../4_data_layer/config-state-events.md#default-node-parameter-contracts). The required-param/default map for registered bundled nodes lives in `src/proxy/defaults/node_params.json`.

Security note: custom nodes and inline start/operator Python are executed directly. There is no sandbox, timeout, or permissions boundary.

## Persistent state

`StateStore` stores persistent state data in JSON. The public API is `context.persistent_state.get(keyword)` and `context.persistent_state.set(keyword, data)`.

Usage tracking counts elapsed time only when the previous request for a platform was within the configured idle window. Daily buckets use UTC dates. The registered `track-time` and `is-usage-over-limit` nodes use `context.persistent_state` for the top-level `usage` key.

## Events

`EventLog` appends one JSON object per line to `events.jsonl`.

The evaluator emits config, request, policy, step, and error events. Custom nodes call `context.log(type, message, level, **data)` for filterable custom events.

Event schemas and query contracts live in [Data Layer](../4_data_layer/config-state-events.md#event-log-schema).

## Tests

Python tests live under:

```text
test/unit/
test/integration/
```

Coverage includes config loading, policy parsing/routing, operators, custom node loading, evaluator input passing, loop guard, state store usage tracking, event log reads/writes, addon/controller delegation, config hot reload, and default policy behavior.
