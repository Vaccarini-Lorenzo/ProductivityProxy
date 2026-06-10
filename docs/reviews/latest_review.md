# Documentation Structure & Depth Review

Scope: markdown files returned by the requested `find` command. `docs/unofficial/`, `docs/decisions/`, `docs/reviews/`, and `README.md` were not reviewed.

Review focus only: folder placement and abstraction depth. This review does not validate facts against code behavior and does not assess duplication.

Note on root-level docs: the supplied folder purposes define architecture and assumptions folders, but not the `docs/` root. I treated `usage.md` and `development.md` as acceptable root-level procedural guides. Root files that contain architecture, API contracts, roadmap/status, or tooling metadata are flagged.

## Summary table

| File | Folder | Verdict |
| --- | --- | --- |
| `architecture/0_conceptual/product.md` | `0_conceptual` | ✂ needs split |
| `architecture/1_logical/system-overview.md` | `1_logical` | ✂ needs split |
| `architecture/2_component/python-proxy-engine.md` | `2_component` | ✓ correct |
| `architecture/2_component/react-dashboard.md` | `2_component` | ✓ correct |
| `architecture/2_component/tauri-desktop-backend.md` | `2_component` | ✓ correct |
| `architecture/3_deployment/local-desktop-runtime.md` | `3_deployment` | ✓ correct |
| `architecture/4_data_layer/config-state-events.md` | `4_data_layer` | ✓ correct |
| `assumptions/current-assumptions.md` | `assumptions` | ✓ correct |
| `building-plan.md` | `docs/` root | ✂ needs split |
| `development.md` | `docs/` root | ✓ correct |
| `react-flow-best-practices.md` | `docs/` root | ✗ wrong folder |
| `SKILL.md` | `docs/` root | ✗ wrong folder |
| `software-modules.md` | `docs/` root | ✂ needs split |
| `usage.md` | `docs/` root | ✓ correct |

## Detailed findings

### `architecture/0_conceptual/product.md`

- **Depth match:** Mostly conceptual: purpose, actors, capabilities, non-goals, and safety boundaries are appropriate.
- **Mixed content:** The **Current readiness summary** section contains technical/deployment-level details: separate `mitmproxy` install, HTTPS interception, `POLICY_MAX_STEPS`, system proxy crash behavior, and Linux failure mode.
- **Placement:** Correct folder after trimming or moving the technical readiness details.
- **Suggested action:** Keep the product purpose, actors, capabilities, default behavior, non-goals, and a short safety warning here. Extract detailed readiness/technical limitation bullets into deployment, assumptions, or component docs.

### `architecture/1_logical/system-overview.md`

- **Depth match:** Partly correct. The black-box component descriptions and relationships fit the logical layer.
- **Mixed content:** Several sections go below logical depth:
  - `mitmdump` and addon naming belongs in `2_component` or `3_deployment`.
  - local config/state/event/custom-node files belong in `4_data_layer`.
  - macOS system proxy snapshot/restore and exact start/stop steps belong in `3_deployment` or the Tauri component doc.
- **Placement:** Correct folder for the logical skeleton, but the implementation-specific details should be extracted.
- **Suggested action:** Rewrite this file around generic black boxes: dashboard, desktop backend, local proxy process, policy engine, persistence, and system proxy integration. Link to deeper docs for technologies and exact runtime steps.

### `architecture/2_component/python-proxy-engine.md`

- **Depth match:** Correct. It has concrete internals: package location, addon entrypoint, controller responsibilities, model validation, semantic model, request context, evaluation loop, default nodes, state, events, and tests.
- **Mixed content:** No major split needed. State and event details are acceptable here as component internals; the deeper schema examples already belong in the data-layer document.
- **Placement:** Correct.
- **Suggested action:** No structural action required.

### `architecture/2_component/react-dashboard.md`

- **Depth match:** Correct. It documents the React/Vite/Tauri frontend internals, top-level state, views, graph editor, frontend services, notifications, browser preview behavior, and tests.
- **Mixed content:** No major split needed.
- **Placement:** Correct.
- **Suggested action:** Expand this or add a sibling component doc for currently undocumented React subcomponents if they are architecturally significant: `NodeLibrary`, `StepModal`, `PythonCodeEditor`, `Modal`, shared `ui`, `operatorShapes`, `defaultNodeSources`, and styling/design-system rules.

### `architecture/2_component/tauri-desktop-backend.md`

