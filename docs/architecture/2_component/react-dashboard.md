# React Dashboard

## Location

```text
src/frontend/react/
```

The dashboard is a Vite + React + TypeScript app embedded in the Tauri window.

This document describes the current source tree. The UI is actively changing, so treat this as a snapshot of the present architecture.

## Entry point

- `src/main.tsx` mounts `<App />` into `#root`.
- `src/App.tsx` owns top-level state, autosave, startup loading, notifications, and view routing.

## Main state owned by `App`

`App` stores:

- active view: `settings`, `modes`, `policy`, `nodes`, or `observability`,
- full app config,
- last saved config for autosave comparison,
- validation issues returned by the backend,
- proxy running status,
- detected local/LAN network info,
- recent proxy events for notifications,
- user-facing message string,
- a set of notification events already shown.

On mount it asks the Tauri backend for app config, proxy status, recent events, and network info.

## Views

### Settings

`views/SettingsView.tsx`

Current responsibilities:

- start/stop buttons,
- running/stopped badge,
- proxy port,
- LAN listen toggle,
- proxy authentication toggle,
- username/password fields.

### Nodes

`views/NodesView.tsx`

Current responsibilities:

- list registered custom Python nodes,
- load node source through `read_custom_node`,
- add/edit node metadata and code,
- write node code through the backend,
- live-validate edited code through `validate_node_code` (backend),
- reset broken code back to the last saved version,
- delete unused node entries from config state.

### Modes

`views/ModesView.tsx`

Current responsibilities:

- select the active mode,
- create/delete modes,
- edit mode name and description,
- add/remove shared policies from a mode,
- reorder policies inside a mode through `policyIds`,
- show policy/step counts.

### Policy

`views/PolicyView.tsx`

Current responsibilities:

- select one policy from the global policy list,
- create/delete shared policies,
- show where the selected policy is used,
- host the graph editor for the selected policy,
- add/delete nodes and operators,
- open the step inspector,
- show backend validation issues and ring broken steps on the canvas,
- reset a broken policy to its last saved version.

Current limitations:

- policy rename is not exposed in this view,
- mode-specific policy ordering is handled in Modes,
- edge output labels are displayed but not edited in the current UI.

### Observability

`views/ObservabilityView.tsx`

Current responsibilities:

- query JSONL events through `query_events`,
- filter by category, type, level, policy, request ID, time window, and search text,
- inspect selected event JSON,
- show a request timeline when `requestId` is present.

## Graph editor and step inspector

`components/GraphEditor.tsx` uses `@xyflow/react` and converts policy steps/edges to React Flow nodes/edges and back.

Supporting pieces:

- `NodeLibrary.tsx` lists flow nodes, operators, and registered custom nodes that can be added to the graph.
- `StepModal.tsx` edits start trigger code, operator code, switch cases, and existing node params.
- `PythonCodeEditor.tsx` backs start trigger code, operator code, custom-node editing, syntax highlighting, autoindentation, full-screen expansion, and an API reference drawer.
- `ApiReferenceDrawer.tsx` reads `services/apiReference/pythonApiReference.json` and fuzzy-searches the documented Python API. Entries expand to structured contract details; opening it from an editor seeds the search with the current function name.
- `operatorShapes.ts` defines operator port layout.
- `services/nodes/defaultNodeSources.ts` bundles the real default node `.py` files as read-only fallback for browser preview.

Detailed graph-editor behavior and performance rules live in [React Graph Editor](react-graph-editor.md).

## Frontend services

### Config repository

`services/config/configRepository.ts`

Thin wrapper around Tauri commands:

- `read_app_config`,
- `write_app_config`,
- `write_custom_node`,
- `read_custom_node`.

### Config validation

Validation lives entirely in the Python backend (the single source of truth). The dashboard re-implements no rules; it only renders what the backend returns.

- On autosave, `App` calls `write_app_config`, which validates the whole config in Python and writes the file **only when valid**. The command returns a `{ ok, issues[] }` report either way.
- Editing custom-node code calls `validate_node_code`, which checks Python syntax and a `run` function.
- On a failed report, `App` does not advance its last-saved snapshot. It shows the first issue in the top bar (red “Not saved”), `PolicyView` renders a per-policy “Broken · not saved” banner with message and hint, and `GraphEditor` rings the offending steps.

Each issue is `{ scope, policyId, nodeId, stepIds, message, hint }`. The rule set lives in [Python proxy engine](python-proxy-engine.md#config-model) and [Data Layer](../4_data_layer/config-state-events.md#validation-boundaries).

### Proxy repository

`services/proxy/proxyRepository.ts`

Thin wrapper around Tauri commands:

- `start_proxy`,
- `stop_proxy`,
- `proxy_status`,
- `network_info`,
- `read_recent_events`,
- `query_events`.

### Notifications

`services/notifications/notificationService.ts` filters recent events for `type === "notification"`, deduplicates by event JSON, and calls a notifier.

`services/notifications/tauriNotifier.ts` requests notification permission and sends native notifications through `@tauri-apps/plugin-notification`.

## Browser preview behavior

When Tauri is unavailable, command errors containing `invoke` are displayed as:

```text
Browser preview — Tauri unavailable
```

This allows limited visual development in a browser, but backend-dependent features require Tauri.

## Tests

React/Vitest tests live under:

```text
test/unit/frontend/react/
```

Coverage includes app smoke behavior, config repository command calls, validation, default config, graph editor rendering, graph operations, notification deduplication, and proxy repository command calls.
