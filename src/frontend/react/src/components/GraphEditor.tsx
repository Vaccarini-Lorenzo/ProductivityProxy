import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
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
  type EdgeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { CustomNodeConfig, PolicyConfig } from "../models/config/types";
import { operatorLayout, pointsAttr, labelPos, type Vec } from "./operatorShapes";

const FLOW_NODES = [
  { type: "start", label: "Start", desc: "Entry point with optional trigger" },
  { type: "end", label: "End", desc: "Stop this policy flow" },
];
const OPERATORS = [
  { type: "if", label: "If / Then / Else", desc: "One input, two outputs: then / else" },
  { type: "switch", label: "Switch", desc: "One input, a labelled output per case" },
];

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
  const [librarySearch, setLibrarySearch] = useState("");
  const hasStart = policy.steps.some((s) => s.kind === "node" && s.type === "start");
  const stepById = useMemo(() => new Map(policy.steps.map((step) => [step.id, step])), [policy.steps]);

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
    policy.steps.map((step, index) => {
      const isOperator = step.kind === "operator";
      return {
        id: step.id,
        type: isOperator ? "operatorNode" : "policyNode",
        position: step.position ?? { x: 80 + index * 240, y: 120 },
        data: { label: step.type, stepId: step.id, kind: step.kind, cases: (step.params?.cases as string[]) ?? [], isSelected: step.id === selectedStepId, onSelect: onSelectStep, onDelete: onDeleteStep },
        width: isOperator ? 132 : 200,
        height: isOperator ? 116 : 72,
      };
    }),
    [policy.steps, selectedStepId, onSelectStep, onDeleteStep],
  );

  const edges: Edge[] = useMemo(() =>
    policy.edges.map((edge, index) => {
      const sourceStep = stepById.get(edge.from);
      const sourceHandle = sourceStep?.kind === "operator" ? edge.output : "out";
      return {
        id: edgeId(edge, index),
        type: "deletable",
        source: edge.from,
        sourceHandle,
        target: edge.to,
        targetHandle: "in",
        label: edge.output !== "next" ? edge.output : undefined,
        markerEnd: { type: MarkerType.ArrowClosed },
        animated: true,
        data: { onDelete: deleteEdge },
      };
    }),
    [policy.edges, deleteEdge, stepById],
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
    onPolicyChange({ ...policy, edges: updated.map((e) => ({ from: e.source, output: edgeOutput(e), to: e.target })) });
  }, [edges, policy, onPolicyChange]);

  const onConnect: OnConnect = useCallback((params) => {
    const output = params.sourceHandle && params.sourceHandle !== "out" ? params.sourceHandle : "next";
    const updated = addEdge({ ...params, label: output !== "next" ? output : undefined, type: "deletable", markerEnd: { type: MarkerType.ArrowClosed }, animated: true, data: { onDelete: deleteEdge } }, edges);
    onPolicyChange({ ...policy, edges: updated.map((e) => ({ from: e.source, output: edgeOutput(e), to: e.target })) });
  }, [edges, policy, onPolicyChange, deleteEdge]);

  return (
    <section className="panel graph-panel" aria-labelledby="graph-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Policy flow</p>
          <h2 id="graph-heading">{policy.name}</h2>
        </div>
      </div>
      <div className="flow-workspace">
        <NodeLibrary search={librarySearch} onSearch={setLibrarySearch} customNodes={customNodes} hasStart={hasStart} onAddStep={onAddStep} />
        <div className="flow-main">
          <div className={panMode ? "flow-canvas pan-mode" : "flow-canvas"}>
            <ReactFlow
              nodes={nodes} edges={edges}
              onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
              onNodeClick={(_event, node) => onSelectStep(node.id)}
              nodeTypes={nodeTypes} edgeTypes={edgeTypes}
              fitView fitViewOptions={{ maxZoom: 1.2, padding: 0.3 }}
              connectionMode={ConnectionMode.Strict}
              nodesDraggable={!panMode} nodesConnectable={!panMode}
              autoPanOnNodeDrag={false} autoPanOnConnect={false} selectNodesOnDrag={false}
              elementsSelectable={false} panOnDrag={false} panActivationKeyCode="Alt"
              selectionOnDrag={false} selectionKeyCode={null}
              nodeDragThreshold={0} connectionDragThreshold={0} connectOnClick={true} connectionRadius={52}
              colorMode="dark" proOptions={{ hideAttribution: true }}
              connectionLineStyle={{ stroke: "#5cff57", strokeWidth: 3 }}
            >
              <Background gap={20} size={1} />
              <Controls />
              <MiniMap pannable zoomable />
            </ReactFlow>
          </div>
          <p className="muted graph-hint">Click a node to inspect • Click a green port then a target to connect • Drag to move • Alt+drag to pan</p>
        </div>
      </div>
    </section>
  );
}

