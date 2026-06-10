# Command Contracts

## Scope

This document owns the stable request/response contracts between the React dashboard and the Tauri backend.

Implementation details live in [Tauri Desktop Backend](../2_component/tauri-desktop-backend.md). Event schemas and config shapes live in [Data Layer](config-state-events.md).

## Commands exposed to React

| Command | Request | Response | Contract notes |
| --- | --- | --- | --- |
| `read_app_config` | none | config JSON | Ensures app-data config exists before reading. |
| `write_app_config` | `{ config }` | void | Writes the full app config as pretty JSON. |
| `write_custom_node` | `{ fileName, code }` | path string | Writes under app data `custom_nodes/`; path traversal is stripped from the file name. |
| `read_custom_node` | `{ path }` | source string | Reads app-data custom nodes or bundled default nodes only. |
| `start_proxy` | `{ config }` | void | Requires `POLICY_MAX_STEPS` in the environment, saves config, starts `mitmdump`, and enables supported system proxy settings. |
| `stop_proxy` | none | void | Restores the stored system proxy snapshot and stops `mitmdump`. |
| `proxy_status` | none | `{ running }` | Reports child-process state and restores system proxy if the child died. |
| `read_recent_events` | `{ limit }` | JSON array | Reads the last N JSONL event entries. |
| `query_events` | `{ query }` | JSON array | Applies the event query shape documented in [Event query API](config-state-events.md#event-query-api). |
| `network_info` | none | `{ localHost, lanHost }` | Returns `127.0.0.1` and best-effort LAN IP. |

## Cross-module constraints

- Config schema must stay compatible across React TypeScript, Rust `ProxySettings`, and Python `AppConfig`.
- `mitmdump` option names must match between Rust arg generation and the Python addon.
- Event JSON written by Python must stay readable by Tauri and meaningful to React notification handling.
- Custom node paths written by Tauri must be importable by Python.
- System proxy state is in memory only; crash recovery is not durable yet.
- Desktop proxy startup requires `POLICY_MAX_STEPS`; missing environment returns an error before proxy launch.
