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
const NODE_WIDTH = 220;
const NODE_HEIGHT = 88;

interface Props {
  policy: PolicyConfig;
  customNodes: CustomNodeConfig[];
  onPolicyChange: (policy: PolicyConfig) => void;
  onAddStep: (kind: "node" | "operator", type: string) => void;
}

export function GraphEditor({ policy, customNodes, onPolicyChange, onAddStep }: Props) {
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

  const deleteEdge = useCallback((id: string) => {
    const policyEdges = policy.edges.filter((edge, index) => edgeId(edge, index) !== id);
    onPolicyChange({ ...policy, edges: policyEdges });
  }, [policy, onPolicyChange]);

  const nodes: Node[] = useMemo(() =>
    policy.steps.map((step, index) => ({
      id: step.id,
      type: "policyNode",
      position: step.position ?? { x: 80 + index * 180, y: 120 },
      data: { label: stepLabel(step.kind, step.type), subLabel: step.id },
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      handles: policyHandles(step.kind, step.type),
    })),
    [policy.steps],
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
      animated: edge.output === "next",
      selectable: true,
      data: { onDelete: deleteEdge },
    })),
    [policy.edges, deleteEdge],
  );

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    const updated = applyNodeChanges(changes, nodes);
    const policySteps = policy.steps.map((step) => {
      const found = updated.find((item) => item.id === step.id);
      return found ? { ...step, position: found.position } : step;
    });
    onPolicyChange({ ...policy, steps: policySteps });
  }, [nodes, policy, onPolicyChange]);

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    const updated = applyEdgeChanges(changes, edges);
    const policyEdges = updated.map((edge) => ({
      from: edge.source,
      output: (edge.label as string) || "next",
      to: edge.target,
    }));
    onPolicyChange({ ...policy, edges: policyEdges });
  }, [edges, policy, onPolicyChange]);

  const onConnect: OnConnect = useCallback((params) => {
    const updated = addEdge({ ...params, type: "deletable", markerEnd: { type: MarkerType.ArrowClosed }, animated: true, selectable: true, data: { onDelete: deleteEdge } }, edges);
    const policyEdges = updated.map((edge) => ({
      from: edge.source,
      output: (edge.label as string) || "next",
      to: edge.target,
    }));
    onPolicyChange({ ...policy, edges: policyEdges });
  }, [edges, policy, onPolicyChange, deleteEdge]);

  return (
    <section className="panel graph-panel" aria-labelledby="graph-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Policy flow</p>
          <h2 id="graph-heading">{policy.name}</h2>
        </div>
        <div className="button-row">
          {BUILT_IN_NODES.map((type) => <button key={type} type="button" onClick={() => onAddStep("node", type)}>[+] {type}</button>)}
          {OPERATORS.map((type) => <button key={type} type="button" onClick={() => onAddStep("operator", type)}>[+] {type}</button>)}
          {customNodes.map((node) => <button key={node.id} type="button" onClick={() => onAddStep("node", node.id)}>[+] {node.name}</button>)}
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
          edgeTypes={edgeTypes}
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
      <p className="muted graph-hint">Drag steps to move • Drag from green dots to connect • Option/Alt + drag to pan • Scroll to zoom</p>
    </section>
  );
}

function PolicyNode({ data }: NodeProps) {
  const nodeData = data as { label: string; subLabel: string };
  const receivesInput = !nodeData.label.endsWith(":start");
  const sendsOutput = !nodeData.label.endsWith(":end");
  return (
    <div className="policy-node">
      {receivesInput && <Handle id="in" type="target" position={Position.Left} isConnectableStart={false} title="Input port" />}
      <strong>{nodeData.label}</strong>
      <span>{nodeData.subLabel}</span>
      {sendsOutput && <Handle id="out" type="source" position={Position.Right} isConnectableEnd={false} title="Output port" />}
    </div>
  );
}

function DeletableEdge(props: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const [path, labelX, labelY] = getSmoothStepPath(props);
  const data = props.data as { onDelete?: (id: string) => void } | undefined;
  const zoneWidth = Math.max(Math.abs(props.targetX - props.sourceX), 64);
  const zoneHeight = Math.max(Math.abs(props.targetY - props.sourceY), 44);

  return (
    <>
      <BaseEdge path={path} markerEnd={props.markerEnd} style={props.style} interactionWidth={0} />
      <EdgeLabelRenderer>
        <div
          className="edge-action-zone nodrag nopan"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{ height: zoneHeight, transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, width: zoneWidth }}
        >
          <button
            aria-label="Delete edge"
            className={hovered ? "edge-delete visible" : "edge-delete"}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => { event.stopPropagation(); data?.onDelete?.(props.id); }}
            type="button"
          >
            🗑
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { policyNode: PolicyNode };
const edgeTypes = { deletable: DeletableEdge };

type PolicyEdge = PolicyConfig["edges"][number];

function edgeId(edge: PolicyEdge, index: number): string {
  return `${edge.from}-${edge.output}-${edge.to}-${index}`;
}

function policyHandles(kind: string, type: string): NodeHandle[] {
  const handles: NodeHandle[] = [];
  if (!(kind === "node" && type === "end")) {
    handles.push({ id: "out", type: "source", position: Position.Right, x: NODE_WIDTH - 11, y: NODE_HEIGHT / 2 - 11, width: 22, height: 22 });
  }
  if (!(kind === "node" && type === "start")) {
    handles.push({ id: "in", type: "target", position: Position.Left, x: -11, y: NODE_HEIGHT / 2 - 11, width: 22, height: 22 });
  }
  return handles;
}

function stepLabel(kind: string, type: string): string {
  return `${kind}:${type}`;
}

export function paramsToText(params: Record<string, unknown> | undefined): string {
  return JSON.stringify(params ?? {}, null, 2);
}
