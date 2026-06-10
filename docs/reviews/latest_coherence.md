# Documentation Truth & Consistency Review

Scope: all Markdown docs under `docs/` except `README.md`, `docs/reviews/`, `docs/unofficial/`, and `docs/decisions/`.

Code/config inspected: Python proxy source, React/Tauri source, default config, `.env.example`, `scripts/run_mitm.sh`, Tauri/React package configs, and deployment/config files. No Dockerfiles, compose files, CI config, or infra-as-code files were found.

Verification commands run:

- `PYTHONPATH=src POLICY_MAX_STEPS=1000 python3 -m unittest discover -s test -t . -p 'test_*.py'` — pass.
- `cd src/frontend/tauri && cargo test` — pass.
- `cd src/frontend/react && npm test` — fails because `test/unit/frontend/react/app/App.test.tsx` still expects `"Save config"`, while the UI now shows auto-save.

## Summary table

| Document | Issue type | Description |
| --- | --- | --- |
| `architecture/0_conceptual/product.md` | Stale default behavior detail | Says Chilling passes from start to end. Current default configs use `chilling.policyIds: []`, so it allows by running no policies. |
| `architecture/1_logical/system-overview.md` | Missing precondition / minor simplification | Start flow omits the required `POLICY_MAX_STEPS` env var checked by Tauri before starting. Request flow also implies every node returns route output; in code custom nodes always route through `next`. |
| `architecture/2_component/python-proxy-engine.md` | Wrong/stale technical details | Operator semantics and config reload behavior do not match code. `if`/`switch` execute inline Python `code`; config is hot-reloaded on request when the file mtime changes. |
| `architecture/2_component/react-dashboard.md` | Stale UI capabilities | Policy view docs claim active-mode ordered policy listing, policy rename/reorder, route-output editing, and JSON param editing. Current code has global policy selection, mode ordering in Modes view, no policy rename UI, no edge-output edit UI, and field/code-editor based param editing. |
| `architecture/2_component/tauri-desktop-backend.md` | Missing precondition / overstatement | `start_proxy` docs omit required `POLICY_MAX_STEPS`. Restore docs overstate endpoint restore: for previously disabled proxies or missing endpoints, code only turns proxy state off. |
| `architecture/3_deployment/local-desktop-runtime.md` | Missing precondition | Desktop dev command does not mention `POLICY_MAX_STEPS`, but `start_proxy` rejects startup without it. Deployment statements otherwise match the lack of Docker/remote infra. |
| `architecture/4_data_layer/config-state-events.md` | Wrong config schema examples | Top-level config example omits `policies`; mode example uses `policies` instead of current `policyIds`. Code and current defaults use top-level `policies` plus `modes[].policyIds`. |
| `assumptions/current-assumptions.md` | No material issue | Assumptions still match code: macOS-first system proxy, external `mitmdump`, manual CA, trusted nodes, env loop guard, in-memory system-proxy snapshot, source-tree runtime, minimal validation. |
| `building-plan.md` | Stale roadmap/readiness | Marks implemented items as remaining: loop guard, hot reload/restart prompt, policy step parameter editing, event/log viewer, and custom node source loading while editing. |
| `development.md` | Inconsistent with code | Says env vars are for helper scripts and the desktop app uses config files. In code, desktop `start_proxy` also requires `POLICY_MAX_STEPS`. React test command currently fails due stale test expectation. |
| `react-flow-best-practices.md` | No material issue | Current `GraphEditor.tsx` follows the documented React Flow performance guidance: local node/edge state, drag-stop persistence, stable callbacks/constants, `deleteKeyCode={null}`, and `connectionRadius={30}`. |
| `SKILL.md` | No material code issue | Rules are consistent with the intended docs model. `decisions/` and `unofficial/` are listed as expected folders, though they are not present in the current tree. |
| `software-modules.md` | Mostly accurate; missing precondition | Module map and command names match code. `start_proxy` contract should include the required `POLICY_MAX_STEPS` env var. |
| `usage.md` | Missing precondition / helper-config risk | Desktop start instructions omit `POLICY_MAX_STEPS`. Manual proxy docs point to `.env.example`, whose config path currently resolves to a stale checked-in `data/productive_proxy_config.json`. |

## Cross-document contradictions and misalignments

### 1. Operator contract is inconsistent

- `python-proxy-engine.md` says:
  - `if` reads `params["path"]` and routes to `true` / `false`.
  - `switch` reads `params["path"]`.
  - `else` is the `false` branch.
- Current code says otherwise:
  - `OperatorRunner` executes `params["code"]`.
  - `if` requires `def if_condition(input)` and routes to `then` / `else`.
  - `switch` requires `def switch_condition(input)` and routes to the returned string.
- Current source defaults and React defaults use the code-based `then` / `else` model.
- The checked-in `data/productive_proxy_config.json` still uses the old `path` + `true` / `false` model.

### 2. Config schema is inconsistent across docs and checked-in config

Current code model:

```json
{
  "activeModeId": "productivity",
  "proxy": {},
  "customNodes": [],
  "policies": [],
  "modes": [
    { "id": "productivity", "name": "Productivity", "policyIds": [] }
  ]
}
```

Misalignments:

- `config-state-events.md` omits top-level `policies` in the top-level example.
- `config-state-events.md` shows a mode with `"policies": []` instead of `"policyIds": []`.
- `data/productive_proxy_config.json` uses the old embedded `modes[].policies` shape. The Python model ignores that field, so loading this file results in zero top-level policies and an active mode with no policy IDs.
- `usage.md` and `development.md` direct users to `scripts/run_mitm.sh`; `.env.example` points that script at the stale `data/productive_proxy_config.json`, and the script does not overwrite it if it already exists.

