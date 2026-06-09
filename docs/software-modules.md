# Software Modules and API Contracts

## Scope

This is the current module map and cross-layer command/API reference.

Detailed internals live in:

- [Tauri backend](architecture/2_component/tauri-desktop-backend.md)
- [React dashboard](architecture/2_component/react-dashboard.md)
- [Python proxy engine](architecture/2_component/python-proxy-engine.md)
- [Data layer](architecture/4_data_layer/config-state-events.md)

## Python proxy engine

Location: `src/proxy/`

### Addon and controller

| Module | Contract | Notes |
| --- | --- | --- |
| `proxy.addons.graph_proxy` | `addons = [GraphProxyAddon()]` | mitmproxy entrypoint. Registers `productive_config_path`, `productive_state_path`, `productive_event_log_path`. |
| `proxy.controller.mitmproxy.graph_controller` | `configure(config_path, state_path, event_log_path)`, `request(flow)` | Loads config/state/event services and evaluates one graph per request. |

### Models

| Module | Contract | Rules |
| --- | --- | --- |
| `proxy.models.graph.policy_graph` | `AppConfig.from_dict`, `active_mode`, `custom_block`, `PolicyGraph.start_node`, `next_node_id`, `node_by_id` | Active mode must exist. Each graph must have exactly one `start`. Exact output edge wins over `*`. |
| `proxy.models.runtime.context` | `RequestContext(...)`, `merge_data(values)` | Carries flow, config, state, event log, mutable request data, and clock. |
| `proxy.models.runtime.result` | `NodeResult.from_value(value)` | Accepts `None`, `str`, `dict`, or `NodeResult`. |

### Services

| Module | Contract | Notes |
| --- | --- | --- |
| `services.config.config_service` | `ConfigService(path).load()` | Loads JSON into `AppConfig`. |
| `services.events.event_log` | `append(event)`, `read_recent(limit)` | JSONL event file. Creates parent dirs on append. |
| `services.state.state_store` | `load`, `save`, `track_usage`, `usage_today` | Tracks usage by UTC day and request gaps. |
| `services.graph.builtin_nodes` | `BuiltinNodeRunner.run(node, context)` | Supports `start`, `end`, `if`, `switch`, `block`, `log`, `track_time`, `notify`, `redirect`. |
| `services.graph.custom_blocks` | `CustomBlockRunner(config).run(node, context)` | Imports trusted Python files and calls their entrypoint. No sandbox. |
| `services.graph.evaluator` | `GraphEvaluator(config).evaluate(context)` | Starts at active graph start node and routes by output. No loop guard. |

## Tauri desktop backend

Location: `src/frontend/tauri/`

### Commands exposed to React

| Command | Request | Response | Behavior |
| --- | --- | --- | --- |
| `read_app_config` | none | config JSON | Copies default config to app data if missing. |
| `write_app_config` | `{ config }` | void | Writes pretty JSON to app data. |
| `write_custom_block` | `{ fileName, code }` | path string | Writes under app data `custom_blocks/`. |
| `start_proxy` | `{ config }` | void | Saves config, starts `mitmdump`, enables macOS system proxy. |
| `stop_proxy` | none | void | Restores system proxy snapshot and stops `mitmdump`. |
| `proxy_status` | none | `{ running }` | Also restores system proxy if the child process died. |
| `read_recent_events` | `{ limit }` | JSON array | Reads last N JSONL entries. |
| `network_info` | none | `{ localHost, lanHost }` | Best-effort LAN IP detection. |

### Rust modules

| Module | Contract | Notes |
| --- | --- | --- |
| `controller.commands` | Tauri command functions | Owns app state, start/stop rollback, config path discovery. |
| `controller.tray.actions` | `TrayAction::from_menu_id(id)` | Maps menu IDs to actions. |
| `models.proxy.settings` | `ProxySettings::from_app_config(value)` | Reads `config.proxy`. |
| `services.config.file_store` | `read_json`, `write_json` | JSON file helper. |
| `services.config.runtime_paths` | `RuntimePaths::new(app_data_dir, repo_root)` | Builds config/state/event/custom block paths. |
| `services.proxy.mitmdump_args` | `build_mitmdump_args(settings, paths)` | Builds `mitmdump` CLI args. |
| `services.proxy.process_service` | `start`, `start_args`, `stop`, `is_running` | Child process lifecycle. |
| `services.system_proxy` | `capture_system_proxy_snapshot`, `enable_system_proxy`, `restore_system_proxy` | macOS `networksetup`; non-macOS enable is unsupported. |
| `services.events.event_log` | `read_recent_events(path, limit)` | Reads recent JSONL events. |
| `services.network.network_info` | `detect_network_info()` | Returns local and LAN host info. |

## React dashboard

Location: `src/frontend/react/src/`

| Module | Responsibility |
| --- | --- |
| `App.tsx` | Top-level state, startup loading, view routing, proxy start/stop handlers. |
| `views/SettingsView.tsx` | Proxy status and proxy settings form. |
| `views/OperatorsView.tsx` | Custom Python operator list/editor. |
| `views/PoliciesView.tsx` | Mode management and graph editor host. |
| `components/GraphEditor.tsx` | React Flow graph canvas and node/edge conversion. |
| `components/TerminalNav.tsx` | Main navigation. |
| `models/config/types.ts` | TypeScript config schema. |
| `models/config/defaultConfig.ts` | Browser-side fallback default config. |
| `services/config/configRepository.ts` | Tauri config command wrapper. |
| `services/config/configValidation.ts` | Minimal active mode/start node validation. |
| `services/graph/graphOperations.ts` | Pure graph editing helpers. |
| `services/proxy/proxyRepository.ts` | Tauri proxy command wrapper. |
| `services/notifications/notificationService.ts` | Notification event deduplication. |
| `services/notifications/tauriNotifier.ts` | Native notification adapter. |
| `services/tauri/tauriClient.ts` | Tauri `invoke` client. |

## Test layout

```text
test/unit/                         Python engine unit tests
test/integration/                  Python graph flow/default tests
test/unit/frontend/tauri/          Rust/Tauri tests
test/unit/frontend/react/          React/Vitest tests
```

## Important cross-module constraints

- Config schema must stay compatible across React TypeScript, Rust `ProxySettings`, and Python `AppConfig`.
- `mitmdump` option names must match between Rust arg generation and the Python addon.
- Event JSON written by Python must stay readable by Tauri and meaningful to React notification handling.
- Custom block paths written by Tauri must be importable by Python.
- System proxy state is in memory only; crash recovery is not durable yet.
