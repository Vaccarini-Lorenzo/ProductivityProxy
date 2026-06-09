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

Config is loaded during `configure`, not for every request. Changes made on disk are picked up after the proxy is restarted/reconfigured.

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

Custom nodes are Python files with exactly this entrypoint:

```python
def run(input, context, params):
    return input
```

Rules:

- `input` is the previous node return value,
- the return value becomes the next input,
- nodes route through the fixed `next` edge,
- side effects happen through `context`.

### Operators

Operators route.

Built-in operators:

- `if`,
- `switch`.

`if` reads `params["path"]` from the current input and routes to `true` or `false`.

`switch` reads `params["path"]` from the current input and routes to the selected value. If no exact edge exists, the evaluator tries the `default` edge.

There is no separate `else` operator. `else` is the `false` branch.

## Request context

`RequestContext` contains:

- mitmproxy flow,
- app config,
- state store,
- event log,
- mutable per-request data dictionary,
- clock function.

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

Default custom nodes live in:

```text
src/proxy/defaults/nodes/
```

Current defaults include:

- `detect_youtube_shorts.py`,
- `detect_platform.py`,
- `block_response.py`,
- `track_time.py`,
- `is_usage_over_limit.py`,
- `redirect_request.py`,
- `log_event.py`,
- `notify.py`.

Security note: custom nodes are imported and executed directly. There is no sandbox, timeout, or permissions boundary.

## Persistent state

`StateStore` stores usage data in JSON.

Usage tracking counts elapsed time only when the previous request for a platform was within the configured idle window. Daily buckets use UTC dates.

## Events

`EventLog` appends one JSON object per line to `events.jsonl`.

Events are used for logs, usage tracking, notification requests, and observability.

The evaluator automatically emits config, request, policy, step, and error events with stable fields such as `category`, `type`, `level`, `requestId`, `modeId`, `policyId`, and `stepId`.

Custom nodes receive `context.log` and can emit filterable events:

```python
def run(input, context, params):
    context.log.info("custom decision", reason="matched")
    return input
```

## Tests

Python tests live under:

```text
test/unit/
test/integration/
```

Coverage includes:

- config loading,
- policy parsing/routing,
- operators,
- custom node loading,
- evaluator input passing,
- loop guard,
- state store usage tracking,
- event log reads/writes,
- mitmproxy addon/controller delegation,
- default policy behavior.
