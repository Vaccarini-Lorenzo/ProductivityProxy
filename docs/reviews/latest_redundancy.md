# Documentation Redundancy & Bloat Review

Scope: Markdown docs under `docs/`, excluding `README.md`, `docs/reviews/`, `docs/unofficial/`, and `docs/decisions/`.

This review only checks conciseness and layering. It does not judge folder placement or factual accuracy.

## Documents checked

- `docs/SKILL.md`
- `docs/architecture/0_conceptual/product.md`
- `docs/architecture/1_logical/system-overview.md`
- `docs/architecture/2_component/python-proxy-engine.md`
- `docs/architecture/2_component/react-dashboard.md`
- `docs/architecture/2_component/tauri-desktop-backend.md`
- `docs/architecture/3_deployment/local-desktop-runtime.md`
- `docs/architecture/4_data_layer/config-state-events.md`
- `docs/assumptions/current-assumptions.md`
- `docs/building-plan.md`
- `docs/development.md`
- `docs/react-flow-best-practices.md`
- `docs/software-modules.md`
- `docs/usage.md`

## Summary table

| File A | File B | What's duplicated | Keep it in |
| --- | --- | --- | --- |
| `architecture/0_conceptual/product.md` | `building-plan.md` | Readiness limitations: manual mitmproxy, manual CA, unsandboxed nodes, loop guard, Linux gap, crash recovery. | Keep product scope/non-goals in `product.md`; keep roadmap deltas in `building-plan.md`; remove repeated limitation inventory from one side, preferably `building-plan.md`. |
| `architecture/0_conceptual/product.md` | `usage.md` | Default modes and high-level current limitations. | Keep default behavior in `product.md`; keep only operational warnings in `usage.md`. |
| `architecture/0_conceptual/product.md` | `building-plan.md` | Deferred non-goals repeat conceptual non-goals: cloud sync, accounts, enterprise management, sandboxing, packaging/polish. | Keep non-goals in `product.md`; trim `building-plan.md` to roadmap items not already covered. |
| `architecture/1_logical/system-overview.md` | `usage.md` | Start/stop proxy sequence is restated as backend substeps in the usage guide. | Keep logical sequence in `system-overview.md`; keep user clicks/outcomes in `usage.md`. |
| `architecture/1_logical/system-overview.md` | `architecture/2_component/tauri-desktop-backend.md` | Start/stop flow appears in both black-box and implementation form. | Keep black-box flow in `system-overview.md`; keep rollback/networksetup details in `tauri-desktop-backend.md`. Avoid repeating the same numbered flow. |
| `architecture/3_deployment/local-desktop-runtime.md` | `development.md` | Source-tree commands and prerequisites, especially `npm run tauri dev` and manual proxy helper commands. | Keep developer command reference in `development.md`; trim deployment doc to runtime model and deployed resources. |
| `architecture/3_deployment/local-desktop-runtime.md` | `usage.md` | LAN behavior, HTTPS CA requirement, macOS proxy lifecycle, and manual recovery are explained in both. | Keep runtime mechanics in `local-desktop-runtime.md`; keep user-facing recovery steps in `usage.md`. |
| `architecture/4_data_layer/config-state-events.md` | `architecture/2_component/tauri-desktop-backend.md` | App data files: config, state, events, custom nodes. | Keep persisted artifact/schema ownership in `config-state-events.md`; keep only Tauri `RuntimePaths` implementation detail in `tauri-desktop-backend.md`. |
| `architecture/4_data_layer/config-state-events.md` | `architecture/1_logical/system-overview.md` | Local persistence is listed in both. | Keep detailed storage table in `config-state-events.md`; keep only one logical sentence in `system-overview.md`. |
| `architecture/4_data_layer/config-state-events.md` | `architecture/2_component/python-proxy-engine.md` | Event fields, event types, and custom node logging API are described in both. | Keep event schema/query details in `config-state-events.md`; keep emitter behavior in `python-proxy-engine.md`. |
| `architecture/4_data_layer/config-state-events.md` | `architecture/2_component/react-dashboard.md` | Observability filters/query shape are repeated from both data/API and UI angles. | Keep query contract and event fields in `config-state-events.md`; keep UI affordances in `react-dashboard.md`. |
| `architecture/2_component/python-proxy-engine.md` | `usage.md` | Custom node entrypoint and trusted/unsandboxed warning. | Keep execution contract in `python-proxy-engine.md`; keep risk assumption in `assumptions/current-assumptions.md`; shorten `usage.md`. |
| `architecture/2_component/python-proxy-engine.md` | `assumptions/current-assumptions.md` | Trusted custom Python code / no sandbox. | Keep technical execution in `python-proxy-engine.md`; keep why/impact risk framing in `assumptions/current-assumptions.md`. No removal required if the Python doc stays technical. |
| `architecture/2_component/tauri-desktop-backend.md` | `software-modules.md` | Tauri command list and command purposes. | Prefer keeping request/response API contracts in `software-modules.md`; trim the component doc to implementation details or link to the contract table. |
| `architecture/2_component/react-dashboard.md` | `software-modules.md` | React views/services/module responsibilities. | Keep UI architecture in `react-dashboard.md`; shorten the React section in `software-modules.md` to a cross-reference or compact index. |
| `architecture/2_component/python-proxy-engine.md` | `software-modules.md` | Python modules, model rules, services, evaluator, loop guard, events/state. | Keep internals in `python-proxy-engine.md`; keep only stable public contracts and cross-module constraints in `software-modules.md`. |
| `development.md` | `building-plan.md` | Verification/test command blocks. | Keep test/build commands in `development.md`; replace `building-plan.md` checklist commands with a link. |
| `architecture/2_component/*` | `building-plan.md` | Completed phase lists restate implemented architecture and component capabilities. | Keep current architecture in component/logical docs; make `building-plan.md` focus on remaining work and milestones. |
| `react-flow-best-practices.md` | `architecture/2_component/react-dashboard.md` | Light overlap around `GraphEditor.tsx` and `@xyflow/react`. | Keep performance rules in `react-flow-best-practices.md`; keep only graph-editor role in `react-dashboard.md`. |

