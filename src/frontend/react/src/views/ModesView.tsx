import type { AppConfig, ModeConfig } from "../models/config/types";
import { createMode } from "../services/config/configEditing";
import { useState } from "react";

interface Props {
  config: AppConfig;
  onConfigChange: (config: AppConfig) => void;
}

export function ModesView({ config, onConfigChange }: Props) {
  const activeMode = config.modes.find((mode) => mode.id === config.activeModeId) ?? config.modes[0];
  const [newName, setNewName] = useState("");

  function updateMode(nextMode: ModeConfig) {
    onConfigChange({ ...config, modes: config.modes.map((mode) => (mode.id === nextMode.id ? nextMode : mode)) });
  }

  function addMode() {
    const name = newName.trim();
    if (!name) return;
    const mode = createMode(name, config.modes.map((item) => item.id));
    onConfigChange({ ...config, activeModeId: mode.id, modes: [...config.modes, mode] });
    setNewName("");
  }

  function deleteMode(id: string) {
    if (config.modes.length <= 1) return;
    const modes = config.modes.filter((mode) => mode.id !== id);
    const activeModeId = config.activeModeId === id ? modes[0].id : config.activeModeId;
    onConfigChange({ ...config, activeModeId, modes });
  }

  return (
    <div className="page-stack">
      <section className="page-title">
        <p className="eyebrow">Modes</p>
        <h1>Runtime modes</h1>
        <p className="muted">Modes group ordered policies. Only the active mode is evaluated.</p>
      </section>

      <section className="terminal-card" aria-labelledby="mode-list-heading">
        <div className="section-head">
          <h2 id="mode-list-heading">Available modes</h2>
          <div className="actions compact">
            <input aria-label="New mode name" placeholder="New mode name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <button type="button" onClick={addMode}>create</button>
          </div>
        </div>
        <div className="mode-list">
          {config.modes.map((mode) => (
            <div className={mode.id === config.activeModeId ? "mode-row active" : "mode-row"} key={mode.id}>
              <span className="dot" aria-hidden="true" />
              <button className="row-main" type="button" onClick={() => onConfigChange({ ...config, activeModeId: mode.id })}>
                <strong>{mode.name} {mode.id === config.activeModeId && <span className="tag">active</span>}</strong>
                <small>{mode.description || "No description"}</small>
              </button>
              <span className="row-meta">{mode.policies.length} pol · {mode.policies.reduce((c, p) => c + p.steps.length, 0)} steps</span>
              <button className="danger small" type="button" onClick={() => deleteMode(mode.id)} disabled={config.modes.length <= 1}>del</button>
            </div>
          ))}
        </div>
      </section>

      {activeMode && (
        <section className="terminal-card" aria-labelledby="mode-edit-heading">
          <h2 id="mode-edit-heading">Edit: {activeMode.name}</h2>
          <div className="form-grid">
            <label className="field">
              <span>Name</span>
              <input value={activeMode.name} onChange={(e) => updateMode({ ...activeMode, name: e.target.value })} />
            </label>
            <label className="field">
              <span>Description</span>
              <input value={activeMode.description ?? ""} onChange={(e) => updateMode({ ...activeMode, description: e.target.value })} />
            </label>
          </div>
        </section>
      )}
    </div>
  );
}
