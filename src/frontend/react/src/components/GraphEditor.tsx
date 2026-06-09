import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  MarkerType,
  ConnectionMode,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  getSmoothStepPath,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type NodeProps,
  type NodeHandle,
  type EdgeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { CustomNodeConfig, PolicyConfig } from "../models/config/types";

const BUILT_IN_NODES = ["start", "end"];
const OPERATORS = ["if", "switch"];
const NODE_WIDTH = 200;
const NODE_HEIGHT = 72;

interface Props {
  policy: PolicyConfig;
  customNodes: CustomNodeConfig[];
  selectedStepId: string | null;
  onPolicyChange: (policy: PolicyConfig) => void;
  onAddStep: (kind: "node" | "operator", type: string) => void;
  onSelectStep: (stepId: string | null) => void;
  onDeleteStep: (stepId: string) => void;
}

export function GraphEditor({ policy, customNodes, selectedStepId, onPolicyChange, onAddStep, onSelectStep, onDeleteStep }: Props) {
  const [panMode, setPanMode] = useState(false);
  const hasStart = policy.steps.some((s) => s.kind === "node" && s.type === "start");

  useEffect(() => {
    const update = (e: KeyboardEvent) => setPanMode(e.altKey);
    const stop = () => setPanMode(false);
    window.addEventListener("keydown", update);
    window.addEventListener("keyup", update);
    window.addEventListener("blur", stop);
    return () => { window.removeEventListener("keydown", update); window.removeEventListener("keyup", update); window.removeEventListener("blur", stop); };
  }, []);

  const deleteEdge = useCallback((id: string) => {
    onPolicyChange({ ...policy, edges: policy.edges.filter((_, i) => edgeId(policy.edges[i], i) !== id) });
  }, [policy, onPolicyChange]);

  const nodes: Node[] = useMemo(() =>
    policy.steps.map((step, index) => ({
      id: step.id,
      type: step.kind === "operator" ? "operatorNode" : "policyNode",
      position: step.position ?? { x: 80 + index * 240, y: 120 },
      data: { label: step.type, stepId: step.id, kind: step.kind, isSelected: step.id === selectedStepId, onSelect: onSelectStep, onDelete: onDeleteStep },
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      handles: policyHandles(step.kind, step.type),
    })),
    [policy.steps, selectedStepId, onSelectStep, onDeleteStep],
  );

  const edges: Edge[] = useMemo(() =>
    policy.edges.map((edge, index) => ({
      id: edgeId(edge, index),
      type: "deletable",
      source: edge.from,
      sourceHandle: "out",
      target: edge.to,
      targetHandle: "in",
      label: edge.output !== "next" ? edge.output : undefined,
      markerEnd: { type: MarkerType.ArrowClosed },
      animated: true,
      data: { onDelete: deleteEdge },
    })),
    [policy.edges, deleteEdge],
  );

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    const updated = applyNodeChanges(changes, nodes);
    const steps = policy.steps.map((step) => {
      const found = updated.find((n) => n.id === step.id);
      return found ? { ...step, position: found.position } : step;
    });
    onPolicyChange({ ...policy, steps });
  }, [nodes, policy, onPolicyChange]);

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    const updated = applyEdgeChanges(changes, edges);
    onPolicyChange({ ...policy, edges: updated.map((e) => ({ from: e.source, output: (e.label as string) || "next", to: e.target })) });
  }, [edges, policy, onPolicyChange]);

  const onConnect: OnConnect = useCallback((params) => {
    const updated = addEdge({ ...params, type: "deletable", markerEnd: { type: MarkerType.ArrowClosed }, animated: true, data: { onDelete: deleteEdge } }, edges);
    onPolicyChange({ ...policy, edges: updated.map((e) => ({ from: e.source, output: (e.label as string) || "next", to: e.target })) });
  }, [edges, policy, onPolicyChange, deleteEdge]);

  return (
    <section className="panel graph-panel" aria-labelledby="graph-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Policy flow</p>
          <h2 id="graph-heading">{policy.name}</h2>
        </div>
      </div>
      <div className="node-palette">
        <div className="palette-group">
          <span className="palette-label">Flow</span>
          {BUILT_IN_NODES.map((type) => <button className="small" key={type} type="button" disabled={type === "start" && hasStart} onClick={() => onAddStep("node", type)}>{type}</button>)}
        </div>
        <div className="palette-group">
          <span className="palette-label">Logic</span>
          {OPERATORS.map((type) => <button className="small palette-operator" key={type} type="button" onClick={() => onAddStep("operator", type)}>{type}</button>)}
        </div>
        {customNodes.length > 0 && (
          <div className="palette-group">
            <span className="palette-label">Nodes</span>
            {customNodes.map((node) => <button className="small palette-custom" key={node.id} type="button" onClick={() => onAddStep("node", node.id)}>{node.name}</button>)}
          </div>
        )}
      </div>
      <div className={panMode ? "flow-canvas pan-mode" : "flow-canvas"}>
        <ReactFlow
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
          onNodeClick={(_event, node) => onSelectStep(node.id)}
          nodeTypes={nodeTypes} edgeTypes={edgeTypes}
          fitView fitViewOptions={{ maxZoom: 1.2, padding: 0.3 }}
          defaultEdgeOptions={{ type: "smoothstep", animated: true, markerEnd: { type: MarkerType.ArrowClosed } }}
          connectionMode={ConnectionMode.Strict}
          nodesDraggable={!panMode} nodesConnectable={!panMode}
          autoPanOnNodeDrag={false} autoPanOnConnect={false} selectNodesOnDrag={false}
          elementsSelectable={false} panOnDrag={false} panActivationKeyCode="Alt"
          selectionOnDrag={false} selectionKeyCode={null}
          nodeDragThreshold={0} connectionDragThreshold={0} connectOnClick={true} connectionRadius={48}
          colorMode="dark" proOptions={{ hideAttribution: true }}
          connectionLineStyle={{ stroke: "#5cff57", strokeWidth: 3 }}
        >
          <Background gap={20} size={1} />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>
      <p className="muted graph-hint">Click node to inspect • Click green dot then click target to connect • Drag to move • Alt+drag to pan</p>
    </section>
  );
}

