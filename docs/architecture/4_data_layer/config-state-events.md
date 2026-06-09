# Data Layer: Config, State, Events, and Blocks

## Storage overview

All persistent data is stored locally.

| Data | Format | Owner | Default location |
| --- | --- | --- | --- |
| App config | JSON | Tauri app + Python proxy | app data `config.json` |
| Usage state | JSON | Python proxy | app data `state.json` |
| Event log | JSONL | Python proxy writes, Tauri reads | app data `events.jsonl` |
| Custom blocks | Python files | Tauri writes, Python imports | app data `custom_blocks/` |
| Default config | JSON | repo source | `src/proxy/defaults/default_config.json` |

## App config schema

Top-level shape:

```json
{
  "activeModeId": "productivity",
  "proxy": {},
  "modes": [],
  "customBlocks": []
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
  "graph": {
    "nodes": [],
    "edges": []
  }
}
```

`activeModeId` must match one mode `id`.

### Graph node

```json
{
  "id": "track-reddit",
  "type": "track_time",
  "position": { "x": 800, "y": 180 },
  "params": {
    "platform": "reddit",
    "idleSeconds": 300
  }
}
```

The Python model uses `id`, `type`, and `params`.

`position` is used by the React graph editor and ignored by the Python model.

### Graph edge

```json
{
  "from": "detect-reddit",
  "output": "match",
  "to": "track-reddit"
}
```

Routing rule:

- exact `output` match wins,
- `*` is fallback,
- no match stops evaluation.

### Custom block config

```json
{
  "id": "detect-platform",
  "name": "Detect Platform",
  "path": "src/proxy/defaults/blocks/detect_platform.py",
  "entrypoint": "run"
}
```

A `python` graph node references a block with:

```json
{
  "blockId": "detect-platform"
}
```

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

Events are JSON lines. Each line is one object.

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

## Data lifecycle

### First config read

If app data `config.json` does not exist, Tauri copies `src/proxy/defaults/default_config.json` into app data.

### Save config

The React dashboard sends the whole config to Tauri. Tauri writes pretty JSON to app data.

### Start proxy

Tauri writes the latest config before launching `mitmdump`. The Python addon loads that config during its configure step.

### Runtime request handling

The Python proxy may update `state.json` and append to `events.jsonl` while evaluating requests.

### Custom block creation

The React dashboard sends file name and code to Tauri. Tauri writes the file under app data `custom_blocks/` and returns the path for config registration.

## Validation boundaries

Frontend validation is minimal. Python model parsing and runtime node execution enforce additional rules.

Current missing validations include:

- duplicate IDs,
- edges pointing to missing nodes before runtime,
- required params for each node type,
- valid custom block paths before execution,
- graph loop detection,
- safe file names for custom block writes.
