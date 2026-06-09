# Logical Architecture

## System shape

ProductivityProxy is one local desktop system with three main logical parts:

```text
User
  └─ Desktop dashboard
       └─ Desktop backend
            ├─ Local proxy process
            │    └─ Policy engine
            ├─ Local config/state/event files
            └─ macOS system proxy settings
```

## Logical components

### Desktop dashboard

The dashboard is the user-facing control surface.

It lets the user:

- edit proxy settings,
- start and stop the proxy,
- select and manage modes,
- edit policy flows,
- register custom Python nodes.

The dashboard does not evaluate web traffic itself.

### Desktop backend

The backend is the native app layer.

It owns:

- app data paths,
- config file reads/writes,
- custom node file writes,
- proxy process lifecycle,
- recent event reads,
- local/LAN address detection,
- macOS system proxy snapshot/restore,
- tray/menu-bar behavior.

### Local proxy process

The local proxy process is `mitmdump` with the ProductivityProxy addon loaded.

It receives traffic from the system, browser, or another device and forwards each request into the policy engine.

### Policy engine

The policy engine decides what to do with each request by evaluating the active mode policies.

It can:

- block a request,
- redirect a request,
- log events,
- track usage time,
- emit notification events,
- run custom Python nodes.

### Local persistence

All user-facing runtime data is local:

- app config,
- proxy state,
- event log,
- custom Python block files.

There is no remote service.

## Main flows

### App startup

1. The desktop backend starts as a dockless tray/menu-bar app.
2. The dashboard window is hidden.
3. The user opens the dashboard from the tray/menu-bar icon.
4. The dashboard asks the backend for config, proxy status, and recent events.

### Start proxy

1. The dashboard sends the current config to the backend.
2. The backend stores the config in the app data directory.
3. The backend captures current macOS HTTP/HTTPS proxy settings.
4. The backend starts `mitmdump` with config, state, and event paths.
5. The backend points macOS system proxy settings at `127.0.0.1:<port>`.
6. If proxy setup fails, the backend stops `mitmdump` and restores the captured proxy settings.

### Stop proxy

1. The dashboard or tray asks the backend to stop.
2. The backend restores captured macOS proxy settings.
3. The backend stops `mitmdump`.

### Request evaluation

1. A client sends a request through `mitmdump`.
2. The addon creates a request context.
3. The policy engine starts at the active mode's start node.
4. Each node returns an output and optional data.
5. Edges route the output to the next node.
6. Evaluation ends at an end node, an `end` output, or no matching edge.

## Boundaries

- The dashboard edits policy definitions; it does not run policies.
- The backend starts/stops processes; it does not inspect HTTP flows.
- The Python engine inspects traffic; it does not show native UI.
- Notifications are emitted as events by the proxy and displayed by the app layer.