- **Depth match:** Correct. It describes Rust/Tauri internals, state, commands, app paths, process launch, macOS proxy handling, tray/window behavior, error handling, and tests.
- **Mixed content:** No major split needed. Runtime details are acceptable because they describe this component's internals.
- **Placement:** Correct.
- **Suggested action:** No structural action required.

### `architecture/3_deployment/local-desktop-runtime.md`

- **Depth match:** Correct. It describes runtime resources, prerequisites, app data paths, local networking, HTTPS interception, macOS system proxy lifecycle, development runtime commands, packaging status, and scaling limits.
- **Mixed content:** No major split needed. Development commands are operational/runtime details, so they are acceptable here.
- **Placement:** Correct.
- **Suggested action:** If packaging becomes more substantial, create a dedicated deployment doc such as `architecture/3_deployment/packaging-runtime.md`.

### `architecture/4_data_layer/config-state-events.md`

- **Depth match:** Correct. It documents storage choices, JSON/JSONL shapes, config/state/event schemas, custom-node path contracts, event query contract, lifecycle, and validation boundaries.
- **Mixed content:** No major split needed.
- **Placement:** Correct.
- **Suggested action:** Consider adding default-node parameter contracts here if they are treated as data/API contracts rather than component implementation details.

### `assumptions/current-assumptions.md`

- **Depth match:** Correct. Each entry is framed as an assumption with why it is assumed and impact if wrong.
- **Mixed content:** No major split needed.
- **Placement:** Correct.
- **Suggested action:** No structural action required.

### `building-plan.md`

- **Depth match:** Wrong for a single formal doc. It mixes roadmap, readiness, current architecture state, implementation phase status, remaining work, verification commands, manual checks, and non-goals.
- **Mixed content to extract:**
  - **Current state / readiness / non-goals:** conceptual or deployment docs, depending on level of detail.
  - **Completed implementation phases:** component docs or an engineering status document outside the architecture layers.
  - **System proxy, packaging, runtime gaps:** `architecture/3_deployment/`.
  - **Verification checklist:** `development.md`.
  - **Recommended next work:** planning/issue-tracking material, not a formal architecture-depth document.
- **Placement:** Root placement is weak because the content is not a stable user/developer guide and not at one abstraction level.
- **Suggested action:** Split stable facts into existing architecture/development docs. Keep live planning material out of the formal architecture source-of-truth set unless a dedicated reviewed `roadmap/` purpose is defined.

### `development.md`

- **Depth match:** Correct as a root-level procedural developer guide. It contains prerequisites, test commands, run commands, source map, conventions, and development notes.
- **Mixed content:** No split required. The backend/Python/React notes are practical development pointers, not architecture-depth explanations.
- **Placement:** Acceptable as a root guide, assuming root docs are allowed for procedural guides.
- **Suggested action:** Move the verification checklist from `building-plan.md` here if that checklist is still needed.

### `react-flow-best-practices.md`

- **Depth match:** Correct technical depth, but for the wrong place. It is specifically about the React graph editor implementation and `@xyflow/react` performance.
- **Mixed content:** No major split needed; it is consistently component-level guidance.
- **Placement:** Wrong folder. It belongs with React dashboard internals, not at docs root.
- **Suggested action:** Move or merge it into `architecture/2_component/react-dashboard.md`, or create `architecture/2_component/react-graph-editor.md` if the graph editor deserves its own component doc.

### `SKILL.md`

- **Depth match:** Not applicable to product documentation. It is tooling/agent metadata and documentation rules.
- **Mixed content:** No product architecture content to split.
- **Placement:** Wrong folder for the reviewed docs tree because it is not a user, developer, architecture, data, or assumptions document.
- **Suggested action:** Move it out of the reviewed docs tree if tooling allows, or explicitly exclude `docs/SKILL.md` from future documentation-quality review commands.

### `software-modules.md`

- **Depth match:** Mixed. It contains component-level module maps, cross-layer command/API contracts, data/event constraints, and test layout.
- **Mixed content to extract:**
  - **Python/Tauri/React module maps:** `architecture/2_component/` or merge into the existing component docs.
  - **Tauri commands, event query shape, config/event compatibility constraints:** `architecture/4_data_layer/` as API/data contracts.
  - **Test layout:** `development.md`.
- **Placement:** Root placement is not ideal because the document is architecture/reference material and crosses multiple depths.
- **Suggested action:** Split by abstraction level. If a single module map is kept, place it under `architecture/2_component/` and move API/data-contract sections into `architecture/4_data_layer/`.

