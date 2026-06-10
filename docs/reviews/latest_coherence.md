# Truth & Consistency (Coherence) Review — Second Pass

Scope: all `.md` under `docs/` except `unofficial/`, `decisions/`, `reviews/`, and `README.md`.
Dimension: factual accuracy vs. the codebase and mutual consistency between docs. Not placement/depth, not redundancy.

This is the **second coherence pass** (after the first-pass fixes). Every first-pass fix was re-verified against current code and is accurate. The pass surfaced **one real contradiction** and **two minor imprecisions**; everything else is consistent.

## Summary table

| Document | Issue type | Severity | Description |
| --- | --- | --- | --- |
| `development.md` | Docs-vs-code + cross-doc contradiction | **Medium** | CI section says the Tauri shell "has no `#[test]` targets yet … Add a job when Rust tests exist", but the crate has 8 `[[test]]` targets and 8 test files (~20 `#[test]` fns). Contradicts the same file's "Run tests → `cargo test`" and `tauri-desktop-backend.md` Tests section. |
| `3_deployment/local-desktop-runtime.md` | Docs-vs-code + cross-doc inconsistency | **Low–Med** | "Required startup environment" implies desktop startup needs only `POLICY_MAX_STEPS`; the `mitmdump` the app launches needs all four engine vars at runtime (Python raises if any `PRODUCTIVE_PROXY_*` is missing). `development.md` states this correctly; the deployment doc should align. |
| `4_data_layer/config-state-events.md` | Docs-vs-code imprecision | **Low** | Event schema says request fields (`url/host/path/method`) are carried on `request_finished` "When blocked"; code attaches them to **all** `request_finished` events (allowed and blocked). Only `decidingPolicyId/Name` and `responseStatus` are blocked-only. |

No phantom components, no deleted-but-documented services, no schema drift found beyond the above.

## Cross-document contradictions

### 1. Rust/Tauri tests: "don't exist" vs. "run them" (Medium)

Three places describe the Rust test situation; two are right, one is wrong:

- `development.md` → **Run tests**: "Rust/Tauri tests: `cd src/frontend/tauri` / `cargo test`" — **accurate**.
- `tauri-desktop-backend.md` → **Tests**: "Rust test targets are registered in `src/frontend/tauri/Cargo.toml` and live under `test/unit/frontend/tauri/`. Coverage includes file store, runtime paths, event log reads, network info, mitmdump arg generation, process lifecycle, tray action mapping, and macOS system proxy command construction/parsing." — **accurate**.
- `development.md` → **Continuous integration**: "The Tauri/Rust shell is not built in CI: it **has no `#[test]` targets yet** and compiling it needs webkit system dependencies. **Add a job when Rust tests exist.**" — **inaccurate**.

Code reality (`src/frontend/tauri/Cargo.toml` + `test/unit/frontend/tauri/`):

```
[[test]] tauri_file_store      → config/file_store.rs        (1 #[test])
[[test]] tauri_runtime_paths   → config/runtime_paths.rs     (1)
[[test]] tauri_event_log       → events/event_log.rs         (2)
[[test]] tauri_network_info    → network/network_info.rs     (1)
[[test]] tauri_mitmdump_args   → proxy/mitmdump_args.rs      (3)
[[test]] tauri_proxy_process   → proxy/proxy_process.rs      (4)
[[test]] tauri_tray_actions    → tray/tray_actions.rs        (1)
[[test]] tauri_system_proxy    → system_proxy/networksetup.rs(7)
```

What *is* still true: `.github/workflows/ci.yml` has only `python`, `frontend`, and `benchmark` jobs — the Rust tests are genuinely **not run in CI**. So the sentence "The Tauri/Rust shell is not built in CI" is correct; only the **reason** ("no `#[test]` targets yet" / "when Rust tests exist") is false and self-contradictory.

### 2. Startup environment scope (Low–Med)

- `development.md` → **Environment**: "The desktop app pre-checks only `POLICY_MAX_STEPS` before `start_proxy` launches `mitmdump`; the other three are enforced by the Python engine at runtime, so **all four must be present** in the environment the app starts `mitmdump` from." — **accurate** (matches `commands.rs::require_env("POLICY_MAX_STEPS")` + the Python `_*_from_env()` guards).
- `local-desktop-runtime.md` → **Required startup environment**: "Desktop proxy startup … require `POLICY_MAX_STEPS` … The **manual proxy helper also** requires the `PRODUCTIVE_PROXY_*` variables." — reads as if desktop startup needs only `POLICY_MAX_STEPS`. Because the desktop-launched `mitmdump` runs the Python engine, a desktop start with only `POLICY_MAX_STEPS` set passes the Rust pre-check, then the engine raises (e.g. `Missing PRODUCTIVE_PROXY_TELEMETRY_VERBOSE`) at runtime. The deployment doc is incomplete relative to `development.md`.

## Docs-vs-code inaccuracies

### 3. `request_finished` request fields (Low)

`config-state-events.md`, Event log schema: "`request_finished.outcome` is `allowed` or `blocked`. When blocked, it also carries `decidingPolicyId`, `decidingPolicyName`, and `responseStatus`, **plus the request fields (`url`, `host`, `path`, `method`)**."

