import { useState } from "react";
import type { AppConfig, ModeConfig, PolicyConfig } from "../models/config/types";
import type { ModeRuntimeStatus } from "../services/modes/modeRepository";
import { createMode } from "../services/config/configEditing";
import { ModeTransitionNotice } from "../components/ModeTransitionNotice";
import { Select } from "../components/Select";
import { Card, CheckRow, Field, Icon, IconButton, Modal, PageHeader, count } from "../components/ui";

interface Props {
  config: AppConfig;
  runtime: ModeRuntimeStatus;
  onConfigChange: (config: AppConfig) => void;
  onSelectMode: (modeId: string) => void;
  onCancelPending: () => void;
}

function policyById(config: AppConfig, id: string): PolicyConfig | undefined {
  return config.policies.find((policy) => policy.id === id);
}

export function ModesView({ config, runtime, onConfigChange, onSelectMode, onCancelPending }: Props) {
  const [editId, setEditId] = useState<string | null>(null);
  const editMode = config.modes.find((mode) => mode.id === editId) ?? null;

  function addMode() {
    const mode = createMode("New mode", config.modes.map((item) => item.id));
    onConfigChange({ ...config, modes: [...config.modes, mode] });
    setEditId(mode.id);
  }

  function deleteMode(id: string) {
    if (config.modes.length <= 1 || config.activeModeId === id || runtime.pending?.targetModeId === id) return;
    onConfigChange({ ...config, modes: config.modes.filter((mode) => mode.id !== id) });
  }

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Modes" title="Runtime modes" subtitle="A mode is an ordered set of policies. Select one manually, or give it a daily local-time schedule." />

      {runtime.pending && <ModeTransitionNotice pending={runtime.pending} modes={config.modes} onCancel={onCancelPending} />}

      <Card title="Modes" actions={<IconButton className="primary" icon="plus" label="New mode" onClick={addMode} />}>
        <div className="box-grid modes">
          {config.modes.map((mode) => {
            const isActive = mode.id === config.activeModeId;
            const isPending = mode.id === runtime.pending?.targetModeId;
            const steps = mode.policyIds.reduce((total, id) => total + (policyById(config, id)?.steps.length ?? 0), 0);
            const protectedMode = isActive || isPending;
            return (
              <div className={isActive ? "box-card active" : "box-card"} key={mode.id}>
                <button className="box-card-main" type="button" onClick={() => onSelectMode(mode.id)} aria-label={`Activate ${mode.name}`}>
                  <span className="box-card-icon"><Icon name="layers" /></span>
                  <span className="box-card-body">
                    <span className="box-card-title">
                      <span className="box-card-name">{mode.name}</span>
                      {isActive && <span className="badge">active</span>}
                      {isPending && <span className="badge muted-badge">waiting</span>}
                    </span>
                    <span className="box-card-sub">{mode.description || "No description"}</span>
                    {(mode.createFriction || mode.defaultTime) && (
                      <span className="mode-tags">
                        {mode.createFriction && <span className="mode-tag">{durationLabel(runtime.frictionSeconds)} friction</span>}
                        {mode.defaultTime && <span className="mode-tag">Daily {mode.defaultTime.start}–{mode.defaultTime.end}</span>}
                      </span>
                    )}
                  </span>
                  <span className="box-card-meta">{count(mode.policyIds.length, "policy", "policies")} · {count(steps, "step")}</span>
                </button>
                <div className="box-card-actions">
                  <IconButton className="small" icon="edit" label={`Edit ${mode.name}`} onClick={() => setEditId(mode.id)} />
                  <IconButton className="danger small" icon="trash" label={`Delete ${mode.name}`} onClick={() => deleteMode(mode.id)} disabled={config.modes.length <= 1 || protectedMode} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {editMode && (
        <Modal title={`Edit “${editMode.name}”`} onClose={() => setEditId(null)} footer={<button className="primary" type="button" onClick={() => setEditId(null)}>Done</button>}>
          <ModeEditor config={config} mode={editMode} frictionSeconds={runtime.frictionSeconds} onConfigChange={onConfigChange} />
        </Modal>
      )}
    </div>
  );
}

function ModeEditor({ config, mode, frictionSeconds, onConfigChange }: { config: AppConfig; mode: ModeConfig; frictionSeconds: number; onConfigChange: (config: AppConfig) => void }) {
  const updateMode = (next: ModeConfig) => onConfigChange({ ...config, modes: config.modes.map((item) => (item.id === next.id ? next : item)) });
  const setIds = (policyIds: string[]) => updateMode({ ...mode, policyIds });
  const available = config.policies.filter((policy) => !mode.policyIds.includes(policy.id));

  function setDefaultTime(enabled: boolean) {
    updateMode({ ...mode, defaultTime: enabled ? { start: "09:00", end: "17:00" } : null });
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= mode.policyIds.length) return;
    const policyIds = [...mode.policyIds];
    [policyIds[index], policyIds[target]] = [policyIds[target], policyIds[index]];
    setIds(policyIds);
  }

  return (
    <>
      <Field label="Name"><input autoFocus onFocus={(event) => event.currentTarget.select()} value={mode.name} onChange={(event) => updateMode({ ...mode, name: event.target.value })} /></Field>
      <Field label="Description"><input value={mode.description ?? ""} onChange={(event) => updateMode({ ...mode, description: event.target.value })} /></Field>

      <div className="mode-behavior">
        <h3>Automatic behavior</h3>
        <CheckRow checked={mode.createFriction ?? false} onChange={(createFriction) => updateMode({ ...mode, createFriction })} label="Create friction when leaving" hint={`Manual switches from this mode wait ${durationLabel(frictionSeconds)}. Scheduled switches are immediate.`} />
        <CheckRow checked={Boolean(mode.defaultTime)} onChange={setDefaultTime} label="Select at a default time" hint="Activate this mode once per day when its local-time interval begins." />
        {mode.defaultTime && (
          <div className="mode-time-fields">
            <Field label="Start time"><input type="time" value={mode.defaultTime.start} onChange={(event) => updateMode({ ...mode, defaultTime: { ...mode.defaultTime!, start: event.target.value } })} /></Field>
            <Field label="End time"><input type="time" value={mode.defaultTime.end} onChange={(event) => updateMode({ ...mode, defaultTime: { ...mode.defaultTime!, end: event.target.value } })} /></Field>
          </div>
        )}
        {mode.defaultTime && <p className="inline-note">Runs daily in local time. An end earlier than the start creates an overnight interval. Default times across modes cannot overlap.</p>}
      </div>

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
                <IconButton className="danger small" icon="trash" label="Remove policy from mode" onClick={() => setIds(mode.policyIds.filter((item) => item !== id))} />
              </div>
            );
          })}
          {mode.policyIds.length === 0 && <p className="muted">No policies yet. Add one below.</p>}
        </div>
        <Select className="policy-add-select" ariaLabel="Add an existing policy" value="" placeholder={available.length ? "Add an existing policy…" : "All policies are already added"} options={available.map((policy) => ({ value: policy.id, label: policy.name }))} onChange={(id) => id && setIds([...mode.policyIds, id])} disabled={available.length === 0} />
        <p className="inline-note">Policies are shared across modes. Create and edit them on the Policy page. Changes here save automatically.</p>
      </div>
    </>
  );
}

function durationLabel(seconds: number): string {
  if (seconds % 60 === 0) return `${seconds / 60} min`;
  return `${seconds} sec`;
}
