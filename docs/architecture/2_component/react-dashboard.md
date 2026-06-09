# React Dashboard

## Location

```text
src/frontend/react/
```

The dashboard is a Vite + React + TypeScript app embedded in the Tauri window.

This document describes the current source tree. The UI is actively changing, so treat this as a snapshot of the present architecture.

## Entry point

- `src/main.tsx` mounts `<App />` into `#root`.
- `src/App.tsx` owns top-level state and routes between dashboard views.

## Main state owned by `App`

`App` stores:

- active view: `settings`, `operators`, or `policies`,
- full app config,
- proxy running status,
- recent proxy events,
- user-facing message string,
- a set of notification events already shown.

On mount it asks the Tauri backend for:

- app config,
- proxy status,
- recent events.

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

### Operators

`views/OperatorsView.tsx`

Current responsibilities:

- list registered custom Python operators,
- add/edit operator metadata,
- write operator code through the backend,
- delete operator entries from config state.

Important current behavior: editing an existing operator updates form fields but does not load the existing file contents from disk.

### Policies

`views/PoliciesView.tsx`

Current responsibilities:

- list modes,
- select active mode,
- create/delete modes,
- show the graph editor for the active mode,
- add nodes to the active mode graph.

## Graph editor

`components/GraphEditor.tsx` uses `@xyflow/react`.

It converts app graph nodes/edges to React Flow nodes/edges and back.

Current built-in add buttons:

```text
block, log, track_time, notify, redirect, if, switch, python, end
```

Current limitations:

- nodes can be moved,
- edges can be added/removed,
- edge labels default to `next`,
- node parameters are not editable in the current GraphEditor UI,
- adding a `python` node creates empty params, so the user still needs a way to set `blockId` before it can execute.

## Frontend services

### Config repository

`services/config/configRepository.ts`

Thin wrapper around Tauri commands:

- `read_app_config`,
- `write_app_config`,
- `write_custom_block`.

### Config validation

`services/config/configValidation.ts`

Current checks:

- active mode exists,
- each mode has exactly one start node.

The Python backend enforces more behavior at runtime; frontend validation is intentionally small today.

### Proxy repository

`services/proxy/proxyRepository.ts`

Thin wrapper around Tauri commands:

- `start_proxy`,
- `stop_proxy`,
- `proxy_status`,
- `read_recent_events`.

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

Coverage includes:

- app smoke behavior,
- config repository command calls,
- validation,
- default config,
- graph editor rendering,
- graph operations,
- notification deduplication,
- proxy repository command calls.
