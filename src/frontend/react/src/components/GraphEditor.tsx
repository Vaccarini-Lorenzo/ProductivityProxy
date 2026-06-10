import { useCallback, useEffect, useRef, useState, memo, type CSSProperties } from "react";
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
  useNodesState,
  useEdgesState,
  getBezierPath,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
  type EdgeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./GraphEditor.css";
import type { PolicyConfig } from "../models/config/types";
import { Icon, type IconName } from "./ui";
import { operatorLayout, pointsAttr, labelPos, type Vec } from "./operatorShapes";

const FIT_VIEW_OPTIONS = { maxZoom: 1.2, padding: 0.3 };
const CONNECTION_LINE_STYLE = { stroke: "#5cff57", strokeWidth: 3 };
const PRO_OPTIONS = { hideAttribution: true };

interface Props {
  policy: PolicyConfig;
  openStepId: string | null;
  onPolicyChange: (policy: PolicyConfig) => void;
  onOpenStep: (stepId: string) => void;
  onDeleteStep: (stepId: string) => void;
  readOnly?: boolean;
  invalidStepIds?: Set<string>;
}

export function GraphEditor({ policy, openStepId, onPolicyChange, onOpenStep, onDeleteStep, readOnly = false, invalidStepIds }: Props) {
  const [panMode, setPanMode] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const invalidKey = invalidStepIds ? [...invalidStepIds].sort().join("|") : "";

  // Keep current policy + parent callbacks in refs so editor handlers stay stable
  // (so the rebuild effects below never re-run mid-drag). See docs/architecture/2_component/react-graph-editor.md.
  const policyRef = useRef(policy);
  policyRef.current = policy;
  const cbRef = useRef({ onPolicyChange, onOpenStep, onDeleteStep });
  cbRef.current = { onPolicyChange, onOpenStep, onDeleteStep };

  const handleOpen = useCallback((id: string) => cbRef.current.onOpenStep(id), []);
  const handleDelete = useCallback((id: string) => cbRef.current.onDeleteStep(id), []);
  const deleteEdge = useCallback((id: string) => {
    const p = policyRef.current;
    cbRef.current.onPolicyChange({ ...p, edges: p.edges.filter((e, i) => edgeId(e, i) !== id) });
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(buildNodes(policy, openStepId, handleOpen, handleDelete, invalidStepIds, readOnly));
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(buildEdges(policy, deleteEdge));

  // Rebuild from props on real structural changes only (not on every drag tick).
  useEffect(() => { setNodes(buildNodes(policy, openStepId, handleOpen, handleDelete, invalidStepIds, readOnly)); }, [policy, openStepId, handleOpen, handleDelete, setNodes, invalidKey, readOnly]);
  useEffect(() => { setEdges(buildEdges(policy, deleteEdge)); }, [policy, deleteEdge, setEdges]);

  useEffect(() => {
    const update = (e: KeyboardEvent) => setPanMode(e.altKey);
    const stop = () => setPanMode(false);
    window.addEventListener("keydown", update);
    window.addEventListener("keyup", update);
    window.addEventListener("blur", stop);
    return () => { window.removeEventListener("keydown", update); window.removeEventListener("keyup", update); window.removeEventListener("blur", stop); };
  }, []);

  useEffect(() => {
    if (!fullscreen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [fullscreen]);

  const onNodeDragStop = useCallback((_e: unknown, node: Node) => {
    const p = policyRef.current;
    cbRef.current.onPolicyChange({ ...p, steps: p.steps.map((s) => (s.id === node.id ? { ...s, position: node.position } : s)) });
  }, []);

  const onConnect = useCallback((conn: Connection) => {
    if (!conn.source || !conn.target) return;
    const output = conn.sourceHandle && conn.sourceHandle !== "out" ? conn.sourceHandle : "next";
    const p = policyRef.current;
    cbRef.current.onPolicyChange({ ...p, edges: [...p.edges, { from: conn.source, output, to: conn.target }] });
  }, []);

  return (
    <div className="flow-wrap">
      <div className={`${panMode ? "flow-canvas pan-mode" : "flow-canvas"}${fullscreen ? " fullscreen" : ""}`}>
        <button type="button" className="small canvas-fullscreen-button" onClick={() => setFullscreen(!fullscreen)}>{fullscreen ? "Exit full screen" : "Full screen"}</button>
        <ReactFlow
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onConnect={readOnly ? undefined : onConnect} onNodeDragStop={onNodeDragStop}
          onNodeClick={readOnly ? undefined : (_event, node) => handleOpen(node.id)}
          nodeTypes={nodeTypes} edgeTypes={edgeTypes}
          fitView fitViewOptions={FIT_VIEW_OPTIONS}
          connectionMode={ConnectionMode.Strict}
          nodesDraggable={!panMode && !readOnly} nodesConnectable={!panMode && !readOnly}
          elementsSelectable={false} selectNodesOnDrag={false}
          panOnDrag={false} panActivationKeyCode="Alt"
          selectionOnDrag={false} selectionKeyCode={null} deleteKeyCode={null}
          connectOnClick={true} connectionRadius={30}
          colorMode="dark" proOptions={PRO_OPTIONS}
          connectionLineStyle={CONNECTION_LINE_STYLE}
        >
          <Background gap={20} size={1} />
          <Controls showInteractive={false} showFitView={false} />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>
      {!readOnly && <p className="graph-hint">Click a node to open it • click a green port then a target to connect • drag to move • Alt+drag to pan</p>}
    </div>
  );
}

const PolicyNode = memo(function PolicyNode({ data }: NodeProps) {
  const { label, stepId, kind, isSelected, isInvalid, readOnly, onOpen, onDelete } = data as unknown as NodeData;
  const [hovered, setHovered] = useState(false);
  const isStart = kind === "node" && label === "start";
  const isEnd = kind === "node" && label === "end";
  const typeClass = isStart ? "start" : isEnd ? "end" : "custom";
  const typeIcon: IconName = isStart ? "play" : isEnd ? "stop" : "hexagon";
  return (
    <div className={`policy-node ${typeClass} ${isSelected ? "selected" : ""} ${isInvalid ? "invalid" : ""}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onClick={() => !readOnly && onOpen(stepId)}>
      {!isStart && <Handle id="in" type="target" position={Position.Left} isConnectableStart={false} />}
      <span className="policy-node-icon"><Icon name={typeIcon} /></span>
      <span className="policy-node-text">
        <strong>{label}</strong>
        <span>{stepId}</span>
      </span>
      {!isEnd && <Handle id="out" type="source" position={Position.Right} isConnectableEnd={false} />}
      {!readOnly && hovered && <button className="node-expand" type="button" title="Open" onPointerDown={(e) => { e.stopPropagation(); onOpen(stepId); }}>⤢</button>}
      {!readOnly && hovered && !isStart && <button className="node-delete" type="button" title="Delete" onPointerDown={(e) => { e.stopPropagation(); onDelete(stepId); }}>×</button>}
    </div>
  );
});

const OperatorNode = memo(function OperatorNode({ data }: NodeProps) {
  const { label, stepId, cases, isSelected, isInvalid, readOnly, onOpen, onDelete } = data as unknown as NodeData;
  const [hovered, setHovered] = useState(false);
  const { verts, input, ports } = operatorLayout(label, cases);
  return (
    <div className={`operator-shape ${label} ${isSelected ? "selected" : ""} ${isInvalid ? "invalid" : ""}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onClick={() => !readOnly && onOpen(stepId)}>
      <svg className="operator-svg" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points={pointsAttr(verts)} /></svg>
      <span className="operator-name">{label}</span>
      <Handle id="in" type="target" position={Position.Left} className="op-handle" style={varStyle(input)} isConnectableStart={false} />
      {ports.map((p) => <Handle key={`h-${p.id}`} id={p.id} type="source" position={Position.Right} className="op-handle" style={varStyle(p)} isConnectableEnd={false} />)}
      {ports.map((p) => <span key={`l-${p.id}`} className="op-port-label" style={labelStyle(p)}>{p.id}</span>)}
      {!readOnly && hovered && <button className="node-expand" type="button" title="Open" onPointerDown={(e) => { e.stopPropagation(); onOpen(stepId); }}>⤢</button>}
      {!readOnly && hovered && <button className="node-delete" type="button" title="Delete" onPointerDown={(e) => { e.stopPropagation(); onDelete(stepId); }}>×</button>}
    </div>
  );
});

const DeletableEdge = memo(function DeletableEdge(props: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const [path, labelX, labelY] = getBezierPath(props);
  const data = props.data as { onDelete?: (id: string) => void } | undefined;
  return <><BaseEdge path={path} markerEnd={props.markerEnd} style={props.style} interactionWidth={0} />
    <EdgeLabelRenderer><div className="edge-action-zone nodrag nopan" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ width: 60, height: 36, transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}>
      {hovered && <button className="edge-delete visible" type="button" onPointerDown={(e) => { e.stopPropagation(); data?.onDelete?.(props.id); }}>del</button>}
    </div></EdgeLabelRenderer></>;
});

interface NodeData { label: string; stepId: string; kind: string; cases: string[]; isSelected: boolean; isInvalid: boolean; readOnly: boolean; onOpen: (id: string) => void; onDelete: (id: string) => void; }
const nodeTypes = { policyNode: PolicyNode, operatorNode: OperatorNode };
const edgeTypes = { deletable: DeletableEdge };

function buildNodes(policy: PolicyConfig, openStepId: string | null, onOpen: (id: string) => void, onDelete: (id: string) => void, invalidStepIds?: Set<string>, readOnly = false): Node[] {
  return policy.steps.map((step, index) => {
    const isOperator = step.kind === "operator";
    return {
      id: step.id,
      type: isOperator ? "operatorNode" : "policyNode",
      position: step.position ?? { x: 80 + index * 240, y: 120 },
      data: { label: step.type, stepId: step.id, kind: step.kind, cases: (step.params?.cases as string[]) ?? [], isSelected: step.id === openStepId, isInvalid: invalidStepIds?.has(step.id) ?? false, readOnly, onOpen, onDelete },
      width: isOperator ? 132 : 200,
      height: isOperator ? 116 : 72,
    };
  });
}

function buildEdges(policy: PolicyConfig, onDelete: (id: string) => void): Edge[] {
  const stepById = new Map(policy.steps.map((s) => [s.id, s]));
  return policy.edges.map((edge, index) => {
    const sourceStep = stepById.get(edge.from);
    const sourceHandle = sourceStep?.kind === "operator" ? edge.output : "out";
    return {
      id: edgeId(edge, index), type: "deletable", source: edge.from, sourceHandle, target: edge.to, targetHandle: "in",
      label: edge.output !== "next" ? edge.output : undefined, markerEnd: { type: MarkerType.ArrowClosed }, animated: false, data: { onDelete },
    };
  });
}

function varStyle(p: Vec): CSSProperties { return { "--hx": `${p.x}%`, "--hy": `${p.y}%` } as CSSProperties; }
function labelStyle(p: Vec): CSSProperties { const l = labelPos(p); return { left: `${l.x}%`, top: `${l.y}%` }; }

type PolicyEdgeType = PolicyConfig["edges"][number];
function edgeId(edge: PolicyEdgeType, index: number): string { return `${edge.from}-${edge.output}-${edge.to}-${index}`; }
export function paramsToText(params: Record<string, unknown> | undefined): string { return JSON.stringify(params ?? {}, null, 2); }
