import { useState } from "react";
import type { AppConfig, ModeConfig } from "../models/config/types";
import { createMode } from "../services/config/configEditing";
import { Card, Field, Modal, PageHeader, count } from "../components/ui";

interface Props {
  config: AppConfig;
  onConfigChange: (config: AppConfig) => void;
}

export function ModesView({ config, onConfigChange }: Props) {
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const editMode = config.modes.find((mode) => mode.id === editId) ?? null;

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

  const addControl = (
    <div className="add-control">
      <input aria-label="New mode name" placeholder="New mode name" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMode()} />
      <button type="button" onClick={addMode} disabled={!newName.trim()}>Add mode</button>
    </div>
  );

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Modes" title="Runtime modes" subtitle="A mode groups ordered policies. Only the active mode is evaluated. Click a mode to make it active." />

      <Card title="Modes" actions={addControl}>
        <div className="list">
          {config.modes.map((mode) => {
            const isActive = mode.id === config.activeModeId;
            const steps = mode.policies.reduce((c, p) => c + p.steps.length, 0);
            return (
              <div className={isActive ? "list-row active" : "list-row"} key={mode.id}>
                <button className="list-main" type="button" onClick={() => onConfigChange({ ...config, activeModeId: mode.id })}>
                  <span className="list-title">{mode.name}{isActive && <span className="badge">active</span>}</span>
                  <small>{mode.description || "No description"}</small>
                </button>
                <span className="list-meta">{count(mode.policies.length, "policy", "policies")} · {count(steps, "step")}</span>
                <button className="small" type="button" onClick={() => setEditId(mode.id)}>Edit</button>
                <button className="danger small" type="button" onClick={() => deleteMode(mode.id)} disabled={config.modes.length <= 1}>Delete</button>
              </div>
            );
          })}
        </div>
      </Card>

      {editMode && (
        <Modal
          title={`Edit “${editMode.name}”`}
          onClose={() => setEditId(null)}
          footer={<button className="primary" type="button" onClick={() => setEditId(null)}>Done</button>}
        >
          <Field label="Name">
            <input autoFocus value={editMode.name} onChange={(e) => updateMode({ ...editMode, name: e.target.value })} />
          </Field>
          <Field label="Description">
            <input value={editMode.description ?? ""} onChange={(e) => updateMode({ ...editMode, description: e.target.value })} />
          </Field>
          <p className="inline-note">Changes are saved automatically. Use “Save config” to persist them to disk.</p>
        </Modal>
      )}
    </div>
  );
}
