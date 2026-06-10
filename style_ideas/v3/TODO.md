# v3 UI enhancement to-do

Derived from `style_ideas/v3/*_v3.png` vs current UI (`current_ui/` + live).
Mockups predate our recent changes (icon-only `+`, removed "New mode name" input) — keep ours where noted.

## Global / shared (do first — highest impact, touches every page)
- [ ] **Nav tabs get icons** before each label: Settings=gear, Modes=layers, Policy=shield, Nodes=nodes-graph, Observability=line-chart. Keep our UPPERCASE + equal-width tabs. (`TerminalNav.tsx`, new icons, `styles.css`)
- [ ] **Real toggle switches**: restyle `CheckRow` + `Toggle` from checkboxes to amber iOS-style switches (hidden input + styled track/thumb). (`ui.tsx`, `styles.css`)
- [ ] **`Card` optional `icon`**: small rounded amber-tinted box left of the title. (`ui.tsx Card`, `styles.css`)
- [ ] **Info (i) icon** on the "Browser preview — Tauri unavailable" banner. (`App.tsx`)
- [ ] **Shared `SearchInput`** (input + magnifying-glass) reused by Policy library + Nodes. (`ui.tsx`, replaces `.library-search` usages)
- [ ] **New inline SVG icons** (no deps): gear, layers, shield, nodes-graph, chart, info, terminal, link, lock, eye, search, inbox, hexagon, pyfile.

## Settings
- [ ] Section header icons: Proxy control=terminal `>_`, Connection=link, Authentication=lock. (via `Card icon`)
- [ ] LAN + auth rows → toggle switches (via `CheckRow` restyle).
- [ ] Password field → **show/hide eye** button inside the input.

## Modes
- [ ] Stronger **active-mode glow** (amber border + outer glow) to match v3.
- [ ] (Keep our icon-only `+`; mockup's "Add mode" label is superseded.)

## Policy (biggest delta)
- [ ] **Colored circular type icons** in library + canvas: Start=green play, End=red stop, If/Switch=amber branch, Custom=purple hexagon. Needs per-item icons in `FLOW_NODES` (start=play, end=stop) + hexagon for custom. (`NodeLibrary.tsx`, `GraphEditor.tsx`, `styles.css`)
- [ ] **Search box magnifying-glass icon** (shared `SearchInput`).
- [ ] **Canvas nodes**: colored left type icon + title/subtitle, subtle node glow border. (`GraphEditor.tsx`)
- [ ] **Edges**: solid amber bezier + arrowheads + green ports (currently dashed). (`GraphEditor.tsx`)

## Nodes
- [ ] **Search box magnifying-glass icon** (shared `SearchInput`).
- [ ] **`.py` file icon** per node row.

## Observability
- [ ] Auto-refresh → **toggle switch** (via `Toggle` restyle).
- [ ] **count-pill: amber dot** before the number.
- [ ] **Empty-state inbox icon** above "No events match…".
- [ ] **Events table column headers** (Timestamp · Event type · Source/Policy · Level).

## Decisions to confirm (I'll question these)
1. **"+ New node" / "Add mode" label vs icon-only `+`**: mockups show labels; you asked for icon-only earlier. → I lean **keep icon-only** for consistency. Confirm?
2. **Custom-node icon**: mockup = purple **hexagon**; we currently use `</>` code. → hexagon is more distinct as a "node". Confirm switch?
3. **Library drag handle (⠿)**: mockup implies drag-to-canvas, but our interaction is **click-to-add**. → **skip** (would be misleading). Agree?
4. **Number stepper on Limit**: native is fine. → **skip** custom styling.

## Skip / low value
- Drag handle (#3), custom number stepper (#4).
