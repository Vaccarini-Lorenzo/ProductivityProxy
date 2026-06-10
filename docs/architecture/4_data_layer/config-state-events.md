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

A `start` node may include a trigger:

```json
{
  "trigger": {
    "hostPatterns": ["reddit.com", "www.reddit.com"],
    "pathPatterns": ["/r/"]
  }
}
```

A start trigger returns `next` when matched and `skip` when not matched.

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
  "id": "detect-platform",
  "name": "Detect Platform",
  "path": "/absolute/path/src/proxy/defaults/nodes/detect_platform.py"
}
```

A custom node step uses the custom node `id` as its `type`. Paths must be absolute in runtime config.

## Default-node parameter contracts

Bundled node files live under `src/proxy/defaults/nodes/`. A config must register a node before a policy can use it.

| Node type | Required params | Return / side effect |
| --- | --- | --- |
| `block-response` | `status` number, `message` string | Sets `context.flow.response`; returns input. |
| `track-time` | `platform` string, `idleSeconds` number | Updates usage state, appends `usage_tracked`, returns input plus `usage`. |
| `is-usage-over-limit` | `platform` string, `seconds` number | Returns input plus `used` and `over_limit`. |
| `detect-platform` | `hostSuffixes` string array, `platform` string | Returns input plus `match`; adds `platform` on match. |
| `detect-youtube-shorts` | `hostSuffixes` string array, `markers` string array | Returns input plus `match`; adds `platform` and `kind` on match. |
| `redirect-request` | `url` string | Rewrites request URL; returns input. |
| `log-event` | `eventType` string, `message` string | Appends a log-like event; returns input. |
| `notify` | `title` string, `body` string | Appends a notification event; returns input. |

Custom nodes use the same general entrypoint:

```python
def run(input, context, params):
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
- state is rewritten as pretty JSON on each save.

## Event log schema

Events are JSON lines. Each line is one object. Events are intentionally shaped for filtering in the frontend.

Common observability fields:

```json
{
  "schema": "observability.v1",
  "timestamp": 1781020000.0,
  "category": "observability",
  "source": "python_proxy",
  "type": "policy_step",
  "level": "debug",
  "message": "Step detect-reddit returned next",
  "requestId": "...",
  "modeId": "productivity",
  "policyId": "reddit-limit-policy",
  "stepId": "detect-reddit",
  "url": "https://www.reddit.com/r/test",
  "host": "www.reddit.com",
  "path": "/r/test"
}
```

Known event groups:

- log events from default/custom nodes,
- `usage_tracked`,
- `notification`,
- observability events such as `config_loaded`, `config_rejected`, `request_started`, `request_finished`, `request_failed`, `policy_started`, `policy_step`, `policy_finished`, and `policy_error`.

`request_finished.outcome` is `allowed` or `blocked`.

`policy_step` contains routing fields such as `output`, `routeOutput`, `nextStepId`, `durationMs`, `responseSet`, and optionally `responseStatus`.

### Custom node logging API

Custom nodes can write filterable events through `context.log`:

```python
def run(input, context, params):
    context.log.info("detected candidate", platform="reddit", score=0.91)
    context.log.event("my_custom_event", "custom decision", level="debug", reason="matched host")
    return input
```

Supported helper methods are `debug`, `info`, `warning`, `warn`, `error`, and `event`.

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

Frontend validation is minimal. Python model parsing and runtime node execution enforce additional rules.

Current missing validations include:

- full frontend parity with Python validation,
- required params for each built-in or custom node,
- config migrations/versioning.
