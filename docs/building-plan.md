# ProductivityProxy Building Plan

## Goal

Build a cross-platform desktop app that controls a local `mitmproxy` proxy and lets users define traffic policies with modes and visual node graphs.

The app should work as a dockless tray/menu-bar app:

- macOS: menu bar app, no Dock icon, hidden dashboard by default.
- Linux: system tray/AppIndicator when available.

## Key product decisions

- Desktop stack: **Tauri v2 + React + TypeScript**.
- Proxy engine: keep using **mitmdump/mitmproxy**.
- Policy engine: Python code running inside the mitmproxy addon.
- Policy editor: visual node graph.
- Policies are stored in app config, not environment variables.
- The desktop app toggles macOS HTTP/HTTPS system proxy settings when the proxy starts/stops.
- Linux system proxy automation is postponed because desktop environments differ.
- Custom Python blocks are allowed to run directly with mitmproxy SDK access.
- No sandboxing or custom-code safeguards in the initial version.

## Important security model

Custom blocks run as local Python code with the same permissions as the proxy process.

This means custom blocks can:

- read/write local files,
- make network requests,
- inspect and modify proxied flows,
- block or redirect traffic,
- break the proxy if they contain errors or infinite loops.

This is intentional for now. The user is responsible for the code they run.

## Target repo structure

```text
ProductivityProxy/
  src/
    frontend/
      react/
        package.json
        index.html
        src/
          main.tsx
          App.tsx
          components/
          models/
          services/
      tauri/
        tauri.conf.json
        src/
          main.rs
          lib.rs
          controller/
          models/
          services/

    proxy/
    addons/
      graph_proxy.py
    engine/
      __init__.py
      blocks.py
      config.py
      context.py
      evaluator.py
      events.py
      state.py
      custom_blocks.py
    defaults/
      default_config.json
      blocks/

  docs/
    building-plan.md
    android.md
    proxy-setup.md

  scripts/
    run_mitm.sh

  README.md
  requirements.txt
```

The old legacy mitmproxy add-on was removed after the graph-based proxy engine replaced it.

## Runtime architecture

```text
Tauri tray app
  ├─ shows dashboard when requested
  ├─ stores config/state paths
  ├─ starts/stops mitmdump
  ├─ toggles macOS HTTP/HTTPS system proxy settings
  ├─ watches proxy event log
  └─ shows OS notifications

mitmdump subprocess
  └─ loads src/proxy/addons/graph_proxy.py
       └─ reads config.json
       └─ evaluates active mode graph
       └─ executes built-in and custom Python blocks
       └─ writes state/events
```

## App responsibilities

The Tauri app handles:

- tray/menu-bar icon,
- hidden dashboard window,
- proxy start/stop/restart,
- macOS system proxy enable/disable,
- LAN proxy toggle,
- auth toggle,
- mode selection,
- graph editing,
- custom block editing,
- config persistence,
- event/log display,
- OS notifications triggered by proxy events,
- copyable Android setup info.

The Tauri app does **not** implement request policy logic directly.

## Proxy responsibilities

The Python mitmproxy addon handles:

- reading current config,
- evaluating graph nodes for each request,
- executing custom Python blocks,
- tracking local usage state,
- blocking requests,
- redirecting requests,
- logging events,
- emitting notification events for the desktop app.

## Config files

Use app data directory instead of `.env`.

macOS example:

```text
~/Library/Application Support/ProductivityProxy/
  config.json
  state.json
  events.jsonl
  custom_blocks/
```

Linux example:

```text
~/.config/productivity-proxy/
  config.json
  state.json
  events.jsonl
  custom_blocks/
```

## Config shape

Initial shape:

```json
{
  "activeModeId": "productivity",
  "proxy": {
    "port": 8080,
    "allowLan": true,
    "authEnabled": false,
    "authUsername": "productive",
    "authPassword": "change-me"
  },
  "modes": [
    {
      "id": "productivity",
      "name": "Productivity",
      "graph": {
        "nodes": [],
        "edges": []
      }
    },
    {
      "id": "chilling",
      "name": "Chilling",
      "graph": {
        "nodes": [],
        "edges": []
      }
    }
  ],
  "customBlocks": []
}
```

## Node graph model

A mode owns one graph.

Each graph has:

- nodes,
- directed edges,
- one request start node,
- optional terminal nodes.

Each node receives a runtime context:

```python
context.flow      # mitmproxy HTTPFlow
context.state     # persistent state helper
context.config    # active app config
context.event_log # event writer
context.data      # mutable per-request data bag
```

Each node returns a result:

```json
{
  "output": "next",
  "data": {
    "someKey": "someValue"
  }
}
```

Edges connect node outputs to the next node:

```json
{
  "from": "node-a",
  "output": "blocked",
  "to": "node-b"
}
```

Loops are allowed. No loop guard is planned for the first version.

## Initial built-in nodes

Keep the initial built-in node set small.

### Core graph nodes

These are structural nodes, not policy-specific blocks:

- Start
- End
- If
- Switch

### Policy/action nodes

- Block
- Log
- Track time
- Show notification
- Redirect

### Custom Python node

A custom Python node can run arbitrary Python code using mitmproxy SDK objects.

Example block contract:

```python
def run(context, params):
    url = context.flow.request.pretty_url
    if "reddit.com" in url:
        return {"output": "match", "data": {"platform": "reddit"}}
    return {"output": "no_match"}
```

The graph can route based on the returned `output`.

## Default policies as graphs

The app should ship with prebuilt modes:

### Productivity

Approximate graph:

