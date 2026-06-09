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
  "modes": []
}
```

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
  "policies": []
}
```

`activeModeId` must match one mode `id`.

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
  "policyName": "Reddit Limit",
  "stepId": "detect-reddit",
  "stepKind": "node",
  "stepType": "detect-platform",
  "url": "https://www.reddit.com/r/test",
  "host": "www.reddit.com",
  "path": "/r/test"
}
```

Known event types:

### Log event

```json
{"type":"log","message":"...","url":"https://example.com"}
```

### Usage event

```json
{
  "type": "usage_tracked",
  "platform": "reddit",
  "event": "activity",
  "delta_seconds": 12.0,
  "daily_seconds": 600.0,
  "total_seconds": 1200.0
}
```

### Notification event

```json
{
  "type": "notification",
  "title": "ProductivityProxy",
  "body": "Message"
}
```

The Tauri/React layer reads recent events and displays native notifications for unseen notification events.

### Observability events

The proxy automatically emits:

- `config_loaded`
- `config_rejected`
- `request_started`
- `request_finished`
- `request_failed`
- `policy_started`
- `policy_step`
- `policy_finished`
- `policy_error`

`request_finished.outcome` is `allowed` or `blocked`.

`policy_step` contains `output`, `routeOutput`, `nextStepId`, `durationMs`, `responseSet`, and optionally `responseStatus`.

### Custom node logging API

Custom nodes can write filterable events through `context.log`:

```python
def run(input, context, params):
    context.log.info("detected candidate", platform="reddit", score=0.91)
    context.log.event("my_custom_event", "custom decision", level="debug", reason="matched host")
    return input
```

Custom node logs use:

```json
{
  "schema": "observability.v1",
  "category": "custom_node",
  "source": "custom_node",
  "type": "custom_node_log",
  "level": "info",
  "message": "detected candidate",
  "policyId": "...",
  "stepId": "...",
  "data": { "platform": "reddit", "score": 0.91 }
}
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

Tauri writes the latest config before launching `mitmdump`. The Python addon loads that config during its configure step.

### Runtime request handling

The Python proxy may update `state.json` and append to `events.jsonl` while evaluating requests.

### Custom node creation

The React dashboard sends file name and code to Tauri. Tauri writes the file under app data `custom_nodes/` and returns the absolute path for config registration.

## Validation boundaries

Frontend validation is minimal. Python model parsing and runtime node execution enforce additional rules.

Current missing validations include:

- full frontend parity with Python validation,
- required params for each custom node,
- safe file names for custom node writes.
