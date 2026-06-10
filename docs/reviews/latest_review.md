# Structure & Depth Review

Scope: all `.md` under `docs/` except `unofficial/`, `decisions/`, `reviews/`, and `README.md` files.
Dimension: does each doc live in the right folder and sit at the right abstraction level for that folder? (Not coherence vs. code; not redundancy.)

## Summary table

| File | Folder | Verdict |
| --- | --- | --- |
| `architecture/0_conceptual/product.md` | 0_conceptual | ✓ correct |
| `architecture/1_logical/system-overview.md` | 1_logical | ✓ correct (one trivially-minor term, see notes) |
| `architecture/2_component/python-proxy-engine.md` | 2_component | ✓ correct |
| `architecture/2_component/react-dashboard.md` | 2_component | ✓ correct |
| `architecture/2_component/react-graph-editor.md` | 2_component | ✓ correct |
| `architecture/2_component/tauri-desktop-backend.md` | 2_component | ✓ correct |
| `architecture/3_deployment/local-desktop-runtime.md` | 3_deployment | ✓ correct |
| `architecture/4_data_layer/command-contracts.md` | 4_data_layer | ✓ correct |
| `architecture/4_data_layer/config-state-events.md` | 4_data_layer | ✓ correct |
| `assumptions/current-assumptions.md` | assumptions | ✓ correct |
| `development.md` | docs root (operational) | ✓ correct |
| `roadmap/readiness.md` | roadmap | ✓ correct |
| `usage.md` | docs root (operational) | ✓ correct |

**No wrong-folder, wrong-depth, or split issues.** All 13 in-scope docs are correctly placed and layered. The prior structure pass's one depth leak (literal `POLICY_MAX_STEPS` in the logical doc) and its undocumented-surface gaps (menu-bar popover, persisted snapshot store, demo entry point, nav components) have been resolved by the fix pass. One minor documentation gap remains (status/event polling).

## Detailed findings

### `0_conceptual/product.md` — ✓
Stays high-level: purpose, actors, capabilities, default behavior, non-goals, safety boundaries, readiness. No file paths, no code, no algorithms. The macOS proxy and "run Python nodes" lines are framed as *capabilities*, not mechanics. Non-goals naming "bundled mitmproxy runtime" / "Linux automation" / "production-grade crash recovery" is scope language, which belongs at the conceptual layer. `Current readiness` is now a one-line pointer to `roadmap/readiness.md` — correctly defers status to the roadmap owner.

### `1_logical/system-overview.md` — ✓ (one trivially-minor term)
Describes components as black boxes (dashboard, backend, proxy process, policy engine, persistence, system-proxy integration) by purpose and relationship, plus logical flows and boundaries. Defers runtime mechanics to the component/deployment docs and schemas to the data layer. The earlier `POLICY_MAX_STEPS` leak is fixed → "required loop-guard configuration."
- **Trivially-minor:** the Request-evaluation flow names the edge label `next` ("custom nodes … continue through `next`"). `next` is a config/runtime label owned by the component/data layers. It reads as logical routing description and is not worth a split or a verdict change, but if a future edit touches that line, prefer "continue along their single outgoing edge" to keep the layer label-free.

### `2_component/python-proxy-engine.md` — ✓
Appropriately deep: addon options, controller responsibilities, config model, node/operator semantics with code, runtime-context vs. author API, evaluation loop, default nodes, state store, event log, tests. Rule lists and schemas correctly point to the data layer rather than restating them; what remains here is implementation mechanics. Right depth, right folder.

### `2_component/react-dashboard.md` — ✓
Component-level technical detail: entry points, styling rule, `App` state, navigation/shared components, per-view responsibilities, frontend service wrappers, browser-preview behavior, tests. The fix pass added the correct component-level facts (label-based `<Popover/>`/`<App/>` mount, `demo.html` → `demo/main.tsx`, `TerminalNav`/`Select`). Graph-editor internals are delegated to the sibling component doc via a pointer. No conceptual/deployment bleed.

### `2_component/react-graph-editor.md` — ✓
Deep and correctly scoped to the graph editor: component roles, graph/step behavior, performance rules, memoization checklist, React Flow settings, scaling notes. This is exactly the internal-mechanics depth `2_component` expects.

### `2_component/tauri-desktop-backend.md` — ✓
Native-backend internals: entry points, runtime state, command implementation notes, app-data paths, `mitmdump` launch args, macOS `networksetup` flows, the new **Durable restore across crashes** subsection (names `proxy_lifecycle.rs::restore_marked_system_proxy`, `start_proxy_monitor`, `lib.rs` `RunEvent::Exit`/`shutdown_cleanup`), the **Popover window** subsection (`controller/tray/popover.rs`, `toggle_popover`, `resize_popover`), and tray left/right-click behavior. All component-appropriate depth. Stable contracts are delegated to `command-contracts.md`.

