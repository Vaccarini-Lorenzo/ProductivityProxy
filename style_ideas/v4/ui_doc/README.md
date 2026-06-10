# UI Documentation Concepts — API Reference in Python Editor

10 mockup solutions for embedding Node/Operator API docs inside the Python code editor.

## API Surface to Document

```python
# Node function
def run(input, context, params) -> Any

# context object
context.flow          # mitmproxy flow (request/response)
context.config        # AppConfig
context.state         # StateStore — .usage_today(platform, now) -> float
context.event_log     # EventLog
context.data          # dict — shared request data
context.now()         # -> float (timestamp)
context.request_id    # str
context.log           # CustomNodeLogger
  .info(message, **data)
  .debug(message, **data)
  .warning(message, **data)
  .error(message, **data)

# Operator functions
def if_condition(input) -> bool
def switch_condition(input) -> str
```

---

## Concepts

| # | File | Pattern | Pros | Cons |
|---|------|---------|------|------|
| 01 | `01_split_panel_docs.png` | **Split pane** — editor left, docs panel right | Always visible, scannable, no context switch | Eats horizontal space; cramped on small screens |
| 02 | `02_bottom_panel_tabs.png` | **Bottom panel with tabs** — like IDE output pane | Familiar IDE pattern, preserves editor width | Reduces vertical code space; needs resize handle |
| 03 | `03_hover_intellisense.png` | **Hover tooltips** — IntelliSense-style popover | Zero UI footprint until needed; contextual | Requires autocomplete integration in CodeMirror; discoverability is low |
| 04 | `04_slide_drawer.png` | **Slide-out drawer** — overlays from right | Full-height docs, doesn't shrink editor permanently | Covers code; must dismiss to see full editor |
| 05 | `05_command_palette.png` | **Command palette** — Cmd+D search overlay | Fast fuzzy search; keyboard-driven; VS Code familiar | Invisible by default; new users won't discover it |
| 06 | `06_accordion_above.png` | **Accordion above editor** — collapsible summary | Compact when closed; all info in one glance when open | Pushes code down; not ideal for long references |
| 07 | `07_floating_popover.png` | **Floating popover card** — small button triggers popup | Minimal UI footprint; quick glance | Limited space; can't show full reference |
| 08 | `08_inline_ghost_hints.png` | **Inline ghost text** — dimmed hints in code | Zero extra UI; always contextual | Can clutter the code; must be toggle-able |
| 09 | `09_sticky_chips_bar.png` | **Sticky chips bar** — pill buttons with dropdown | Scannable at a glance; interactive; compact | Small dropdown area; limited depth |
| 10 | `10_dual_mode_toggle.png` | **Dual-mode toggle** — Code/Docs tab switch | Full-page docs with proper formatting | Can't see code and docs simultaneously |

---

## Recommendation

**Best fit for our use case (simple API, modal editor):**

- **Primary: #09 Sticky chips bar** — minimal footprint, scannable, fits within existing modal header
- **Secondary: #01 Split pane** (in fullscreen mode only) — when user expands editor, show docs panel

Both can coexist: chips bar in compact modal, split pane in fullscreen.
