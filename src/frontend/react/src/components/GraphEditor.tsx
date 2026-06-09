import { useCallback, useEffect, useRef, useState, memo, type CSSProperties, type ReactNode } from "react";
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
  getSmoothStepPath,
  type Node,
  type Edge,
  type Connection,
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
const FIT_VIEW_OPTIONS = { maxZoom: 1.2, padding: 0.3 };
const CONNECTION_LINE_STYLE = { stroke: "#5cff57", strokeWidth: 3 };
const PRO_OPTIONS = { hideAttribution: true };

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

  // Keep current policy + parent callbacks in refs so editor handlers stay stable
  // (so the rebuild effects below never re-run mid-drag). See docs/react-flow-best-practices.md.
  const policyRef = useRef(policy);
  policyRef.current = policy;
  const cbRef = useRef({ onPolicyChange, onSelectStep, onDeleteStep });
  cbRef.current = { onPolicyChange, onSelectStep, onDeleteStep };

  const handleSelect = useCallback((id: string) => cbRef.current.onSelectStep(id), []);
  const handleDelete = useCallback((id: string) => cbRef.current.onDeleteStep(id), []);
  const deleteEdge = useCallback((id: string) => {
    const p = policyRef.current;
    cbRef.current.onPolicyChange({ ...p, edges: p.edges.filter((e, i) => edgeId(e, i) !== id) });
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(buildNodes(policy, selectedStepId, handleSelect, handleDelete));
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(buildEdges(policy, deleteEdge));

  // Rebuild from props on real structural changes only (not on every drag tick).
  useEffect(() => { setNodes(buildNodes(policy, selectedStepId, handleSelect, handleDelete)); }, [policy, selectedStepId, handleSelect, handleDelete, setNodes]);
  useEffect(() => { setEdges(buildEdges(policy, deleteEdge)); }, [policy, deleteEdge, setEdges]);

  useEffect(() => {
    const update = (e: KeyboardEvent) => setPanMode(e.altKey);
    const stop = () => setPanMode(false);
    window.addEventListener("keydown", update);
    window.addEventListener("keyup", update);
    window.addEventListener("blur", stop);
    return () => { window.removeEventListener("keydown", update); window.removeEventListener("keyup", update); window.removeEventListener("blur", stop); };
  }, []);

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
              onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
              onConnect={onConnect} onNodeDragStop={onNodeDragStop}
              onNodeClick={(_event, node) => handleSelect(node.id)}
              nodeTypes={nodeTypes} edgeTypes={edgeTypes}
              fitView fitViewOptions={FIT_VIEW_OPTIONS}
              connectionMode={ConnectionMode.Strict}
              nodesDraggable={!panMode} nodesConnectable={!panMode}
              elementsSelectable={false} selectNodesOnDrag={false}
              panOnDrag={false} panActivationKeyCode="Alt"
              selectionOnDrag={false} selectionKeyCode={null} deleteKeyCode={null}
              connectOnClick={true} connectionRadius={30}
              colorMode="dark" proOptions={PRO_OPTIONS}
              connectionLineStyle={CONNECTION_LINE_STYLE}
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

const PolicyNode = memo(function PolicyNode({ data }: NodeProps) {
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
});

const OperatorNode = memo(function OperatorNode({ data }: NodeProps) {
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
});

const DeletableEdge = memo(function DeletableEdge(props: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const [path, labelX, labelY] = getSmoothStepPath(props);
  const data = props.data as { onDelete?: (id: string) => void } | undefined;
  return <><BaseEdge path={path} markerEnd={props.markerEnd} style={props.style} interactionWidth={0} />
    <EdgeLabelRenderer><div className="edge-action-zone nodrag nopan" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ width: 60, height: 36, transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}>
      {hovered && <button className="edge-delete visible" type="button" onPointerDown={(e) => { e.stopPropagation(); data?.onDelete?.(props.id); }}>del</button>}
    </div></EdgeLabelRenderer></>;
});

interface NodeData { label: string; stepId: string; kind: string; cases: string[]; isSelected: boolean; onSelect: (id: string) => void; onDelete: (id: string) => void; }
const nodeTypes = { policyNode: PolicyNode, operatorNode: OperatorNode };
const edgeTypes = { deletable: DeletableEdge };

function buildNodes(policy: PolicyConfig, selectedStepId: string | null, onSelect: (id: string) => void, onDelete: (id: string) => void): Node[] {
  return policy.steps.map((step, index) => {
    const isOperator = step.kind === "operator";
    return {
      id: step.id,
      type: isOperator ? "operatorNode" : "policyNode",
      position: step.position ?? { x: 80 + index * 240, y: 120 },
      data: { label: step.type, stepId: step.id, kind: step.kind, cases: (step.params?.cases as string[]) ?? [], isSelected: step.id === selectedStepId, onSelect, onDelete },
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
      label: edge.output !== "next" ? edge.output : undefined, markerEnd: { type: MarkerType.ArrowClosed }, animated: true, data: { onDelete },
    };
  });
}

function varStyle(p: Vec): CSSProperties { return { "--hx": `${p.x}%`, "--hy": `${p.y}%` } as CSSProperties; }
function labelStyle(p: Vec): CSSProperties { const l = labelPos(p); return { left: `${l.x}%`, top: `${l.y}%` }; }

type PolicyEdgeType = PolicyConfig["edges"][number];
function edgeId(edge: PolicyEdgeType, index: number): string { return `${edge.from}-${edge.output}-${edge.to}-${index}`; }
export function paramsToText(params: Record<string, unknown> | undefined): string { return JSON.stringify(params ?? {}, null, 2); }