### `usage.md`

- **Depth match:** Correct as a root-level user guide. It explains how to install prerequisites, start/stop the app, use manual proxy mode, configure LAN devices, understand modes/policies/custom nodes, recover macOS proxy settings, and note limitations.
- **Mixed content:** No split required. Deployment details are presented as user operations rather than architecture internals.
- **Placement:** Acceptable as a root guide, assuming root docs are allowed for user-facing instructions.
- **Suggested action:** No structural action required.

## Suggested actions

1. Split `architecture/0_conceptual/product.md`: move detailed readiness/runtime bullets out of the conceptual doc.
2. Split `architecture/1_logical/system-overview.md`: remove implementation names, file-level details, and macOS runtime mechanics from the logical layer.
3. Move or merge `react-flow-best-practices.md` into `architecture/2_component/react-dashboard.md` or a new `architecture/2_component/react-graph-editor.md`.
4. Split `software-modules.md`:
   - component module maps -> `architecture/2_component/`,
   - command/event/data contracts -> `architecture/4_data_layer/`,
   - test layout -> `development.md`.
5. Split `building-plan.md`: stable architecture/runtime facts should move into the relevant architecture docs; verification commands should move to `development.md`; live planning should not remain mixed with formal architecture docs.
6. Move or exclude `SKILL.md` from the reviewed documentation set because it is tooling metadata, not product documentation.
7. Create or expand React component documentation for the graph-editor support pieces if they are meant to be maintained as architectural components.
8. Consider a dedicated data-layer/API contract doc for default node parameter contracts and Tauri command contracts if those contracts are expected to be stable.

## Gap analysis: documented vs codebase

| Codebase area | Exists in codebase | Documentation status |
| --- | --- | --- |
| Python proxy addon/controller | `src/proxy/addons/`, `src/proxy/controller/mitmproxy/` | Documented in `python-proxy-engine.md` and `software-modules.md` |
| Python policy models/runtime context | `src/proxy/models/policy/`, `src/proxy/models/runtime/` | Documented in `python-proxy-engine.md`, `config-state-events.md`, and `software-modules.md` |
| Python services | config, events, observability, policy evaluator/operators/custom nodes, state store | Documented at component level; no major structural gap |
| Default config and default Python nodes | `src/proxy/defaults/default_config.json`, `src/proxy/defaults/nodes/` | Listed, but default-node parameter contracts are not deeply documented |
| Tauri desktop backend | commands, tray, config paths, event reads, network info, mitmdump process, system proxy | Well covered in `tauri-desktop-backend.md`, deployment doc, and `software-modules.md` |
| Tauri app/bundle configuration | `tauri.conf.json`, `build.rs`, icons, generated schemas | Only lightly covered through packaging/runtime notes; create deployment/component coverage if packaging becomes important |
| React app shell and views | `App.tsx`, Settings, Modes, Nodes, Policy, Observability views | Covered in `react-dashboard.md` |
| React graph editor core | `GraphEditor.tsx`, `@xyflow/react` | Covered in `react-dashboard.md`; performance notes exist but are misplaced at docs root |
| React graph-editor support components | `NodeLibrary.tsx`, `StepModal.tsx`, `operatorShapes.ts` | Gap: not documented by name at any proper layer |
| React shared UI/code components | `Modal.tsx`, `ui.tsx`, `PythonCodeEditor.tsx`, `styles.css` | Gap: not documented except indirectly as UI implementation |
| React services | config, proxy, notifications, policy operations, Tauri client | Mostly documented; `services/nodes/defaultNodeSources.ts` is not documented |
| Scripts/manual proxy runtime | `scripts/run_mitm.sh` | Documented in usage, development, and deployment docs |
| Tests | `test/unit/`, `test/integration/` | Documented in component docs, `development.md`, and `software-modules.md` |

### Missing or thin docs to create

- `architecture/2_component/react-graph-editor.md` or expanded React dashboard sections for `NodeLibrary`, `StepModal`, `operatorShapes`, `PythonCodeEditor`, and graph-editor state/shape handling.
- `architecture/4_data_layer/command-contracts.md` if Tauri command request/response shapes are considered stable contracts.
- Default-node parameter contract documentation, either under `4_data_layer` if treated as schema/contracts or under the Python component doc if treated as implementation.
- Deployment/component notes for Tauri packaging configuration if packaging is part of near-term work.
