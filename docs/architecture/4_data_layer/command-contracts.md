# Command Contracts

## Scope

This document owns the stable request/response contracts between the React dashboard and the Tauri backend.

Implementation details live in [Tauri Desktop Backend](../2_component/tauri-desktop-backend.md). Event schemas and config shapes live in [Data Layer](config-state-events.md).

## Commands exposed to React

| Command | Request | Response | Contract notes |
| --- | --- | --- | --- |
| `read_app_config` | none | config JSON | Ensures app-data config exists before reading. |
| `write_app_config` | `{ config }` | `{ ok, issues[] }` | Validates the full config in Python and writes only when valid. Preserves the runtime-owned stored `activeModeId`. |
| `validate_node_code` | `{ code }` | `{ ok, issues[] }` | Checks custom-node code for Python syntax and a `run` function. |
| `write_custom_node` | `{ fileName, code }` | path string | Validates code (syntax + `run`), then writes under app data `custom_nodes/`; errors on invalid code; path traversal is stripped from the file name. |
| `read_custom_node` | `{ path }` | source string | Reads app-data custom nodes or bundled default nodes only. |
| `start_proxy` | `{ config }` | void | Requires all engine environment values documented in the Development Guide, validates the config (errors if invalid), saves it, starts `mitmdump`, and enables supported system proxy settings. |
| `stop_proxy` | none | void | Restores the stored system proxy snapshot and stops `mitmdump`. |
| `proxy_status` | none | `{ running }` | Reports child-process state and restores system proxy if the child died. |
| `read_recent_events` | `{ limit }` | JSON array | Reads the last N JSONL event entries. |
| `query_events` | `{ query }` | JSON array | Applies the event query shape documented in [Event query API](config-state-events.md#event-query-api). |
| `network_info` | none | `{ localHost, lanHost }` | Returns `127.0.0.1` and best-effort LAN IP. |
| `mode_runtime_status` | none | `{ activeModeId, frictionSeconds, pending }` | Applies due schedule/countdown work and returns the backend-owned mode state. |
| `request_mode_switch` | `{ targetModeId }` | mode runtime status | Switches immediately or starts/replaces a friction countdown based on the active source mode. Selecting the active mode cancels a pending request. |
| `cancel_mode_switch` | none | mode runtime status | Cancels the pending manual mode switch. |
| `show_main_window` | none | void | Shows/focuses the dashboard window and hides the popover when present. |
| `resize_popover` | `{ height }` | void | Resizes the popover window to content height, capped to the monitor work area. |
| `quit_app` | none | void | Stops the proxy, restores system proxy settings, then exits the app; refuses to quit if cleanup fails. |

## Cross-module constraints

- Config schema must stay compatible across React TypeScript, Rust mode/proxy readers, and Python `AppConfig`.
- React must change `activeModeId` through mode commands; normal config writes preserve the stored runtime value.
- Config validation runs only in Python (`validate_cli.py`); React and Rust render the returned issues but must not re-implement rules.
- `mitmdump` option names must match between Rust arg generation and the Python addon.
- Event JSON written by Python must stay readable by Tauri and meaningful to React notification handling.
- Custom node paths written by Tauri must be importable by Python.
- Tauri owns system-proxy capture and restore; the snapshot persists across crashes and is restored without user action (see [Data Layer](config-state-events.md#storage-overview) and [Tauri Desktop Backend](../2_component/tauri-desktop-backend.md#macos-system-proxy-handling)).
- Desktop proxy startup requires every engine environment value; missing or empty values return an error before proxy launch.