function NodeLibrary({ search, onSearch, customNodes, hasStart, onAddStep }: {
  search: string;
  onSearch: (value: string) => void;
  customNodes: CustomNodeConfig[];
  hasStart: boolean;
  onAddStep: (kind: "node" | "operator", type: string) => void;
}) {
  const query = search.trim().toLowerCase();
  const matches = (text: string) => !query || text.toLowerCase().includes(query);
  const flow = FLOW_NODES.filter((item) => matches(`${item.label} ${item.desc}`));
  const operators = OPERATORS.filter((item) => matches(`${item.label} ${item.desc}`));
  const nodes = customNodes.filter((node) => matches(`${node.name} ${node.id} ${node.path}`));
  return (
    <aside className="node-library" aria-label="Node library">
      <div className="library-head">
        <strong>Library</strong>
        <span>{flow.length + operators.length + nodes.length}</span>
      </div>
      <label className="search-box compact-field">
        <span className="sr-only">Search library nodes</span>
        <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search nodes…" />
      </label>
      <LibrarySection title="Flow endpoints">
        {flow.map((item) => <LibraryButton key={item.type} title={item.label} desc={item.desc} tone="flow" disabled={item.type === "start" && hasStart} onClick={() => onAddStep("node", item.type)} />)}
      </LibrarySection>
      <LibrarySection title="Logic operators">
        {operators.map((item) => <LibraryButton key={item.type} title={item.label} desc={item.desc} tone="operator" onClick={() => onAddStep("operator", item.type)} />)}
      </LibrarySection>
      <LibrarySection title="Custom nodes">
        {nodes.map((node) => <LibraryButton key={node.id} title={node.name} desc={node.path} tone="custom" onClick={() => onAddStep("node", node.id)} />)}
        {nodes.length === 0 && <p className="muted library-empty">No matching custom nodes.</p>}
      </LibrarySection>
    </aside>
  );
}

function LibrarySection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="library-section"><h3>{title}</h3>{children}</section>;
}

function LibraryButton({ title, desc, tone, disabled, onClick }: { title: string; desc: string; tone: string; disabled?: boolean; onClick: () => void }) {
  return <button className={`library-item ${tone}`} type="button" disabled={disabled} onClick={onClick}><strong>{title}</strong><small>{desc}</small></button>;
}

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
  const { label, stepId, cases, isSelected, onSelect, onDelete } = data as unknown as NodeData;
  const [hovered, setHovered] = useState(false);
  const { verts, input, ports } = operatorLayout(label, cases);
  return (
    <div className={`operator-shape ${label} ${isSelected ? "selected" : ""}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onClick={() => onSelect(stepId)}>
      <svg className="operator-svg" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points={pointsAttr(verts)} /></svg>
      <span className="operator-name">{label}</span>
      <Handle id="in" type="target" position={Position.Left} className="op-handle" style={varStyle(input)} isConnectableStart={false} />
      {ports.map((p) => <Handle key={`h-${p.id}`} id={p.id} type="source" position={Position.Right} className="op-handle" style={varStyle(p)} isConnectableEnd={false} />)}
      {ports.map((p) => <span key={`l-${p.id}`} className="op-port-label" style={labelStyle(p)}>{p.id}</span>)}
      {hovered && <button className="node-delete" type="button" onPointerDown={(e) => { e.stopPropagation(); onDelete(stepId); }}>×</button>}
    </div>
  );
}

function DeletableEdge(props: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const [path, labelX, labelY] = getSmoothStepPath(props);
  const data = props.data as { onDelete?: (id: string) => void } | undefined;
  return <><BaseEdge path={path} markerEnd={props.markerEnd} style={props.style} interactionWidth={0} />
    <EdgeLabelRenderer><div className="edge-action-zone nodrag nopan" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ width: 60, height: 36, transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}>
      {hovered && <button className="edge-delete visible" type="button" onPointerDown={(e) => { e.stopPropagation(); data?.onDelete?.(props.id); }}>del</button>}
    </div></EdgeLabelRenderer></>;
}

interface NodeData { label: string; stepId: string; kind: string; cases: string[]; isSelected: boolean; onSelect: (id: string) => void; onDelete: (id: string) => void; }
const nodeTypes = { policyNode: PolicyNode, operatorNode: OperatorNode };
const edgeTypes = { deletable: DeletableEdge };

function varStyle(p: Vec): CSSProperties { return { "--hx": `${p.x}%`, "--hy": `${p.y}%` } as CSSProperties; }
function labelStyle(p: Vec): CSSProperties { const l = labelPos(p); return { left: `${l.x}%`, top: `${l.y}%` }; }

type PolicyEdgeType = PolicyConfig["edges"][number];
function edgeId(edge: PolicyEdgeType, index: number): string { return `${edge.from}-${edge.output}-${edge.to}-${index}`; }
function edgeOutput(edge: Edge): string { return edge.sourceHandle && edge.sourceHandle !== "out" ? String(edge.sourceHandle) : (edge.label as string) || "next"; }
export function paramsToText(params: Record<string, unknown> | undefined): string { return JSON.stringify(params ?? {}, null, 2); }