### 3. Chilling mode is described two different ways

- `product.md` says Chilling allows requests by passing from start to end.
- `usage.md` says Chilling allows traffic.
- Actual `src/proxy/defaults/default_config.json` and `src/frontend/react/src/models/config/defaultConfig.ts` use `policyIds: []` for Chilling. That allows traffic, but not by traversing a start/end policy.

### 4. Config reload status is stale

- `python-proxy-engine.md` says config is loaded during `configure`, not for every request, and disk changes are picked up after restart/reconfigure.
- `building-plan.md` lists hot reload or restart prompt as remaining work.
- Actual `PolicyProxyController.request()` calls `_reload_if_changed()`, which reloads config when the config file mtime changes. This is covered by `test_reloads_config_when_file_changes`.

### 5. React UI status is inconsistent with planning docs

- `building-plan.md` says these remain:
  - policy step parameter editing,
  - event/log viewer,
  - custom node file-content loading while editing.
- Current React code has:
  - `StepModal` with trigger/params/operator editors,
  - `ObservabilityView` for filterable event logs and request timeline,
  - `NodesView.editNode()` loading source through `read_custom_node` with bundled fallback.

### 6. Environment-variable story is inconsistent

- `assumptions/current-assumptions.md`, `product.md`, and `usage.md` correctly mention required `POLICY_MAX_STEPS` as a loop guard.
- `development.md` says env vars are used by helper scripts and the desktop app uses config files.
- Actual Tauri `start_proxy` calls `require_env("POLICY_MAX_STEPS")`, so the desktop app also requires this env var before proxy startup.

## Docs-vs-code inaccuracies

### Python proxy engine

- `PolicyProxyController` reloads config on request if the config file changes. Docs saying restart/reconfigure is required are stale.
- `OperatorRunner` uses inline Python condition functions, not `params["path"]` lookup.
- `if` edge labels are `then` and `else`, not `true` and `false`.
- Custom nodes cannot choose arbitrary route outputs; the evaluator routes custom node steps through `next` and passes the node return value as the next input.

### Data layer

- `AppConfig.from_dict()` reads top-level `policies` and `modes[].policyIds`.
- `Mode.from_dict()` ignores `modes[].policies`.
- The current checked-in helper config at `data/productive_proxy_config.json` is stale and loads as an active mode with no active policies under current Python code.

### React dashboard

- `PolicyView.tsx` shows a selector over all `config.policies`, not an ordered active-mode policy list.
- Policy ordering is edited in `ModesView.tsx` through `mode.policyIds`, not in Policy view.
- There is no policy rename UI in `PolicyView.tsx`.
- There is no route-output editing UI. `updateEdgeOutput()` exists in `policyOperations.ts`, but current views do not call it.
- Frontend validation also checks that each `mode.policyIds[]` entry references an existing policy; `react-dashboard.md` omits this check.
- React tests currently fail because `App.test.tsx` expects a removed `Save config` label.

### Tauri backend / deployment

- `start_proxy` requires `POLICY_MAX_STEPS` before path discovery, config write, process start, or system-proxy enable.
- The documented start commands should include that env var or explain that the shell must already provide it.
- `macos.rs` does not always restore prior proxy server/port values. If the previous proxy was disabled or missing endpoint data, restore commands only turn the proxy state off.

### Manual proxy helper

- `scripts/run_mitm.sh` creates a materialized config only if `PRODUCTIVE_PROXY_CONFIG_PATH` does not exist.
- Because `.env.example` points to `./data/productive_proxy_config.json` and that file already exists with an old schema, manual proxy mode does not currently start from the documented current default config unless the stale file is deleted/regenerated.

## Suggested actions

1. Update `architecture/2_component/python-proxy-engine.md`:
   - document inline Python operator code,
   - use `then` / `else` for `if`,
   - remove `params["path"]` semantics,
   - document mtime-based config reload.
2. Update `architecture/4_data_layer/config-state-events.md`:
   - add top-level `policies`,
   - change mode examples from `policies` to `policyIds`,
   - mention that Chilling allows traffic by having no policies.
3. Fix or remove stale `data/productive_proxy_config.json`, or update `usage.md` / `development.md` to tell users to delete/regenerate it before manual proxy runs.
4. Update `architecture/0_conceptual/product.md` Chilling wording to match current defaults: no active policies, therefore all traffic is allowed.
5. Update `usage.md`, `development.md`, `local-desktop-runtime.md`, `system-overview.md`, `tauri-desktop-backend.md`, and `software-modules.md` to state that desktop proxy startup currently requires `POLICY_MAX_STEPS` in the environment.
6. Update `architecture/2_component/react-dashboard.md` to match current UI:
   - global policy selector in Policy view,
   - mode policy ordering in Modes view,
   - no current policy rename UI,
   - no current edge-output edit UI,
   - param editing through `StepModal`, not raw JSON.
7. Update `building-plan.md` to move implemented items out of Remaining: loop guard, config reload, step parameter editing, event viewer, and custom node source loading.
8. Update Tauri restore wording to say prior enabled state is restored, but previously disabled proxy endpoints may not have their old server/port values restored.
9. Fix `test/unit/frontend/react/app/App.test.tsx` or document that React tests are currently red until the UI smoke test is updated.
