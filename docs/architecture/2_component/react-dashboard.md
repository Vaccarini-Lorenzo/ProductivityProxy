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

### Nodes

`views/NodesView.tsx`

Current responsibilities:

- list registered custom Python nodes,
- add/edit node metadata,
- write node code through the backend,
- delete node entries from config state.

Important current behavior: editing an existing node updates form fields but does not load the existing file contents from disk.

### Policies

`views/PoliciesView.tsx`

Current responsibilities:

- list modes,
- select active mode,
- create/delete modes,
- list ordered policies inside the active mode,
- show the graph editor for the selected policy,
- add nodes/operators to the selected policy.

## Graph editor

`components/GraphEditor.tsx` uses `@xyflow/react`.

It converts policy steps/edges to React Flow nodes/edges and back.

Current add buttons:

```text
start, end, if, switch, registered custom nodes
```

Current limitations:

- nodes can be moved,
- edges can be added/removed,
- edge labels default to `next`,
- edge output labels can be edited in the Policies view,
- step params can be edited as JSON in the Policies view.

## Frontend services

### Config repository

`services/config/configRepository.ts`

Thin wrapper around Tauri commands:

- `read_app_config`,
- `write_app_config`,
- `write_custom_node`.

### Config validation

`services/config/configValidation.ts`

Current checks:

- active mode exists,
- each policy has exactly one start node,
- policy edges point to existing steps.

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
