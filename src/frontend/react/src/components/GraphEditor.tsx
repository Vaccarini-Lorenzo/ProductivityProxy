import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  ConnectionMode,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type NodeProps,
  type NodeHandle,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { ModeConfig, PolicyGraph } from "../models/config/types";

const BUILT_INS = ["block", "log", "track_time", "notify", "redirect", "if", "switch", "python", "end"];
const NODE_WIDTH = 220;
const NODE_HEIGHT = 88;

interface Props {
  mode: ModeConfig;
  onGraphChange: (graph: PolicyGraph) => void;
  onAddNode: (type: string) => void;
}

export function GraphEditor({ mode, onGraphChange, onAddNode }: Props) {
  const [panMode, setPanMode] = useState(false);

  useEffect(() => {
    const updatePanMode = (event: KeyboardEvent) => setPanMode(event.altKey);
    const stopPanMode = () => setPanMode(false);
    window.addEventListener("keydown", updatePanMode);
    window.addEventListener("keyup", updatePanMode);
    window.addEventListener("blur", stopPanMode);
    return () => {
      window.removeEventListener("keydown", updatePanMode);
      window.removeEventListener("keyup", updatePanMode);
      window.removeEventListener("blur", stopPanMode);
    };
  }, []);

  const nodes: Node[] = useMemo(() =>
    mode.graph.nodes.map((n, i) => ({
      id: n.id,
      type: "policyNode",
      position: n.position ?? { x: 80 + i * 180, y: 120 },
      data: { label: n.type, subLabel: n.id },
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      handles: policyHandles(n.type),
    })),
    [mode.graph.nodes],
  );

  const edges: Edge[] = useMemo(() =>
    mode.graph.edges.map((e, i) => ({
      id: `${e.from}-${e.output}-${e.to}-${i}`,
      source: e.from,
      sourceHandle: "out",
      target: e.to,
      targetHandle: "in",
      label: e.output !== "next" ? e.output : undefined,
      markerEnd: { type: MarkerType.ArrowClosed },
      animated: e.output === "next",
    })),
    [mode.graph.edges],
  );

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    const updated = applyNodeChanges(changes, nodes);
    const graphNodes = mode.graph.nodes.map((n) => {
      const found = updated.find((u) => u.id === n.id);
      return found ? { ...n, position: found.position } : n;
    });
    onGraphChange({ ...mode.graph, nodes: graphNodes });
  }, [nodes, mode.graph, onGraphChange]);

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    const updated = applyEdgeChanges(changes, edges);
    const graphEdges = updated.map((e) => ({
      from: e.source,
      output: (e.label as string) || "next",
      to: e.target,
    }));
    onGraphChange({ ...mode.graph, edges: graphEdges });
  }, [edges, mode.graph, onGraphChange]);

  const onConnect: OnConnect = useCallback((params) => {
    const updated = addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed }, animated: true }, edges);
    const graphEdges = updated.map((e) => ({
      from: e.source,
      output: (e.label as string) || "next",
      to: e.target,
    }));
    onGraphChange({ ...mode.graph, edges: graphEdges });
  }, [edges, mode.graph, onGraphChange]);

  return (
    <section className="panel graph-panel" aria-labelledby="graph-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Policy graph</p>
          <h2 id="graph-heading">{mode.name} graph</h2>
        </div>
        <div className="button-row">
          {BUILT_INS.map((type) => (
            <button key={type} type="button" onClick={() => onAddNode(type)}>[+] {type}</button>
          ))}
        </div>
      </div>
      <div className={panMode ? "flow-canvas pan-mode" : "flow-canvas"}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ maxZoom: 1.2, padding: 0.3 }}
          defaultEdgeOptions={{ type: "smoothstep", animated: true, markerEnd: { type: MarkerType.ArrowClosed } }}
          connectionMode={ConnectionMode.Strict}
          nodesDraggable={!panMode}
          nodesConnectable={!panMode}
          autoPanOnNodeDrag={false}
          autoPanOnConnect={false}
          selectNodesOnDrag={false}
          elementsSelectable={false}
          panOnDrag={false}
          panActivationKeyCode="Alt"
          selectionOnDrag={false}
          selectionKeyCode={null}
          nodeDragThreshold={0}
          connectionDragThreshold={0}
          connectOnClick={false}
          connectionRadius={48}
          colorMode="dark"
          proOptions={{ hideAttribution: true }}
          connectionLineStyle={{ stroke: "#5cff57", strokeWidth: 3 }}
        >
          <Background gap={20} size={1} />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>
      <p className="muted graph-hint">Drag blocks to move • Drag from green dots to connect • Option/Alt + drag to pan • Scroll to zoom</p>
    </section>
  );
}

function PolicyNode({ data }: NodeProps) {
  const nodeData = data as { label: string; subLabel: string };
  const receivesInput = nodeData.label !== "start";
  const sendsOutput = nodeData.label !== "end";
  return (
    <div className="policy-node">
      {receivesInput && <Handle id="in" type="target" position={Position.Left} isConnectableStart={false} title="Input port" />}
      <strong>{nodeData.label}</strong>
      <span>{nodeData.subLabel}</span>
      {sendsOutput && <Handle id="out" type="source" position={Position.Right} isConnectableEnd={false} title="Output port" />}
    </div>
  );
}

const nodeTypes = { policyNode: PolicyNode };

function policyHandles(type: string): NodeHandle[] {
  const handles: NodeHandle[] = [];
  if (type !== "end") {
    handles.push({ id: "out", type: "source", position: Position.Right, x: NODE_WIDTH - 11, y: NODE_HEIGHT / 2 - 11, width: 22, height: 22 });
  }
  if (type !== "start") {
    handles.push({ id: "in", type: "target", position: Position.Left, x: -11, y: NODE_HEIGHT / 2 - 11, width: 22, height: 22 });
  }
  return handles;
}

export function paramsToText(params: Record<string, unknown> | undefined): string {
  return JSON.stringify(params ?? {}, null, 2);
}