/* --- Node components --- */

function PolicyNode({ data }: NodeProps) {
  const { label, stepId, kind, isSelected, onSelect, onDelete } = data as unknown as NodeData;
  const [hovered, setHovered] = useState(false);
  const isStart = kind === "node" && label === "start";
  const isEnd = kind === "node" && label === "end";
  return (
    <div className={`policy-node ${isSelected ? "selected" : ""}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onClick={() => onSelect(stepId)}>
      {!isStart && <Handle id="in" type="target" position={Position.Left} isConnectableStart={false} />}
      <strong>{label}</strong>
      <span>{stepId}</span>
      {!isEnd && <Handle id="out" type="source" position={Position.Right} isConnectableEnd={false} />}
      {hovered && !isStart && <button className="node-delete" type="button" onPointerDown={(e) => { e.stopPropagation(); onDelete(stepId); }}>×</button>}
    </div>
  );
}

function OperatorNode({ data }: NodeProps) {
  const { label, stepId, isSelected, onSelect, onDelete } = data as unknown as NodeData;
  const [hovered, setHovered] = useState(false);
  return (
    <div className={`policy-node operator-diamond ${isSelected ? "selected" : ""}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onClick={() => onSelect(stepId)}>
      <Handle id="in" type="target" position={Position.Left} isConnectableStart={false} />
      <div className="diamond-inner">
        <strong>{label}</strong>
        <span>{stepId}</span>
      </div>
      <Handle id="out" type="source" position={Position.Right} isConnectableEnd={false} />
      {hovered && <button className="node-delete" type="button" onPointerDown={(e) => { e.stopPropagation(); onDelete(stepId); }}>×</button>}
    </div>
  );
}

function DeletableEdge(props: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const [path, labelX, labelY] = getSmoothStepPath(props);
  const data = props.data as { onDelete?: (id: string) => void } | undefined;
  return (
    <>
      <BaseEdge path={path} markerEnd={props.markerEnd} style={props.style} interactionWidth={0} />
      <EdgeLabelRenderer>
        <div className="edge-action-zone nodrag nopan" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
          style={{ width: 60, height: 36, transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}>
          {hovered && <button className="edge-delete visible" type="button" onPointerDown={(e) => { e.stopPropagation(); data?.onDelete?.(props.id); }}>del</button>}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

interface NodeData { label: string; stepId: string; kind: string; isSelected: boolean; onSelect: (id: string) => void; onDelete: (id: string) => void; }

const nodeTypes = { policyNode: PolicyNode, operatorNode: OperatorNode };
const edgeTypes = { deletable: DeletableEdge };

type PolicyEdgeType = PolicyConfig["edges"][number];
function edgeId(edge: PolicyEdgeType, index: number): string { return `${edge.from}-${edge.output}-${edge.to}-${index}`; }

function policyHandles(kind: string, type: string): NodeHandle[] {
  const h: NodeHandle[] = [];
  if (!(kind === "node" && type === "end")) h.push({ id: "out", type: "source", position: Position.Right, x: NODE_WIDTH - 11, y: NODE_HEIGHT / 2 - 11, width: 22, height: 22 });
  if (!(kind === "node" && type === "start")) h.push({ id: "in", type: "target", position: Position.Left, x: -11, y: NODE_HEIGHT / 2 - 11, width: 22, height: 22 });
  return h;
}

export function paramsToText(params: Record<string, unknown> | undefined): string {
  return JSON.stringify(params ?? {}, null, 2);
}
