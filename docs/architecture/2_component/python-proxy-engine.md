# Python Proxy Engine

## Location

```text
src/proxy/
```

The Python engine runs inside `mitmdump`. It owns request policy evaluation.

## mitmproxy addon

`src/proxy/addons/graph_proxy.py` exposes:

```python
addons = [GraphProxyAddon()]
```

The addon registers mitmproxy options:

- `productive_config_path`,
- `productive_state_path`,
- `productive_event_log_path`.

When configured, it delegates to `GraphProxyController`.

## Controller

`proxy.controller.mitmproxy.graph_controller.GraphProxyController`

Responsibilities:

- load config from disk,
- create the state store,
- create the event log,
- create the graph evaluator,
- build a `RequestContext` for each request,
- evaluate the active graph.

Config is loaded during `configure`, not for every request. Changes made on disk are picked up after the proxy is restarted/reconfigured.

## Config model

`proxy.models.graph.policy_graph`

Important objects:

- `AppConfig`,
- `Mode`,
- `PolicyGraph`,
- `GraphNode`,
- `GraphEdge`,
- `CustomBlock`.

Validation performed while parsing:

- `activeModeId` must match an existing mode,
- each graph must have exactly one `start` node,
- graph node IDs referenced at runtime must exist.

Routing rule:

1. find an edge from the current node with an exact matching output,
2. otherwise use an edge whose output is `*`,
3. otherwise stop evaluation.

## Request context

`RequestContext` contains:

- mitmproxy flow,
- app config,
- state store,
- event log,
- mutable per-request data dictionary,
- clock function.

Node result data is merged into `context.data` after each node.

## Evaluation loop

`GraphEvaluator.evaluate(context)`:

1. gets the active mode graph,
2. starts at the graph start node,
3. runs the current node,
4. merges returned data into context data,
5. exits on an `end` node or `output == "end"`,
6. routes to the next node by output,
7. exits if no edge matches.

Current limitation: there is no loop guard. A cyclic graph can hang request handling.

## Built-in nodes

`BuiltinNodeRunner` supports:

| Type | Behavior | Output |
| --- | --- | --- |
| `start` | No-op graph entry. | `next` |
| `end` | Terminates evaluation. | `end` |
| `if` | Reads a key from `context.data` and compares params. | `true` / `false` |
| `switch` | Reads a key and maps it through `cases`. | matching case or default |
| `block` | Creates a proxy response, default status `403`. | `blocked` |
| `log` | Appends an event to the JSONL event log. | `next` |
| `track_time` | Updates usage state for a platform. | `next`, with usage data |
| `notify` | Appends a `notification` event. | `next` |
| `redirect` | Changes the request URL. | `redirected` |

## Custom Python operators

A graph node with `type: "python"` runs a custom block.

Contract:

```python
def run(context, params):
    return {"output": "next", "data": {}}
```

The return value is normalized by `NodeResult.from_value`:

- `None` becomes `output="next"`,
- string becomes that output,
- dict may contain `output` and `data`,
- `NodeResult` is accepted directly.

Custom block paths may be absolute or relative. Relative paths are resolved against the repo root first, then the `src` root.

Security note: custom blocks are imported and executed directly. There is no sandbox, timeout, or permissions boundary.

## Default custom blocks

Default blocks live in:

```text
src/proxy/defaults/blocks/
```

Current defaults:

- `detect_youtube_shorts.py`: matches YouTube Shorts by host and URL/body markers.
- `detect_platform.py`: matches configured host suffixes and emits platform data.

## Persistent state

`StateStore` stores usage data in JSON.

Usage tracking counts elapsed time only when the previous request for a platform was within the configured idle window. Daily buckets use UTC dates.

## Events

`EventLog` appends one JSON object per line to `events.jsonl`.

Events are used for logs, usage tracking, and notification requests.

## Tests

Python tests live under:

```text
test/unit/
test/integration/
```

Coverage includes:

- config loading,
- graph parsing/routing,
- node result normalization,
- built-in nodes,
- custom block loading,
- evaluator routing,
- state store usage tracking,
- event log reads/writes,
- mitmproxy addon/controller delegation,
- default graph behavior.