`observability.py::request_finished` spreads `_request_fields(context)` (`method/url/host/path`) on **every** `request_finished` event, regardless of outcome. Only `decidingPolicyId/Name` (policy passed) and `responseStatus`/`responseSet:true` (response present) are blocked-only. The surrounding text already states correctly that request fields appear on request-level events; only the "When blocked … plus the request fields" grouping is misleading.

## Verified consistent (no action)

Re-checked against current code and confirmed accurate and mutually consistent:

- **Durable system-proxy snapshot** (the first-pass headline fix): `command-contracts.md`, `tauri-desktop-backend.md`, `local-desktop-runtime.md`, `config-state-events.md`, `current-assumptions.md`, `readiness.md`, `usage.md` all describe a snapshot persisted to `system_proxy_snapshot.json` and auto-restored on next start/stop/status and on exit, with manual `networksetup` as fallback. Matches `lease.rs` (`save_/load_/remove_`), `proxy_lifecycle.rs` (`restore_marked_system_proxy`, `start_proxy_monitor`), `lib.rs` (`RunEvent::Exit` → `shutdown_cleanup`), `runtime_paths.rs`.
- **Command contracts** (`command-contracts.md`): all 14 commands match `lib.rs` `generate_handler!` and `commands.rs`/`window.rs` semantics; `network_info` → `{localHost, lanHost}` (camelCase serde); `quit_app` refuses to quit on cleanup failure; `resize_popover`/`show_main_window` behavior matches.
- **Tray/popover** (`tauri-desktop-backend.md`): left-click toggles popover (`show_menu_on_left_click(false)`, `MouseButton::Left`), right-click native menu (`open_dashboard`/`quit`); popover decorationless/transparent/always-on-top, auto-dismiss — matches `lib.rs`, `popover.rs`, `tauri.conf.json` (`main` hidden; bundle `active:false`).
- **React entry points** (`react-dashboard.md`): label-based `<Popover/>`/`<App/>` mount + `popover-mode` class (`main.tsx`); `index.html`→`src/main.tsx`, `demo.html`→`src/demo/main.tsx`; 5 views, `TerminalNav`/`Select`, both repository command sets, issue shape `{scope, policyId, nodeId, stepIds, message, hint}` — all match code.
- **Engine semantics** (`python-proxy-engine.md`): addon options, `Request`/`Context` public surface (`api.py`), node/operator routing (`start`→`next/skip`, `end`, custom→`next`, `if`→`then/else`, `switch`→label + `default` fallthrough), loop guard — match `evaluator.py`/`operators.py`/`api.py`.
- **Data schemas** (`config-state-events.md`): proxy/mode/policy/step/edge/custom-node shapes and the default config match `default_config.json` exactly (`activeModeId:"productivity"`, modes `productivity`/`chilling`, policies `block-youtube-shorts`/`limit-reddit` "Limit Reddit", all 3 bundled nodes registered, proxy block verbatim); state schema + write-behind/`KeyError`/live-`get` semantics match `state_store.py`; event compaction (drop oldest half at byte budget) matches `event_log.py`; validation rule list (all 10 + "still missing") matches `validation.py`.
- **Env vars**: `POLICY_MAX_STEPS`, `PRODUCTIVE_PROXY_TELEMETRY_VERBOSE`, `PRODUCTIVE_PROXY_EVENT_LOG_MAX_BYTES`, `PRODUCTIVE_PROXY_STATE_FLUSH_SECONDS` — names/semantics match `evaluator.py`/`event_log.py`/`state_store.py`, `.env.example`, `run_mitm.sh`.
- **macOS mechanics** (`tauri-desktop-backend.md`): start/stop/restore flows, authenticated-proxy refusal, disabled/missing-endpoint restore — match `macos.rs`; non-macOS `enable` returns `Unsupported` (`mod.rs`).
- **Conceptual/logical** (`product.md`, `system-overview.md`): "blocks Reddit after 30 minutes" matches `limit-reddit` (`is-usage-over-limit seconds:1800`); flows and black-box boundaries consistent with the component/data docs.
- **CI jobs** (`development.md`): `python`/`frontend`/`benchmark` descriptions match `ci.yml` (the only inaccuracy in that section is finding #1).

## Suggested actions

1. **`development.md` (CI section) — fix finding #1.** Replace the reason: the Rust tests **exist** (run locally via `cargo test`, per the Run tests section) but are **not yet wired into CI** because building the shell needs webkit system dependencies. Drop "has no `#[test]` targets yet" and "Add a job when Rust tests exist"; reword to e.g. "CI does not yet run the Rust/Tauri tests (`cargo test` locally) because compiling the shell needs webkit system dependencies; add a job when that is set up." This also resolves the contradiction with `tauri-desktop-backend.md`.
2. **`local-desktop-runtime.md` (Required startup environment) — fix finding #2.** Note that although the desktop app only pre-checks `POLICY_MAX_STEPS`, the `mitmdump` it launches needs all four engine variables at runtime (consistent with `development.md#environment`); the `PRODUCTIVE_PROXY_*` engine vars are not manual-helper-only.
3. **`config-state-events.md` (Event log schema) — fix finding #3.** Move `url/host/path/method` out of the "When blocked" clause: request fields are on every `request_finished`; keep `decidingPolicyId/Name` and `responseStatus` as the blocked-only additions.

No documents describe deleted/nonexistent code; no schema or contract drift beyond the three items above.
