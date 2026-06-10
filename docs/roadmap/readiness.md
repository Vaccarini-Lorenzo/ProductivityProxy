# Roadmap and Readiness

## Current status

ProductivityProxy has a working local development architecture for careful macOS trials: Tauri desktop shell, React dashboard, Rust proxy lifecycle commands, Python policy engine, local state/events, custom nodes, and macOS system proxy snapshot/restore.

Current architecture details live in [Architecture](../README.md#architecture-views). Runtime limits live in [Local Desktop Runtime](../architecture/3_deployment/local-desktop-runtime.md).

## Good enough now

The project is good enough for:

- local development,
- testing policy behavior,
- careful macOS trials,
- validating custom nodes,
- iterating on dashboard UX.

## Not ready for broad daily use yet

The main remaining blockers are:

- packaged runtime strategy for mitmproxy, Python, and addon files,
- clearer proxy startup diagnostics and process log capture,
- visible HTTPS CA setup/help,
- config migrations/versioning and custom-node parameter schemas (structural graph validation and registered bundled-node params are now validated in the Python backend),
- durable crash recovery for macOS proxy settings,
- Linux desktop-environment-specific proxy implementations,
- installer signing/notarization after packaging is solved.

## Completed implementation areas

| Area | Status |
| --- | --- |
| Repository and app scaffold | Implemented: Python engine, Tauri backend, React dashboard, tray/menu-bar shell. |
| Proxy process manager | Implemented for development; diagnostics remain thin. |
| Config and app data paths | Implemented with local config/state/events/custom nodes. |
| Python policy engine | Implemented with loop guard, events, config hot reload, and default-policy tests. |
| Default policies | Implemented for Productivity and Chilling defaults. |
| React dashboard | Implemented for settings, modes, policies, nodes, autosave, backend-driven validation/reset, notifications, and observability. |
| macOS system proxy support | Implemented with snapshot/restore and rollback paths. |
| Documentation | Current docs cover usage, development, architecture, contracts, assumptions, and readiness. |

## Recommended next work

1. Add proxy process stdout/stderr capture and missing-`mitmdump` diagnostics.
2. Add a visible HTTPS CA setup/help panel.
3. Add custom-node parameter schemas if user-created nodes need guided configuration.
4. Add config migrations/versioning before changing persisted shapes again.
5. Add reset-to-defaults flow.
6. Decide packaging strategy for mitmproxy/Python/addon files.
7. Design durable crash recovery for macOS proxy settings.
8. Plan Linux proxy support per desktop environment.

## Verification

Use the checks in [Development Guide](../development.md#run-tests) and the manual checks in [Development Guide](../development.md#manual-checks-before-daily-use).
