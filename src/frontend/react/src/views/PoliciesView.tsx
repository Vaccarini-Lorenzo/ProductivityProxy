import { GraphEditor, paramsToText } from "../components/GraphEditor";
import type { AppConfig, ModeConfig, PolicyGraph } from "../models/config/types";
import { addEdge, addNode, updateNodeParams } from "../services/graph/graphOperations";
import { useState } from "react";

interface Props {
  config: AppConfig;
  onConfigChange: (config: AppConfig) => void;
}

export function PoliciesView({ config, onConfigChange }: Props) {
  const activeMode = config.modes.find((m) => m.id === config.activeModeId) ?? config.modes[0];
  const [selectedNodeId, setSelectedNodeId] = useState(activeMode.graph.nodes[0]?.id ?? "");
  const [paramsText, setParamsText] = useState(() => paramsToText(activeMode.graph.nodes[0]?.params));
  const [edgeFrom, setEdgeFrom] = useState(activeMode.graph.nodes[0]?.id ?? "");
  const [edgeTo, setEdgeTo] = useState(activeMode.graph.nodes[1]?.id ?? "");
  const [edgeOutput, setEdgeOutput] = useState("next");
  const [newModeName, setNewModeName] = useState("");

  function updateGraph(nextGraph: PolicyGraph) {
    onConfigChange({
      ...config,
      modes: config.modes.map((m) => (m.id === activeMode.id ? { ...m, graph: nextGraph } : m)),
    });
  }

  function handleAddNode(type: string) {
    const nextGraph = addNode(activeMode.graph, type);
    const node = nextGraph.nodes[nextGraph.nodes.length - 1];
    updateGraph(nextGraph);
    setSelectedNodeId(node.id);
    setParamsText(paramsToText(node.params));
  }

  function handleApplyParams() {
    try {
      updateGraph(updateNodeParams(activeMode.graph, selectedNodeId, JSON.parse(paramsText)));
    } catch { /* invalid json */ }
  }

  function handleAddEdge() {
    updateGraph(addEdge(activeMode.graph, edgeFrom, edgeOutput || "next", edgeTo));
  }

  function handleSelectMode(id: string) {
    onConfigChange({ ...config, activeModeId: id });
    const mode = config.modes.find((m) => m.id === id);
    if (mode?.graph.nodes[0]) {
      setSelectedNodeId(mode.graph.nodes[0].id);
      setParamsText(paramsToText(mode.graph.nodes[0].params));
      setEdgeFrom(mode.graph.nodes[0].id);
      setEdgeTo(mode.graph.nodes[1]?.id ?? mode.graph.nodes[0].id);
    }
  }

  function handleSelectNode(nodeId: string) {
    setSelectedNodeId(nodeId);
    const node = activeMode.graph.nodes.find((n) => n.id === nodeId);
    if (node) setParamsText(paramsToText(node.params));
  }

  function handleAddMode() {
    const name = newModeName.trim();
    if (!name) return;
    const mode = createMode(name);
    onConfigChange({ ...config, modes: [...config.modes, mode], activeModeId: mode.id });
    setNewModeName("");
    setSelectedNodeId(mode.graph.nodes[0].id);
  }

  function handleDeleteMode(id: string) {
    if (config.modes.length <= 1) return;
    const modes = config.modes.filter((m) => m.id !== id);
    const activeModeId = config.activeModeId === id ? modes[0].id : config.activeModeId;
    onConfigChange({ ...config, modes, activeModeId });
  }

  return (
    <div className="view-stack">
      <header className="view-header">
        <p className="eyebrow">Traffic rules</p>
        <h1>Policies</h1>
      </header>

      <section className="panel" aria-labelledby="modes-heading">
        <h2 id="modes-heading">Modes</h2>
        <div className="mode-list">
          {config.modes.map((mode) => (
            <div key={mode.id} className={mode.id === config.activeModeId ? "mode-card active" : "mode-card"}>
              <button type="button" onClick={() => handleSelectMode(mode.id)}>
                <strong>{mode.name}</strong>
                <small>{mode.graph.nodes.length} nodes</small>
              </button>
              <button className="danger small" type="button" onClick={() => handleDeleteMode(mode.id)} disabled={config.modes.length <= 1}>
                [-]
              </button>
            </div>
          ))}
        </div>
        <div className="button-row">
          <input placeholder="New mode name" value={newModeName} onChange={(e) => setNewModeName(e.target.value)} />
          <button type="button" onClick={handleAddMode}>[+] Add mode</button>
        </div>
      </section>

      <GraphEditor
        mode={activeMode}
        selectedNodeId={selectedNodeId}
        paramsText={paramsText}
        edgeFrom={edgeFrom}
        edgeTo={edgeTo}
        edgeOutput={edgeOutput}
        onSelectNode={handleSelectNode}
        onAddNode={handleAddNode}
        onParamsTextChange={setParamsText}
        onApplyParams={handleApplyParams}
        onEdgeFromChange={setEdgeFrom}
        onEdgeToChange={setEdgeTo}
        onEdgeOutputChange={setEdgeOutput}
        onAddEdge={handleAddEdge}
      />
    </div>
  );
}

function createMode(name: string): ModeConfig {
  const id = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "mode";
  return {
    id,
    name,
    graph: {
      nodes: [
        { id: `${id}-start`, type: "start", position: { x: 80, y: 120 } },
        { id: `${id}-end`, type: "end", position: { x: 320, y: 120 } },
      ],
      edges: [{ from: `${id}-start`, output: "next", to: `${id}-end` }],
    },
  };
}