## Detailed findings

### 1. Readiness and limitations are repeated too many times

The same limitation set appears in several forms:

- manual `mitmproxy` installation,
- manual mitmproxy CA trust,
- custom Python nodes are unsandboxed,
- `POLICY_MAX_STEPS` loop guard,
- Linux system proxy automation is unsupported,
- packaged runtime/bundling is unresolved,
- crashes can leave macOS proxy settings enabled.

Repeated in:

- `architecture/0_conceptual/product.md` — `Current readiness summary`, `Non-goals`, `Safety boundaries`.
- `building-plan.md` — `Not ready for broad daily use yet`, phase remaining items, deferred non-goals.
- `architecture/3_deployment/local-desktop-runtime.md` — prerequisites, HTTPS, macOS lifecycle, packaging status.
- `usage.md` — before running, recovery, current limitations.
- `assumptions/current-assumptions.md` — assumptions with why/impact.

Owning layers:

- Conceptual owns scope and non-goals.
- Deployment owns runtime prerequisites, packaging/runtime gaps, OS behavior, and recovery mechanics.
- Assumptions owns the risk rationale and impact if assumptions are wrong.
- Usage owns only the user actions needed to run/recover.
- Building plan should own roadmap deltas, not a second architecture/limitations inventory.

Suggested trim:

- Reduce `product.md` readiness to a short one-paragraph status and keep non-goals there.
- Remove or compress `building-plan.md` `Not ready for broad daily use yet`; point to deployment/assumptions for permanent limitations.
- Keep `usage.md` warnings only where they affect immediate user action.

Unique detail to preserve:

- `building-plan.md` includes roadmap-specific items like clearer diagnostics, reset-to-defaults, and validation work. Keep those as remaining work.

### 2. Default modes/default policies are described in three places

Repeated in:

- `product.md` — `Default behavior`.
- `usage.md` — `Modes and policies`.
- `building-plan.md` — `Default policies` phase.

The content is mostly the same: Productivity blocks YouTube Shorts, tracks Reddit, blocks Reddit after a threshold, and Chilling allows traffic.

Owning layer:

- Keep the canonical default behavior summary in `product.md`, because defaults describe what the product is meant to do at the product level.

Suggested trim:

- In `usage.md`, keep a short user-facing line such as “Default modes are Productivity and Chilling” and link/reference the default behavior section instead of restating all policy details.
- In `building-plan.md`, remove detailed default-policy behavior from the completed phase list. A completed roadmap item does not need to restate product behavior.

Unique detail to preserve:

- If `usage.md` keeps setup-oriented wording, preserve only what helps a user choose a mode.

### 3. Proxy start/stop flow is restated across logical, component, deployment, and usage docs

Repeated in:

- `system-overview.md` — `Start proxy` and `Stop proxy` logical flows.
- `tauri-desktop-backend.md` — macOS start/stop flow and rollback behavior.
- `local-desktop-runtime.md` — macOS lifecycle and failure modes.
- `usage.md` — “The backend will…” start sequence and stop sequence.

Owning layers:

- `system-overview.md` owns the black-box service interaction sequence.
- `tauri-desktop-backend.md` owns implementation details: Rust state, snapshot handling, `networksetup`, rollback.
- `local-desktop-runtime.md` owns runtime consequences and failure modes.
- `usage.md` should not restate backend internals; it should tell users what to click and what outcome to expect.

Suggested trim:

