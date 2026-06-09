import type { GraphEdge, GraphNode, ModeConfig, NodeParams } from "../models/config/types";

const BUILT_INS = ["block", "log", "track_time", "notify", "redirect", "if", "switch", "python", "end"];

interface Props {
  mode: ModeConfig;
  selectedNodeId: string;
  edgeOutput: string;
  edgeFrom: string;
  edgeTo: string;
  paramsText: string;
  onSelectNode: (nodeId: string) => void;
  onAddNode: (type: string) => void;
  onParamsTextChange: (value: string) => void;
  onApplyParams: () => void;
  onEdgeOutputChange: (value: string) => void;
  onEdgeFromChange: (value: string) => void;
  onEdgeToChange: (value: string) => void;
  onAddEdge: () => void;
}

export function GraphEditor(props: Props) {
  const selectedNode = props.mode.graph.nodes.find((node) => node.id === props.selectedNodeId);

  return (
    <section className="panel graph-panel" aria-labelledby="graph-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Policy graph // canvas</p>
          <h2 id="graph-heading">{props.mode.name} graph</h2>
        </div>
        <div className="panel-stats" aria-label="Graph summary">
          <span>Nodes {props.mode.graph.nodes.length}</span>
          <span>Connections {props.mode.graph.edges.length}</span>
        </div>
      </div>

      <div className="graph-workbench">
        <div className="graph-canvas" role="img" aria-label={`Graph for ${props.mode.name}`}>
          <svg className="graph-edges" aria-hidden="true">
            <defs>
              <marker id="edge-arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L0,6 L9,3 z" />
              </marker>
            </defs>
            {props.mode.graph.edges.map((edge, index) => (
              <GraphEdgeLine key={`${edge.from}-${edge.to}-${index}`} edge={edge} from={findNode(props.mode, edge.from)} to={findNode(props.mode, edge.to)} />
            ))}
          </svg>
          {props.mode.graph.nodes.map((node, index) => (
            <GraphNodeCard key={node.id} node={node} index={index} selected={node.id === props.selectedNodeId} onSelect={props.onSelectNode} />
          ))}
        </div>

        <aside className="operator-palette" aria-label="Add graph node">
          <p className="eyebrow">Operators</p>
          <h3>Drag-ready blocks</h3>
          <p className="muted">Click an operator to add it to the canvas.</p>
          <div className="node-toolbar">
            {BUILT_INS.map((type) => (
              <button className="operator-card" key={type} type="button" onClick={() => props.onAddNode(type)}>
                <strong>[+] {type}</strong>
                <small>Add {type}</small>
              </button>
            ))}
          </div>
        </aside>
      </div>

      <div className="editor-grid graph-controls">
        <div>
          <h3>Node params</h3>
          <p className="muted">Selected: {selectedNode?.id ?? "none"}</p>
          <label className="field">
            <span>Params JSON</span>
            <textarea value={props.paramsText} onChange={(event) => props.onParamsTextChange(event.target.value)} />
          </label>
          <button type="button" onClick={props.onApplyParams} disabled={!selectedNode}>Apply params</button>
        </div>
        <div>
          <h3>Add edge</h3>
          <GraphSelect label="From" value={props.edgeFrom} nodes={props.mode.graph.nodes} onChange={props.onEdgeFromChange} />
          <label className="field">
            <span>Output</span>
            <input value={props.edgeOutput} onChange={(event) => props.onEdgeOutputChange(event.target.value)} />
          </label>
          <GraphSelect label="To" value={props.edgeTo} nodes={props.mode.graph.nodes} onChange={props.onEdgeToChange} />
          <button type="button" onClick={props.onAddEdge}>Add edge</button>
        </div>
      </div>
    </section>
  );
}

function GraphNodeCard({ node, index, selected, onSelect }: { node: GraphNode; index: number; selected: boolean; onSelect: (id: string) => void }) {
  const position = node.position ?? { x: 80 + index * 140, y: 120 };
  const classes = ["graph-node", selected ? "selected" : "", node.type === "block" ? "danger" : ""].filter(Boolean).join(" ");
  return (
    <button className={classes} type="button" style={{ left: position.x, top: position.y }} onClick={() => onSelect(node.id)}>
      <strong>{node.type}</strong>
      <span>{node.id}</span>
    </button>
  );
}

function GraphEdgeLine({ edge, from, to }: { edge: GraphEdge; from?: GraphNode; to?: GraphNode }) {
  if (!from || !to) return null;
  const fromPosition = from.position ?? { x: 80, y: 120 };
  const toPosition = to.position ?? { x: 220, y: 120 };
  const classes = edge.output === "no" || edge.output === "false" ? "edge-negative" : "";
  return <line className={classes} x1={fromPosition.x + 150} y1={fromPosition.y + 34} x2={toPosition.x} y2={toPosition.y + 34} />;
}

function GraphSelect({ label, value, nodes, onChange }: { label: string; value: string; nodes: GraphNode[]; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {nodes.map((node) => <option key={node.id} value={node.id}>{node.id}</option>)}
      </select>
    </label>
  );
}

function findNode(mode: ModeConfig, nodeId: string) {
  return mode.graph.nodes.find((node) => node.id === nodeId);
}

export function paramsToText(params: NodeParams | undefined): string {
  return JSON.stringify(params ?? {}, null, 2);
}