```text
Start
  -> Custom: Detect YouTube Shorts
      match -> Block
      no_match -> Custom: Detect Reddit
          match -> Track time
              -> Custom: Is Reddit daily limit reached
                  yes -> Block
                  no -> End
          no_match -> End
```

### Chilling

Approximate graph:

```text
Start -> Log optional event -> End
```

These are defaults only. The user can edit or replace them.

## Custom block storage

Custom blocks live as Python files in app data:

```text
custom_blocks/
  detect_youtube_shorts.py
  classify_url.py
  call_service_x.py
```

Config references them by ID/path:

```json
{
  "id": "detect_youtube_shorts",
  "name": "Detect YouTube Shorts",
  "type": "python",
  "path": "custom_blocks/detect_youtube_shorts.py",
  "entrypoint": "run"
}
```

The proxy engine imports and executes them dynamically.

## mitmdump launch command

The app starts mitmdump roughly like this:

```bash
mitmdump \
  --listen-host 0.0.0.0 \
  --listen-port 8080 \
  -s src/proxy/addons/graph_proxy.py \
  --set productive_config_path=/path/to/config.json \
  --set productive_state_path=/path/to/state.json \
  --set productive_event_log_path=/path/to/events.jsonl
```

If auth is enabled, add:

```bash
--proxyauth username:password
```

If LAN is disabled, use:

```bash
--listen-host 127.0.0.1
```

If LAN is enabled, use:

```bash
--listen-host 0.0.0.0
```

## Dashboard pages

Initial dashboard sections:

1. Status
   - proxy running/stopped,
   - local address,
   - LAN address,
   - current mode,
   - mitmdump availability.

2. Modes
   - select active mode,
   - create/rename/delete modes.

3. Graph editor
   - visual graph canvas,
   - add built-in node,
   - add custom Python node,
   - edit node params,
   - connect outputs to inputs.

4. Custom blocks
   - create/edit Python code blocks,
   - set entrypoint,
   - maybe run a basic syntax check.

5. Proxy settings
   - port,
   - LAN toggle,
   - auth toggle,
   - auth username/password.

6. Logs/events
   - recent events,
   - blocked requests,
   - notifications,
   - raw log tail.

## React graph library

Use `@xyflow/react` unless it creates problems.

Reason:

- mature React graph editor,
- supports custom nodes,
- supports edges/handles,
- good enough for node-based policy editing.

## Dockless/tray behavior

macOS requirements:

- no Dock icon,
- no normal window at startup,
- menu bar icon visible,
- dashboard opens only from tray/menu item,
- closing dashboard hides it instead of quitting app.

Implementation direction:

- Tauri tray icon,
- hidden main window on startup,
- `skipTaskbar` where supported,
- macOS accessory/LSUIElement configuration for packaged app.

Linux requirements:

- use tray/AppIndicator support where available,
- dashboard hidden by default,
- closing dashboard hides it.

## Notifications

The proxy should not directly show desktop notifications.

Instead:

1. proxy writes event:

```json
{"type": "notification", "title": "...", "body": "..."}
```

2. Tauri watches events,
3. Tauri shows native notification.

This keeps notification behavior in the app layer.

## Implementation phases

### Phase 1: Rework repo and scaffold app

- Create new folder structure.
- Scaffold Tauri + React app.
- Add tray/menu bar setup.
- Make dashboard hidden by default.
- Add no-Dock macOS behavior.
- Add basic dashboard shell.

### Phase 2: Proxy process manager

- Detect `mitmdump`.
- Start proxy.
- Stop proxy.
- Restart proxy.
- Capture logs.
- Show running/stopped state in dashboard and tray.

### Phase 3: Config/state migration

- Replace policy env vars with config file.
- Add default config generator.
- Store config/state/events in app data.
- Pass config/state/event paths into mitmdump.

### Phase 4: Python graph engine

- Create `src/proxy/addons/graph_proxy.py`.
- Create graph evaluator.
- Implement context object.
- Implement built-in nodes:
  - Block,
  - Log,
  - Track time,
  - Show notification event,
  - Redirect.
- Implement core routing nodes:
  - Start,
  - End,
  - If,
  - Switch.
- Implement custom Python node loader.

### Phase 5: Default modes

- Recreate current behavior as editable default graphs:
  - block YouTube Shorts,
  - track Reddit,
  - block Reddit after 30 minutes.
- Add Chilling mode with permissive defaults.

### Phase 6: React dashboard

- Add status page.
- Add proxy settings page.
- Add mode selector.
- Add graph editor with `@xyflow/react`.
- Add node parameter editor.
- Add custom block editor.
- Add event/log viewer.

### Phase 7: LAN/Android support

- Show LAN IP.
- Copy Android setup instructions.
- Keep auth toggle.
- Keep CA install instructions.

### Phase 8: Cleanup and docs

- Update README.
- Add Android setup docs.
- Add proxy setup docs.
- Add development docs.

## Non-goals for first version

- Linux system proxy automation.
- Bundling mitmproxy inside the app.
- Sandboxing custom Python blocks.
- Plugin marketplace.
- Cloud sync.
- User authentication/accounts.
- Polished installer/signing/notarization.

## Open implementation risks

- Tauri dockless behavior may differ between dev and packaged macOS app.
- Linux tray support depends on desktop environment.
- Arbitrary Python custom blocks can hang or crash the proxy.
- Infinite graph loops can hang request processing.
- Custom code with mitmproxy SDK access can alter traffic in unexpected ways.
- Bundling mitmproxy later will require separate packaging work.

## Immediate next step

Install Rust/Cargo, then scaffold the Tauri + React app and migrate the repo structure.

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustc --version
cargo --version
```
