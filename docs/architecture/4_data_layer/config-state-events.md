# Data Layer: Config, State, Events, and Nodes

## Storage overview

All persistent data is stored locally.

| Data | Format | Owner | Default location |
| --- | --- | --- | --- |
| App config | JSON | Tauri app + Python proxy | app data `config.json` |
| Usage state | JSON | Python proxy | app data `state.json` |
| Event log | JSONL | Python proxy writes, Tauri reads | app data `events.jsonl` |
| Custom nodes | Python files | Tauri writes, Python imports | app data `custom_nodes/` |
| Default config | JSON | repo source | `src/proxy/defaults/default_config.json` |

## App config schema

Top-level shape:

```json
{
  "activeModeId": "productivity",
  "proxy": {},
  "customNodes": [],
  "policies": [],
  "modes": []
}
```

`Chilling` allows traffic by having an empty `policyIds` list. No start/end allow-all policy is required.

### Proxy config

```json
{
  "port": 8080,
  "allowLan": false,
  "authEnabled": false,
  "authUsername": "productive",
  "authPassword": "change-me"
}
```

Used by the Tauri backend to build `mitmdump` arguments and system proxy settings.

### Mode config

```json
{
  "id": "productivity",
  "name": "Productivity",
  "description": "Focused work mode",
  "policyIds": ["block-youtube-shorts", "limit-reddit"]
}
```

Rules:

- `activeModeId` must match one mode `id`.
- Each `policyIds[]` value must reference a top-level policy in `policies`.
- Policy order inside a mode is the order of `policyIds`.

### Policy config

```json
{
  "id": "reddit-limit",
  "name": "Reddit limit",
  "steps": [],
  "edges": []
}
```

### Policy step

```json
{
  "id": "track-reddit",
  "kind": "node",
  "type": "track-time",
  "position": { "x": 800, "y": 180 },
  "params": {
    "platform": "reddit",
    "idleSeconds": 300
  }
}
```

The Python model uses `id`, `kind`, `type`, and `params`.

`position` is used by the React graph editor and ignored by the Python model.

A `start` node may include inline Python trigger code:

```json
{
  "code": "def triggered_by(request: Request) -> bool:\n    host = request.host.lower().strip(\".\")\n    return host == \"reddit.com\" or host.endswith(\".reddit.com\")\n"
}
```

The Python evaluator executes `triggered_by(request)`. A truthy result routes to `next`; a falsy result routes to `skip`.

### Policy edge

```json
{
  "from": "detect-reddit",
  "output": "match",
  "to": "track-reddit"
}
```

Routing rule:

- exact `output` match is used,
- custom nodes route through `next`,
- `if` operators route through `then` / `else`,
- `switch` may fall back to an explicit `default` edge,
- no match stops policy evaluation.

### Custom node config

```json
{
  "id": "block-response",
  "name": "Block Response",
  "path": "/absolute/path/src/proxy/defaults/nodes/block_response.py"
}
```

A custom node step uses the custom node `id` as its `type`. Paths must be absolute in runtime config.

## Default-node parameter contracts

Bundled node files live under `src/proxy/defaults/nodes/`. A config must register a node before a policy can use it. The current default config registers all bundled default nodes.

The small required-param/default map for registered bundled nodes lives in `src/proxy/defaults/node_params.json`.

| Registered node type | Required params | Return / side effect |
| --- | --- | --- |
| `block-response` | `status` number, `message` string | Calls `request.block(...)`; returns input. |
| `track-time` | `platform` string, `idleSeconds` number | Updates persistent usage state, appends `usage_tracked`, returns input plus `usage`. |
| `is-usage-over-limit` | `platform` string, `seconds` number | Reads persistent usage state; returns input plus `used` and `over_limit`. |

Custom nodes use the same general entrypoint:

```python
def run(input, request, context, params):
    return input
```

## Tauri command contracts

The command/API contract table lives in [Command Contracts](command-contracts.md).

## State schema

Current usage state shape:

```json
{
  "usage": {
    "reddit": {
      "total_seconds": 1800.0,
      "daily_seconds": {
        "2026-06-09": 1800.0
      },
      "last_seen_at": 1781020000.0
    }
  }
}
```

Rules:

- daily keys are UTC dates,
- `last_seen_at` is a UNIX timestamp,
- elapsed time is counted only when the gap from last seen is within `idleSeconds`,
- state is held in memory and flushed to disk as pretty JSON at most every `PRODUCTIVE_PROXY_STATE_FLUSH_SECONDS` (write-behind), and on shutdown.

Public custom-node API:

```python
value = context.persistent_state.get("usage")
context.persistent_state.set("usage", value)
```

