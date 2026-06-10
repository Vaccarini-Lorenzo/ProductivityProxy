# Logical Architecture

## System shape

ProductivityProxy is one local desktop system with local-only storage and no remote service.

```text
User
  └─ Desktop dashboard
       └─ Desktop backend
            ├─ Local proxy process
            │    └─ Policy engine
            ├─ Local persistence
            └─ System proxy integration
```

## Logical components

### Desktop dashboard

The dashboard is the user-facing control surface. It lets the user edit proxy settings, modes, policy flows, custom nodes, and event views.

The dashboard does not evaluate web traffic.

### Desktop backend

The backend is the native app layer. It stores configuration, manages the local proxy process, exposes commands to the dashboard, detects local network addresses, and manages system proxy settings where supported.

### Local proxy process

The local proxy process receives proxied traffic from the system, browser, or another device. It forwards request decisions into the policy engine before traffic continues.

### Policy engine

The policy engine evaluates the active mode's ordered policies. It can allow traffic, stop traffic with a response, redirect requests, update usage state, write events, and run trusted custom Python nodes.

### Local persistence

Config, usage state, event logs, and custom node files are stored locally. Schemas and file ownership live in [Data Layer](../4_data_layer/config-state-events.md).

### System proxy integration

When supported, the backend points the local machine's HTTP/HTTPS proxy settings at the local proxy while the proxy is running, then restores the prior enabled state on stop.

## Main flows

### App startup

1. The desktop backend starts with the dashboard window hidden.
2. The user opens the dashboard from the tray/menu-bar icon.
3. The dashboard asks the backend for config, proxy status, network info, and recent events.

### Start proxy

1. The dashboard sends the current config to the backend.
2. The backend checks startup preconditions, including the required loop-guard configuration.
3. The backend persists the config and captures current system proxy state.
4. The backend starts the local proxy process.
5. The backend points system proxy settings at the local proxy.
6. If setup fails, the backend stops the local proxy and restores the captured proxy state.

Detailed runtime mechanics live in [Tauri Desktop Backend](../2_component/tauri-desktop-backend.md) and [Local Desktop Runtime](../3_deployment/local-desktop-runtime.md).

### Stop proxy

1. The dashboard or tray asks the backend to stop.
2. The backend restores captured system proxy state.
3. The backend stops the local proxy process.

### Request evaluation

1. A client sends a request through the local proxy.
2. The policy engine selects the active mode.
3. Policies in that mode run in order.
4. A policy starts at its start node.
5. Custom nodes do work and continue through `next`; operators choose route labels.
6. Evaluation stops for a policy at an end node or when no route matches.
7. Evaluation stops for the mode when a policy sets a response.

## Boundaries

- The dashboard edits policy definitions; it does not run policies.
- The backend starts/stops processes; it does not inspect HTTP flows.
- The Python engine inspects traffic; it does not show native UI.
- Notifications are emitted as events by the proxy and displayed by the app layer.