- Remove the numbered backend substeps from `usage.md` and replace with a shorter outcome statement.
- In `tauri-desktop-backend.md`, avoid duplicating the exact logical flow already in `system-overview.md`; focus on implementation details and rollback.

Unique detail to preserve:

- Keep rollback behavior in `tauri-desktop-backend.md`.
- Keep manual recovery commands in `usage.md` because they are actionable for users.

### 4. App data paths and persisted files are listed in too many places

Repeated in:

- `system-overview.md` — local persistence list.
- `tauri-desktop-backend.md` — `RuntimePaths` mapping.
- `local-desktop-runtime.md` — OS-specific app data path shapes.
- `config-state-events.md` — storage overview and lifecycle.
- `software-modules.md` — runtime path and file store module contracts.

Owning layers:

- `config-state-events.md` owns persisted artifact names, formats, schemas, and lifecycle.
- `local-desktop-runtime.md` owns OS-specific physical locations.
- `tauri-desktop-backend.md` owns how `RuntimePaths` is built internally.
- `system-overview.md` only needs to say data is local.

Suggested trim:

- Shorten `system-overview.md` local persistence to one sentence.
- In `tauri-desktop-backend.md`, keep the `RuntimePaths` implementation concern but avoid re-documenting the storage table.
- In `software-modules.md`, keep module names/contracts only; link to the data-layer doc for file/schema detail.

Unique detail to preserve:

- OS-specific paths in `local-desktop-runtime.md`.
- Schema and lifecycle detail in `config-state-events.md`.

### 5. Event and observability details are duplicated across data, component, UI, and API docs

Repeated in:

- `config-state-events.md` — event schema, known event types, custom node logging API, query API.
- `python-proxy-engine.md` — event log fields, automatic events, custom node logging snippet.
- `react-dashboard.md` — Observability filters.
- `tauri-desktop-backend.md` — `read_recent_events` and `query_events` commands.
- `software-modules.md` — event service and query command filters.

Owning layers:

- Data layer owns event schemas, event fields, and query contract.
- Python component owns when/how events are emitted.
- React component owns how the UI presents filters and timelines.
- Tauri/software module docs should only identify command boundaries unless they add implementation detail.

Suggested trim:

- Remove event field lists from `python-proxy-engine.md`; link to `config-state-events.md` for the schema.
- In `software-modules.md`, avoid repeating the full `query_events` filter list if it remains in the data-layer doc.
- Keep `react-dashboard.md` focused on user-visible filter controls, not event contract detail.

Unique detail to preserve:

- `context.log` behavior belongs partly in Python, but the exact JSON shape belongs in data layer.

### 6. Custom node contract and trust warning are repeated

Repeated in:

- `product.md` — custom nodes are powerful and trusted.
- `python-proxy-engine.md` — entrypoint, execution rules, no sandbox.
- `usage.md` — entrypoint and trust warning.
- `assumptions/current-assumptions.md` — trusted custom nodes assumption with impact.
- `config-state-events.md` — custom node config and creation lifecycle.
- `building-plan.md` — custom node loading and sandboxing limitations.

Owning layers:

- `python-proxy-engine.md` owns the execution contract: `run(input, context, params)` and routing/return behavior.
- `assumptions/current-assumptions.md` owns why trusted custom nodes are assumed and what happens if that is wrong.
- `config-state-events.md` owns stored custom-node config shape and file lifecycle.
- `usage.md` only needs a short warning and link/reference.

Suggested trim:

- Remove the full custom-node code block from `usage.md` if `python-proxy-engine.md` remains the contract owner.
- Keep `product.md` safety boundary as one sentence, not another technical explanation.
- Keep sandboxing as a conceptual non-goal or assumption; avoid repeating it in every limitations list.

Unique detail to preserve:

- Tauri filename/path handling belongs in Tauri/software module docs, not in the generic custom-node warning.

### 7. `software-modules.md` duplicates the component architecture docs

`software-modules.md` is useful as a cross-module index/API reference, but it repeats detail already owned by component docs:

- Python model/service responsibilities duplicate `python-proxy-engine.md`.
- Tauri command list duplicates `tauri-desktop-backend.md`.
- React views/services duplicate `react-dashboard.md`.
- Event/query details duplicate `config-state-events.md`.
- Test layout duplicates `development.md` and component test sections.

Suggested shape:

- Keep `software-modules.md` as a compact API/module index:
  - stable command names,
  - request/response contracts,
  - cross-module constraints.
- Remove explanatory behavior that belongs to component or data-layer docs.
- Use links instead of restating internals.

Unique detail to preserve:

- The `Important cross-module constraints` section is valuable and should stay; it provides a cross-layer perspective not owned by a single component doc.

### 8. `building-plan.md` is the largest source of bloat

The roadmap doc repeats:

