# React Graph Editor

## Scope

This component note covers the policy graph editor in:

```text
src/frontend/react/src/components/GraphEditor.tsx
```

The editor is part of the React dashboard. It uses `@xyflow/react` for canvas rendering and keeps policy changes compatible with the app config schema.

## Component roles

- `GraphEditor.tsx` renders policy steps and edges, handles connect/delete/move actions, and persists discrete graph changes back to the parent policy.
- `NodeLibrary.tsx` lists addable flow nodes, operators, and registered custom nodes.
- `StepModal.tsx` edits step details: start trigger code, operator code, switch cases, and existing node params.
- `PythonCodeEditor.tsx` provides the syntax-highlighted code editor, autoindentation, full-screen expansion, and an in-editor API reference drawer, used by start triggers, operators, and custom-node editing.
- `ApiReferenceDrawer.tsx` is a slide-over that reads `services/apiReference/pythonApiReference.json` and fuzzy-searches it. The JSON defines the documented groups and order; the UI only renders and filters.
- `operatorShapes.ts` defines operator shape geometry and output port label positions.
- `Modal.tsx` and `ui.tsx` provide shared shell controls used by the editor and inspector.
- `services/nodes/defaultNodeSources.ts` bundles the real `src/proxy/defaults/nodes/*.py` files (via Vite glob) as read-only fallback source when Tauri source reads are unavailable, so previews never drift from the actual files.
- `styles.css` owns visual styling for nodes, operators, routes, library items, and inspector forms.

## Current graph behavior

- Library items for `start`, `end`, `if`, `switch`, and registered custom nodes open a preview modal first; the modal `+` action adds the step without opening another inspector.
- Operator previews allow editing the Python template before adding the operator to the canvas.
- A policy can have only one start node; the library disables adding another start when one exists.
- Node moves are persisted on drag stop.
- New edges are persisted on connect.
- Edges can be deleted from the graph UI.
- Node and operator details open in `StepModal`.
- Operator route ports come from built-in labels and switch cases.
- Edge output labels are shown, but current UI does not edit them directly.
- The canvas has its own full-screen mode; React Flow's fit-view control is hidden so it is not mistaken for full screen.

## Step editing behavior

- Start nodes edit inline Python `def triggered_by(context: RequestContext) -> bool` trigger code.
- End nodes have no configuration.
- Custom nodes show metadata, existing params, and read-only Python source.
- `if` operators edit inline `def if_condition(input) -> bool` code and route to `then` / `else`.
- `switch` operators edit inline `def switch_condition(input) -> str` code plus a bounded case list.
- Any Python editor exposes an **API** button opening the reference drawer (types and data available to node/operator code).
- Step changes flow to `App` and autosave through the normal config path.

## Performance rule

Do not write app-level config on every drag tick.

Node movement fires `onNodesChange` on every mouse move. If each change is pushed into heavy external state, the whole tree re-renders and node identities churn during the gesture.

Keep React Flow node/edge state local via `useNodesState` / `useEdgesState`. Persist to parent config only on discrete events:

- `onNodeDragStop` writes final positions.
- `onConnect` appends the new edge.
- explicit delete buttons remove nodes or edges.

## Memoization checklist

- Wrap custom node/edge components in `React.memo` or declare them outside the parent.
- Declare `nodeTypes` and `edgeTypes` as module constants.
- Wrap React Flow callbacks such as `onConnect` and `onNodeDragStop` in `useCallback`.
- Keep objects passed to `<ReactFlow>` as module constants or memoized values.
- Keep parent callback identities stable by stashing callbacks and the current policy in refs.

## React Flow settings to preserve

- Keep `deleteKeyCode={null}` because deletion is handled by custom UI and must persist through policy updates.
- Keep `connectionRadius` modest; `30` avoids grabbing the wrong handle while still making connection clicks usable.
- Keep `connectOnClick` enabled for click-port-then-target connection flow.
- Keep `panActivationKeyCode="Alt"` so normal drag moves nodes and Alt-drag pans.
- Keep `Controls showFitView={false}` while the app provides a real canvas full-screen button.

## Scaling notes

Not needed yet, but useful if graphs become large:

- enable `onlyRenderVisibleElements`,
- collapse deep node trees and render subtrees on demand,
- simplify node/edge CSS before adding heavier state management,
- move editor state into a store only if narrow subscriptions are needed.
