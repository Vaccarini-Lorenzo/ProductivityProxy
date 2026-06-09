import { useState } from "react";
import { GraphEditor } from "../components/GraphEditor";
import type { AppConfig, ModeConfig, PolicyGraph } from "../models/config/types";
import { addNode } from "../services/graph/graphOperations";

interface Props {
  config: AppConfig;
  onConfigChange: (config: AppConfig) => void;
}

export function PoliciesView({ config, onConfigChange }: Props) {
  const activeMode = config.modes.find((m) => m.id === config.activeModeId) ?? config.modes[0];
  const [newModeName, setNewModeName] = useState("");

  function updateGraph(nextGraph: PolicyGraph) {
    onConfigChange({
      ...config,
      modes: config.modes.map((m) => (m.id === activeMode.id ? { ...m, graph: nextGraph } : m)),
    });
  }

  function handleAddNode(type: string) {
    updateGraph(addNode(activeMode.graph, type));
  }

  function handleSelectMode(id: string) {
    onConfigChange({ ...config, activeModeId: id });
  }

  function handleAddMode() {
    const name = newModeName.trim();
    if (!name) return;
    const mode = createMode(name);
    onConfigChange({ ...config, modes: [...config.modes, mode], activeModeId: mode.id });
    setNewModeName("");
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

      <GraphEditor mode={activeMode} onGraphChange={updateGraph} onAddNode={handleAddNode} />
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
        { id: `${id}-start`, type: "start", position: { x: 80, y: 200 } },
        { id: `${id}-end`, type: "end", position: { x: 460, y: 200 } },
      ],
      edges: [],
    },
  };
}