`get(keyword)` reads a top-level key and raises `KeyError` when missing. `set(keyword, data)` updates a JSON-serializable top-level value in memory and persists it write-behind (within `PRODUCTIVE_PROXY_STATE_FLUSH_SECONDS`, and on shutdown). A crash can lose at most the last flush interval of updates. `get()` returns the live in-memory value, so mutating a nested dict/list returned by `get()` updates in-memory state but is only persisted once code calls `set()` (which marks the store dirty).

## Event log schema

Events are JSON lines. Each line is one object. Events are intentionally shaped for filtering in the frontend. The file is kept under `PRODUCTIVE_PROXY_EVENT_LOG_MAX_BYTES`: once it grows past the budget the oldest half is dropped (compaction), so the file stays a bounded, recent window rather than growing without limit.

By default (`PRODUCTIVE_PROXY_TELEMETRY_VERBOSE=false`) the engine writes one `request_finished` event per request, plus config, error, and custom-node events. Setting `PRODUCTIVE_PROXY_TELEMETRY_VERBOSE=true` adds the full per-step trace (`request_started`, `policy_started`, `policy_step`, `policy_finished`).

Most events carry only the light correlation fields (`requestId`, `modeId`); the heavier request fields (`url`, `host`, `path`, `method`) are attached to request-level events only, and the frontend joins steps back to a request by `requestId`.

Common fields on every event:

```json
{
  "schema": "observability.v1",
  "timestamp": 1781020000.0,
  "category": "observability",
  "source": "python_proxy",
  "type": "request_finished",
  "level": "info",
  "message": "Request blocked",
  "requestId": "...",
  "modeId": "productivity"
}
```

Known event groups:

- log events from default/custom nodes,
- `usage_tracked`,
- `notification`,
- observability events such as `config_loaded`, `config_rejected`, `request_started`, `request_finished`, `request_failed`, `policy_started`, `policy_step`, `policy_finished`, and `policy_error`.

`request_finished.outcome` is `allowed` or `blocked`. When blocked, it also carries `decidingPolicyId`, `decidingPolicyName`, and `responseStatus`, plus the request fields (`url`, `host`, `path`, `method`).

`policy_step` (verbose only) contains routing fields such as `output`, `routeOutput`, `nextStepId`, and `durationMs`.

### Custom node logging API

Custom nodes can write filterable events through `context.log(type, message, level, **data)`:

```python
def run(input, request, context, params):
    context.log("detected_candidate", "detected candidate", platform="reddit", score=0.91)
    context.log("my_custom_event", "custom decision", level="debug", reason="matched host")
    return input
```

Use `context.notify(type, message, level, **data)` to append a notification event that the UI can show as a native notification.

### Event query API

Tauri exposes `query_events` with this query shape:

```json
{
  "limit": 100,
  "category": "observability",
  "type": "policy_step",
  "level": "debug",
  "source": "python_proxy",
  "modeId": "productivity",
  "policyId": "reddit-limit-policy",
  "stepId": "detect-reddit",
  "requestId": "...",
  "search": "reddit",
  "since": 1781020000.0,
  "until": 1781023600.0
}
```

All filters except `limit` are optional. Results are returned in chronological order after taking the latest matching events.

## Data lifecycle

### First config read

If app data `config.json` does not exist, Tauri reads `src/proxy/defaults/default_config.json`, materializes custom node paths as absolute paths, and writes the result into app data.

### Save config

The React dashboard sends the whole config to Tauri. Tauri writes pretty JSON to app data.

### Start proxy

Tauri writes the latest config before launching `mitmdump`. The Python addon loads that config during configure, then reloads it on request when the file mtime changes.

### Runtime request handling

The Python proxy may update `state.json` and append to `events.jsonl` while evaluating requests.

### Custom node creation

The React dashboard sends file name and code to Tauri. Tauri writes the file under app data `custom_nodes/` and returns the absolute path for config registration.

## Validation boundaries

The Python backend is the single validation source of truth. `proxy.services.config.validation.validate_config` accumulates structured issues, and `proxy.models.policy.flow.AppConfig.from_dict` raises them at runtime. The desktop save path calls the same function through `validate_cli.py` (spawned by the Tauri `write_app_config` command), so React and Rust never re-implement rules.

The config is rejected (and autosave is blocked) when any of these fail:

- `activeModeId` references an existing mode,
- each `mode.policyIds[]` references an existing policy,
- ids are unique (modes, policies, custom nodes, and steps within a policy),
- custom node paths are absolute,
- each policy has exactly one `start` node,
- edges point to existing steps and routes are unique by `from` + `output`,
- step types are known built-ins, operators, or registered custom nodes,
- every step is reachable from `start` (no orphan/disconnected steps),
- registered bundled nodes have required params with basic expected types,
- inline `start`/operator code parses and defines its required function.

Custom-node code is validated separately via `validate_node_code`: Python syntax plus a `run` function.

Still missing:

- required params for user-created custom nodes,
- config migrations/versioning.
