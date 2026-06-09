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
| `proxy.addons.policy_proxy` | `addons = [PolicyProxyAddon()]` | mitmproxy entrypoint. Registers `productive_config_path`, `productive_state_path`, `productive_event_log_path`. |
| `proxy.controller.mitmproxy.policy_controller` | `configure(config_path, state_path, event_log_path)`, `request(flow)` | Loads config/state/event services and evaluates active mode policies per request. |

### Models

| Module | Contract | Rules |
| --- | --- | --- |
| `proxy.models.policy.flow` | `AppConfig.from_dict`, `active_mode`, `custom_node`, `Policy.start_step`, `next_step_id`, `step_by_id` | Active mode must exist. Custom node paths must be absolute. Each policy must have exactly one `start`. Routes are exact. |
| `proxy.models.runtime.context` | `RequestContext(...)` | Carries flow, config, state, event log, mutable request data, and clock. |

### Services

| Module | Contract | Notes |
| --- | --- | --- |
| `services.config.config_service` | `ConfigService(path).load()` | Loads JSON into `AppConfig`. |
| `services.events.event_log` | `append(event)`, `read_recent(limit)` | JSONL event file. Creates parent dirs on append. |
| `services.events.observability` | request/policy/step/config events, `context.log` support | Emits filterable observability events for proxy behavior and custom nodes. |
| `services.state.state_store` | `load`, `save`, `track_usage`, `usage_today` | Tracks usage by UTC day and request gaps. |
| `services.policy.custom_nodes` | `CustomNodeRunner(config).run(step, input, context)` | Imports trusted Python files and calls `run(input, context, params)`. No sandbox. |
| `services.policy.operators` | `OperatorRunner.evaluate(step, input)` | Supports `if` and `switch` routing. |
| `services.policy.evaluator` | `PolicyEvaluator(config).evaluate(context)` | Runs active mode policies in order. Uses required `POLICY_MAX_STEPS` loop guard. |

## Tauri desktop backend

Location: `src/frontend/tauri/`

### Commands exposed to React

| Command | Request | Response | Behavior |
| --- | --- | --- | --- |
| `read_app_config` | none | config JSON | Copies default config to app data if missing. |
| `write_app_config` | `{ config }` | void | Writes pretty JSON to app data. |
| `write_custom_node` | `{ fileName, code }` | path string | Writes under app data `custom_nodes/`; strips path traversal from file name. |
| `read_custom_node` | `{ path }` | source string | Reads app-data custom nodes and bundled default nodes. |
| `start_proxy` | `{ config }` | void | Saves config, starts `mitmdump`, enables macOS system proxy. |
| `stop_proxy` | none | void | Restores system proxy snapshot and stops `mitmdump`. |
| `proxy_status` | none | `{ running }` | Also restores system proxy if the child process died. |
| `read_recent_events` | `{ limit }` | JSON array | Reads last N JSONL entries. |
| `query_events` | `{ query }` | JSON array | Reads last N JSONL entries matching filters such as `category`, `type`, `level`, `policyId`, `stepId`, `requestId`, `search`, `since`, and `until`. |
| `network_info` | none | `{ localHost, lanHost }` | Best-effort LAN IP detection. |

### Rust modules

| Module | Contract | Notes |
| --- | --- | --- |
| `controller.commands` | Tauri command functions | Owns app state, start/stop rollback, config path discovery. |
| `controller.tray.actions` | `TrayAction::from_menu_id(id)` | Maps menu IDs to actions. |
| `models.proxy.settings` | `ProxySettings::from_app_config(value)` | Reads `config.proxy`. |
| `services.config.file_store` | `read_json`, `write_json` | JSON file helper. |
| `services.config.runtime_paths` | `RuntimePaths::new(app_data_dir, repo_root)` | Builds config/state/event/custom node paths. |
| `services.proxy.mitmdump_args` | `build_mitmdump_args(settings, paths)` | Builds `mitmdump` CLI args. |
| `services.proxy.process_service` | `start`, `start_args`, `stop`, `is_running` | Child process lifecycle. |
| `services.system_proxy` | `capture_system_proxy_snapshot`, `enable_system_proxy`, `restore_system_proxy` | macOS `networksetup`; non-macOS enable is unsupported. |
| `services.events.event_log` | `read_recent_events(path, limit)`, `query_events(path, query)` | Reads recent/filterable JSONL events. |
| `services.network.network_info` | `detect_network_info()` | Returns local and LAN host info. |

## React dashboard

Location: `src/frontend/react/src/`

| Module | Responsibility |
| --- | --- |
| `App.tsx` | Top-level state, startup loading, view routing, proxy start/stop handlers. |
| `views/SettingsView.tsx` | Proxy status and proxy settings form. |
| `views/ModesView.tsx` | Active mode selection and mode create/edit/delete. |
| `views/NodesView.tsx` | Custom Python node list/editor. |
| `views/PolicyView.tsx` | Ordered policy management and graph editor host. |
| `views/ObservabilityView.tsx` | Filterable event log and request timeline. |
| `components/GraphEditor.tsx` | React Flow policy canvas and step/edge conversion. |
| `components/TerminalNav.tsx` | Main navigation. |
| `models/config/types.ts` | TypeScript config schema. |
| `models/config/defaultConfig.ts` | Browser-side fallback default config. |
| `services/config/configEditing.ts` | Browser-side mode/policy ID and factory helpers. |
| `services/config/configRepository.ts` | Tauri config command wrapper. |
| `services/config/configValidation.ts` | Minimal active mode/policy validation. |
| `services/policy/policyOperations.ts` | Pure policy editing helpers. |
| `services/proxy/proxyRepository.ts` | Tauri proxy and event query command wrapper. |
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
