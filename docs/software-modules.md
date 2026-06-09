# Software Modules and API Contracts

## Scope

This document defines the first implementation units for the Tauri + React app and the Python mitmproxy policy engine.

The first build target is the Python graph policy engine. The desktop app will call it through `mitmdump`.

## Folder rules

Code is grouped by layer and domain:

```text
src/
  proxy/
    models/
      graph/
      runtime/
    services/
      config/
      events/
      graph/
      state/
    controller/
      mitmproxy/
  frontend/
    react/src/
      models/
      services/
      controller/
    tauri/src/
      models/
      services/
      controller/
```

Tests are grouped by test type first, then by tested unit or flow:

```text
test/
  unit/
    config_service/
    state_store/
    frontend/
      react/
      tauri/
  integration/
    default_policy_graph/
    graph_policy_flow/
```

## Python proxy engine modules

### `proxy.models.graph.policy_graph`

Responsibility:

- Represent app config, modes, graphs, nodes, edges, and custom block definitions.
- Convert raw config dictionaries into typed model objects.

API contract:

```python
AppConfig.from_dict(raw: dict) -> AppConfig
AppConfig.active_mode() -> Mode
PolicyGraph.start_node() -> GraphNode
PolicyGraph.next_node_id(current_id: str, output: str) -> str | None
```

Rules:

- `activeModeId` must match an existing mode.
- A graph must have exactly one start node.
- Edge routing first matches exact output, then `*` fallback.

### `proxy.models.runtime.context`

Responsibility:

- Provide the runtime object passed to built-in and custom nodes.

API contract:

```python
RequestContext(
  flow,
  config,
  state,
  event_log,
  data=None,
  now=None,
)
```

Fields:

- `flow`: mitmproxy `HTTPFlow` or compatible object.
- `config`: active `AppConfig`.
- `state`: `StateStore`.
- `event_log`: `EventLog`.
- `data`: mutable per-request dictionary.
- `now`: callable returning UNIX seconds.

### `proxy.models.runtime.result`

Responsibility:

- Normalize node execution results.

API contract:

```python
NodeResult(output: str = "next", data: dict | None = None)
NodeResult.from_value(value) -> NodeResult
```

Rules:

- `None` means `output="next"`.
- A string means `output=<string>`.
- A dict can contain `output` and `data`.

### `proxy.services.events.event_log`

Responsibility:

- Append JSONL events to disk.

API contract:

```python
EventLog(path: Path)
EventLog.append(event: dict) -> None
EventLog.read_recent(limit: int) -> list[dict]
```

Rules:

- Parent directories are created automatically.
- Events are one JSON object per line.

### `proxy.services.state.state_store`

Responsibility:

- Persist proxy state.
- Track request-gap-based platform usage.

API contract:

```python
StateStore(path: Path)
StateStore.load() -> dict
StateStore.save(state: dict) -> None
StateStore.track_usage(platform: str, idle_seconds: int, now: float) -> dict
StateStore.usage_today(platform: str, now: float) -> float
```

Rules:

- Daily buckets use UTC date.
- If the last seen timestamp is within `idle_seconds`, the elapsed gap is counted.
- If the gap exceeds `idle_seconds`, a new session starts and elapsed time is not counted.

### `proxy.services.graph.builtin_nodes`

Responsibility:

- Execute the initial built-in graph nodes.

API contract:

```python
BuiltinNodeRunner.run(node, context) -> NodeResult
```

Supported node types:

- `start`
- `end`
- `if`
- `switch`
- `block`
- `log`
- `track_time`
- `notify`
- `redirect`

Rules:

- `block` creates a `403` response by default and returns `blocked`.
- `redirect` updates the request URL and returns `redirected`.
- `notify` writes a `notification` event. Native display is handled by the app later.

### `proxy.services.graph.custom_blocks`

Responsibility:

- Load and run arbitrary Python blocks from files.

API contract:

```python
CustomBlockRunner(config: AppConfig)
CustomBlockRunner.run(node, context) -> NodeResult
```

Rules:

- A custom block config references `id`, `path`, and `entrypoint`.
- The entrypoint receives `(context, params)`.
- No sandboxing is applied.

### `proxy.services.graph.evaluator`

Responsibility:

- Evaluate the active mode graph for one request.

API contract:

```python
GraphEvaluator(config: AppConfig, builtins=None, custom_blocks=None)
GraphEvaluator.evaluate(context: RequestContext) -> None
```

Rules:

- Evaluation starts at the graph start node.
- Each node returns an output.
- The graph selects the next edge by output.
- No loop guard is applied in the first version.

### `proxy.controller.mitmproxy.graph_addon`

Responsibility:

- Bridge mitmproxy hooks to the graph evaluator.

API contract:

```python
addons = [GraphProxyAddon()]
```

Mitmproxy options:

- `productive_config_path`
- `productive_state_path`
- `productive_event_log_path`

Request hook:

```python
GraphProxyAddon.request(flow) -> None
```

Rules:

- Load config/state/event paths from mitmproxy options.
- Evaluate one graph per request.

## App modules planned next

### `src/frontend/react/src/models/config`

Responsibility:

- TypeScript types for config, modes, graph nodes, edges, and custom blocks.

### `src/frontend/react/src/services/proxy/processService`

Responsibility:

- Start, stop, and restart `mitmdump`.

### `src/frontend/react/src/services/network/networkRepository`

Responsibility:

- Read local/LAN proxy setup details from Tauri commands.

### `src/frontend/react/src/services/notifications/notificationService`

Responsibility:

- Convert proxy `notification` events into desktop notification calls.
- Deduplicate already-seen notification events.

### `src/frontend/react/src/services/config/configService`

Responsibility:

- Read/write app config through Tauri commands.

### `src/frontend/react/src/controller/tray`

Responsibility:

- Control tray/menu interactions.

### `src/frontend/react/src/controller/dashboard`

Responsibility:

- Handle dashboard page state and commands.