- current architecture state from logical/component docs,
- default policies from product/usage,
- limitations from product/deployment/assumptions,
- test commands from development,
- non-goals from conceptual docs.

Owning role for this file:

- milestones,
- remaining work,
- readiness gates,
- recommended next work.

Suggested trim:

- Replace `Current state` with a short status sentence and links to architecture docs.
- In completed phases, keep phase names and maybe one-line completion status; remove long `Done` lists that repeat component docs.
- Keep `Remaining` items, but avoid restating permanent assumptions/limitations.
- Replace the verification command block with “Run the checks in `development.md`”.
- Remove `Deferred non-goals` or replace with a link to `product.md` non-goals.

### 9. Developer/run commands are repeated across root and deployment docs

Repeated commands:

- `cd src/frontend/react && npm run tauri dev`
- `.env.example` + `./scripts/run_mitm.sh`
- test/build commands

Repeated in:

- `development.md`
- `usage.md`
- `local-desktop-runtime.md`
- `building-plan.md`

Owning layers:

- `development.md` owns test/build/developer command reference.
- `usage.md` owns user-facing run steps.
- `local-desktop-runtime.md` owns runtime model, not command duplication.
- `building-plan.md` should not own command references.

Suggested trim:

- Remove `Development commands` from `local-desktop-runtime.md` or replace it with a link to `development.md`/`usage.md`.
- Remove verification commands from `building-plan.md`.
- Decide whether manual proxy command lives in `usage.md` or `development.md`; keep the other as a link.

### 10. Test coverage summaries are repeated

Repeated in:

- `python-proxy-engine.md` — Python test coverage list.
- `react-dashboard.md` — React/Vitest coverage list.
- `tauri-desktop-backend.md` — Rust test coverage list.
- `software-modules.md` — test layout.
- `development.md` — test commands.
- `building-plan.md` — verification checklist.

Owning layers:

- `development.md` owns how to run tests.
- Component docs may keep a short “tests cover this component” summary.
- `building-plan.md` should point to development docs for commands.

Suggested trim:

- Keep component test sections short.
- Remove test layout from `software-modules.md` unless it is strictly an index.
- Remove command duplication from `building-plan.md`.

### 11. React Flow best-practices overlap is minor and acceptable

`react-flow-best-practices.md` and `react-dashboard.md` both mention `GraphEditor.tsx` and `@xyflow/react`.

This is not a major redundancy because:

- `react-dashboard.md` explains the graph editor's role inside the dashboard.
- `react-flow-best-practices.md` explains performance/usage rules for maintaining the graph editor.

Suggested trim:

- Keep `react-dashboard.md` graph editor section short.
- Keep all performance guidance in `react-flow-best-practices.md`.

## Same-layer overlap

No same-folder architecture files should be merged:

- The three `2_component` files cover different components: Python proxy, React dashboard, and Tauri backend.
- `react-flow-best-practices.md` is a focused maintenance note, not a duplicate React architecture document.
- `assumptions/current-assumptions.md` is the only assumptions file in scope.

The main same-level overlap is among root docs:

- `usage.md`, `development.md`, `software-modules.md`, and `building-plan.md` all contain some command/module/status content.
- The highest-value cleanup is to make each root doc narrower:
  - `usage.md`: user operation only.
  - `development.md`: developer setup, commands, tests.
  - `software-modules.md`: compact API/module contracts and cross-module constraints.
  - `building-plan.md`: roadmap and remaining work only.

## Suggested actions

1. Trim `building-plan.md` aggressively:
   - remove repeated current-state architecture lists,
   - remove detailed completed-phase `Done` lists,
   - replace verification command blocks with a link to `development.md`,
   - remove deferred non-goals already covered by `product.md`.
2. Trim `product.md` `Current readiness summary` to one short status paragraph. Keep non-goals and safety boundaries, but avoid a full limitation inventory.
3. Trim `usage.md`:
   - remove backend start/stop substep lists already covered by logical/component docs,
   - shorten default-mode explanation,
   - keep only user-facing setup and recovery steps.
4. Trim `local-desktop-runtime.md`:
   - remove duplicated development command blocks,
   - keep runtime resources, OS paths, networking, HTTPS, lifecycle, packaging, and scaling.
5. Consolidate app data/schema detail in `config-state-events.md`; replace repeated storage tables elsewhere with links.
6. Consolidate event schema and query filter detail in `config-state-events.md`; keep only emitter/UI/command perspectives in component docs.
7. Make `software-modules.md` a compact API/module index. Remove behavior explanations that duplicate component docs, but keep cross-module constraints.
8. Keep custom-node execution contract in `python-proxy-engine.md` and risk rationale in `assumptions/current-assumptions.md`; shorten repeated custom-node warnings elsewhere.
9. Keep test command reference in `development.md`; component docs can keep short coverage summaries, and roadmap/docs should link instead of repeating commands.
