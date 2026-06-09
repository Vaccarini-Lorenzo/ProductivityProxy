# React Flow (@xyflow/react) — Performance & Usage Notes

Notes for the policy graph editor (`src/frontend/react/src/components/GraphEditor.tsx`).
Source: official docs — https://reactflow.dev/learn/advanced-use/performance and
https://reactflow.dev/learn/advanced-use/uncontrolled-flow (fetched 2026-06).

## The core rule: don't write global state on every drag tick

Node movement fires `onNodesChange` on **every mouse move**. If each change is pushed
into heavy external state (our app `config`), the whole tree re-renders and every node is
rebuilt with new object identities on every frame → janky drag + unreliable edge connect
(handles get re-measured mid-gesture).

**Fix:** keep React Flow's node/edge state local via `useNodesState` / `useEdgesState`.
Persist back to the parent only on discrete commit events:
- `onNodeDragStop` → write final positions.
- `onConnect` → append the new edge.
- explicit delete buttons → remove node/edge.

During a drag only local state updates (cheap). The expensive rebuild from props happens
once, at drag end.

## Memoization checklist (all required)

1. **Custom node/edge components**: wrap in `React.memo` or declare outside the parent.
   A new component reference each render remounts every node.
2. **`nodeTypes` / `edgeTypes`**: declare as module constants (never inline objects).
3. **Functions passed to `<ReactFlow>`** (`onConnect`, `onNodeDragStop`, …): `useCallback`.
4. **Objects/arrays passed to `<ReactFlow>`** (`fitViewOptions`, `connectionLineStyle`,
   `defaultEdgeOptions`, `proOptions`, `snapGrid`): module constants or `useMemo`.
5. **Keep `data` callback identities stable.** If the parent recreates `onSelect`/`onDelete`
   each render, the effect that rebuilds nodes re-runs constantly. Stash parent callbacks
   and current `policy` in refs inside the editor and expose stable `useCallback([])`
   wrappers; the rebuild effect then depends only on real data (`policy`, `selectedStepId`).

## Don't read the `nodes`/`edges` arrays inside child components

`useStore(s => s.nodes)` re-renders the child on every drag/pan/zoom. Subscribe to a
narrow derived slice instead (e.g. a `selectedNodeId` field), not the whole array.

## Other settings that bit us

- `nodeDragThreshold={0}` makes any 1px move start a drag — leave it at the default (`1`)
  so clicking a handle to start a connection isn't swallowed by a node drag.
- Oversized `connectionRadius` (we had `52`) grabs the wrong handle. Keep it modest (~30)
  and rely on `connectOnClick` for the easy click-port-then-target flow.
- `deleteKeyCode={null}` if deletion is handled by custom UI, so keyboard deletes don't
  mutate local state without persisting.
- `animated: true` on every edge is a CSS animation per edge; fine for small graphs, drop
  it first if a large graph stutters.

## Scaling further (not needed yet)

- `onlyRenderVisibleElements` for large graphs.
- Collapse deep node trees; render subtrees on demand.
- Simplify node/edge CSS (box-shadows, filters, gradients are repaint-heavy).
- For very large graphs move state into Zustand and select narrow slices.