### `3_deployment/local-desktop-runtime.md` — ✓
Deployed-resource view: runtime process tree, prerequisites, required startup env, app-data layout (now includes `system_proxy_snapshot.json`), LAN listen behavior, HTTPS/CA runtime caveat, packaging gaps, single-user scaling model. The macOS system-proxy section keeps only runtime/durability caveats and defers mechanics to the component doc and recovery commands to the usage guide — correct layering. The env-var requirement is a runtime concern and is acceptable here; it states the requirement without re-deriving engine internals.

### `4_data_layer/command-contracts.md` — ✓
Owns the React↔Tauri request/response contract table plus cross-module compatibility constraints. These are inter-process contracts/data formats — a correct fit for `4_data_layer`. Implementation is delegated to the backend component doc; event/config shapes to `config-state-events.md`. The new `show_main_window`/`resize_popover`/`quit_app` rows are contract-level (request/response/notes), not implementation.

### `4_data_layer/config-state-events.md` — ✓
The schema/contract owner: storage table, config/proxy/mode/policy/edge/custom-node schemas, default-node parameter contracts, state schema, event-log schema + query API, data lifecycle, validation boundaries. The added **system proxy snapshot** row + paragraph describe the stored record (what it holds) and defer its lifecycle to the component doc — data layer owns "what is stored," component owns "how." Right depth.

### `assumptions/current-assumptions.md` — ✓
Every entry is a genuine design assumption in Assumption / Why / Impact-if-wrong form. The reworked "The app is relaunched after a crash to finish proxy restore" entry is correctly framed as an assumption (the recovery depends on the app being reopened), not as a decision or a status note.

### `development.md` — ✓ (operational guide at docs root)
Contributor guide: prerequisites, env vars, test/bench/CI commands, run commands, source map, conventions, per-area dev notes, manual checklist. This is operational content outside the `0–4` architecture rubric; docs root is the right home (peer to `usage.md`). Internally consistent and not masquerading as architecture.

### `roadmap/readiness.md` — ✓
Status and remaining work: current status, "good enough" vs. blockers, completed-areas table, recommended next work, verification pointers. Correctly owns project status (which other docs now defer to it). Right folder.

### `usage.md` — ✓ (operational guide at docs root)
End-user guide: what it does, setup, start/stop, manual proxy mode, LAN, modes/policies, custom nodes, macOS recovery, user-facing limitations. Operational content at docs root, correctly placed. Defers mechanics/schema/status to the architecture, data-layer, and roadmap docs via pointers.

## Suggested actions

No moves, no splits, no wrong-depth corrections required.

Optional, low priority:
1. **Document dashboard polling** (gap, see below): add ~2 lines to `2_component/react-dashboard.md` describing `services/proxy/polling.ts` (`STATUS_POLL_MS = 2000`, `EVENT_POLL_MS`) — `App` and `Popover` poll `proxy_status` on an interval, and `ObservabilityView` polls events. This is real runtime behavior currently absent from every doc.
2. **Trivially-minor:** if `1_logical/system-overview.md`'s request-evaluation flow is edited later, replace the literal `next` edge label with a label-free phrasing to keep the logical layer free of config-level identifiers. Not worth a standalone edit.

## Gap analysis (documented vs. exists in code)

Now covered after the fix pass:
- **Menu-bar popover** — documented in `tauri-desktop-backend.md` (Popover window + tray left/right-click) and `react-dashboard.md` (`Popover.tsx`, label-based mount).
- **Persisted system-proxy snapshot** — documented as a store in `config-state-events.md`, a path in `tauri-desktop-backend.md`/`local-desktop-runtime.md`, and a durable-restore mechanism in `tauri-desktop-backend.md`.
- **Demo entry point** — `react-dashboard.md` documents `demo.html` → `src/demo/main.tsx`.
- **Primary navigation / shared dropdown** — `react-dashboard.md` lists `components/TerminalNav.tsx` and `components/Select.tsx`.

Remaining gaps:
- **Status/event polling (minor):** `src/frontend/react/src/services/proxy/polling.ts` exports `STATUS_POLL_MS` (2000 ms) and `EVENT_POLL_MS`, consumed by `App.tsx`, `Popover.tsx`, and `ObservabilityView.tsx`. No doc mentions that the dashboard refreshes status/events on an interval. → `2_component/react-dashboard.md`.

Not gaps (intentionally not enumerated, correct depth):
- Internal React helpers `services/policy/codeTemplates.ts`, `services/policy/policyOperations.ts`, `services/search/search.ts`, and `services/tauri/tauriClient.ts` are leaf implementation files. The component docs describe their meaningful surfaces ("thin wrapper around Tauri commands," "fuzzy-searches," inline templates) without enumerating every file, which is appropriate for `2_component`.
- Tauri leaf modules (`services/config/file_store.rs`, `services/system_proxy/macos.rs`, etc.) are covered by behavior-level descriptions in `tauri-desktop-backend.md`; per-file enumeration is unnecessary.
