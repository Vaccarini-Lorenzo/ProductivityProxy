import { useState } from "react";
import type { AppConfig, ModeConfig, PolicyConfig } from "../models/config/types";
import { createMode } from "../services/config/configEditing";
import { Card, Field, IconButton, Modal, PageHeader, count } from "../components/ui";

interface Props {
  config: AppConfig;
  onConfigChange: (config: AppConfig) => void;
}

function policyById(config: AppConfig, id: string): PolicyConfig | undefined {
  return config.policies.find((policy) => policy.id === id);
}

export function ModesView({ config, onConfigChange }: Props) {
  const [editId, setEditId] = useState<string | null>(null);
  const editMode = config.modes.find((mode) => mode.id === editId) ?? null;

  function addMode() {
    const mode = createMode("New mode", config.modes.map((item) => item.id));
    onConfigChange({ ...config, modes: [...config.modes, mode] });
    setEditId(mode.id);
  }

  function deleteMode(id: string) {
    if (config.modes.length <= 1) return;
    const modes = config.modes.filter((mode) => mode.id !== id);
    const activeModeId = config.activeModeId === id ? modes[0].id : config.activeModeId;
    onConfigChange({ ...config, activeModeId, modes });
  }

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Modes" title="Runtime modes" subtitle="A mode is an ordered set of policies. Only the active mode runs; policies are evaluated top to bottom and the first to respond wins." />

      <Card title="Modes" actions={<IconButton className="primary" icon="plus" label="New mode" onClick={addMode} />}>
        <div className="list">
          {config.modes.map((mode) => {
            const isActive = mode.id === config.activeModeId;
            const steps = mode.policyIds.reduce((c, id) => c + (policyById(config, id)?.steps.length ?? 0), 0);
            return (
              <div className={isActive ? "list-row active" : "list-row"} key={mode.id}>
                <button className="list-main" type="button" onClick={() => onConfigChange({ ...config, activeModeId: mode.id })}>
                  <span className="list-title">{mode.name}{isActive && <span className="badge">active</span>}</span>
                  <small>{mode.description || "No description"}</small>
                </button>
                <span className="list-meta">{count(mode.policyIds.length, "policy", "policies")} · {count(steps, "step")}</span>
                <IconButton className="small" icon="edit" label={`Edit ${mode.name}`} onClick={() => setEditId(mode.id)} />
                <IconButton className="danger small" icon="trash" label={`Delete ${mode.name}`} onClick={() => deleteMode(mode.id)} disabled={config.modes.length <= 1} />
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
          <ModeEditor config={config} mode={editMode} onConfigChange={onConfigChange} />
        </Modal>
      )}
    </div>
  );
}

function ModeEditor({ config, mode, onConfigChange }: { config: AppConfig; mode: ModeConfig; onConfigChange: (c: AppConfig) => void }) {
  const updateMode = (next: ModeConfig) => onConfigChange({ ...config, modes: config.modes.map((m) => (m.id === next.id ? next : m)) });
  const setIds = (policyIds: string[]) => updateMode({ ...mode, policyIds });
  const available = config.policies.filter((policy) => !mode.policyIds.includes(policy.id));

  function move(index: number, dir: -1 | 1) {
    const t = index + dir;
    if (t < 0 || t >= mode.policyIds.length) return;
    const arr = [...mode.policyIds];
    [arr[index], arr[t]] = [arr[t], arr[index]];
    setIds(arr);
  }

  function addExisting(id: string) {
    if (id) setIds([...mode.policyIds, id]);
  }

  return (
    <>
      <Field label="Name">
        <input autoFocus onFocus={(e) => e.currentTarget.select()} value={mode.name} onChange={(e) => updateMode({ ...mode, name: e.target.value })} />
      </Field>
      <Field label="Description">
        <input value={mode.description ?? ""} onChange={(e) => updateMode({ ...mode, description: e.target.value })} />
      </Field>

      <div className="mode-policies">
        <h3>Policies in this mode <small className="muted">(run top to bottom)</small></h3>
        <div className="list">
          {mode.policyIds.map((id, index) => {
            const policy = policyById(config, id);
            return (
              <div className="list-row" key={id}>
                <span className="list-main"><span className="list-title">{index + 1}. {policy?.name ?? id}</span>{!policy && <small className="danger-text">missing policy</small>}</span>
                <button className="small" type="button" onClick={() => move(index, -1)} disabled={index === 0} title="Move up">↑</button>
                <button className="small" type="button" onClick={() => move(index, 1)} disabled={index === mode.policyIds.length - 1} title="Move down">↓</button>
                <IconButton className="danger small" icon="trash" label="Remove policy from mode" onClick={() => setIds(mode.policyIds.filter((x) => x !== id))} />
              </div>
            );
          })}
          {mode.policyIds.length === 0 && <p className="muted">No policies yet. Add one below.</p>}
        </div>
        <select className="policy-add-select" aria-label="Add an existing policy" value="" onChange={(e) => addExisting(e.target.value)} disabled={available.length === 0}>
          <option value="" disabled hidden>{available.length ? "Add an existing policy…" : "All policies are already added"}</option>
          {available.map((policy) => <option key={policy.id} value={policy.id}>{policy.name}</option>)}
        </select>
        <p className="inline-note">Policies are shared across modes. Create and edit them on the Policy page. Changes here save automatically.</p>
      </div>
    </>
  );
}
