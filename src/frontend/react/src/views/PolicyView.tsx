import { useEffect, useState } from "react";
import { GraphEditor } from "../components/GraphEditor";
import { NodeLibrary } from "../components/NodeLibrary";
import { StepModal } from "../components/StepModal";
import { Modal } from "../components/Modal";
import { PageHeader, count } from "../components/ui";
import type { AppConfig, ModeConfig, PolicyConfig, PolicyStepKind } from "../models/config/types";
import { createPolicy, slug } from "../services/config/configEditing";
import { addStep, updateStepParams } from "../services/policy/policyOperations";

interface Props {
  config: AppConfig;
  onConfigChange: (config: AppConfig) => void;
  onReadNode: (path: string) => Promise<string>;
}

export function PolicyView({ config, onConfigChange, onReadNode }: Props) {
  const activeMode = config.modes.find((m) => m.id === config.activeModeId) ?? config.modes[0];
  const [selectedPolicyId, setSelectedPolicyId] = useState(activeMode?.policies[0]?.id ?? "");
  const [openStepId, setOpenStepId] = useState<string | null>(null);
  const [showNewPolicy, setShowNewPolicy] = useState(false);
  const [newPolicyName, setNewPolicyName] = useState("");
  const activePolicy = activeMode?.policies.find((p) => p.id === selectedPolicyId) ?? activeMode?.policies[0];
  const openStep = activePolicy?.steps.find((s) => s.id === openStepId) ?? null;

  useEffect(() => {
    if (!activeMode) return;
    if (!activeMode.policies.some((p) => p.id === selectedPolicyId)) setSelectedPolicyId(activeMode.policies[0]?.id ?? "");
  }, [activeMode, selectedPolicyId]);

  function updateMode(next: ModeConfig) { onConfigChange({ ...config, modes: config.modes.map((m) => (m.id === next.id ? next : m)) }); }
  function updatePolicy(next: PolicyConfig) { if (activeMode) updateMode({ ...activeMode, policies: activeMode.policies.map((p) => (p.id === next.id ? next : p)) }); }
  function selectPolicy(id: string) { setSelectedPolicyId(id); setOpenStepId(null); }

  function addPolicy() {
    if (!activeMode || !newPolicyName.trim()) return;
    const p = createPolicy(slug(newPolicyName), newPolicyName.trim(), activeMode.policies.map((x) => x.id));
    updateMode({ ...activeMode, policies: [...activeMode.policies, p] });
    selectPolicy(p.id);
    setNewPolicyName("");
    setShowNewPolicy(false);
  }

  function deletePolicy(id: string) {
    if (!activeMode) return;
    const policies = activeMode.policies.filter((p) => p.id !== id);
    updateMode({ ...activeMode, policies });
    selectPolicy(policies[0]?.id ?? "");
  }

  function movePolicy(dir: -1 | 1) {
    if (!activeMode || !activePolicy) return;
    const i = activeMode.policies.findIndex((p) => p.id === activePolicy.id);
    const t = i + dir;
    if (i < 0 || t < 0 || t >= activeMode.policies.length) return;
    const arr = [...activeMode.policies];
    [arr[i], arr[t]] = [arr[t], arr[i]];
    updateMode({ ...activeMode, policies: arr });
  }

  function handleAddStep(kind: PolicyStepKind, type: string) {
    if (!activePolicy) return;
    const p = addStep(activePolicy, kind, type);
    updatePolicy(p);
    setOpenStepId(p.steps[p.steps.length - 1].id);
  }

  function handleDeleteStep(stepId: string) {
    if (!activePolicy) return;
    const step = activePolicy.steps.find((s) => s.id === stepId);
    if (step?.kind === "node" && step.type === "start") return;
    updatePolicy({
      ...activePolicy,
      steps: activePolicy.steps.filter((s) => s.id !== stepId),
      edges: activePolicy.edges.filter((e) => e.from !== stepId && e.to !== stepId),
    });
    if (openStepId === stepId) setOpenStepId(null);
  }

  if (!activeMode) return <PageHeader eyebrow="Policy" title="No modes" subtitle="Create a mode first." />;

  const index = activeMode.policies.findIndex((p) => p.id === activePolicy?.id);

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Policy" title={activeMode.name} subtitle="Policies run top to bottom. The first to act on a request wins." />

      <div className="policy-box">
        <div className="policy-bar">
          <div className="policy-bar-left">
            <select aria-label="Select policy" value={activePolicy?.id ?? ""} onChange={(e) => selectPolicy(e.target.value)}>
              {activeMode.policies.map((p, i) => <option key={p.id} value={p.id}>{i + 1}. {p.name}</option>)}
            </select>
            {activePolicy && <span className="muted">{count(activePolicy.steps.length, "step")} · {count(activePolicy.edges.length, "route")}</span>}
          </div>
          <div className="actions">
            <button className="small" type="button" onClick={() => movePolicy(-1)} disabled={index <= 0} title="Move earlier">↑</button>
            <button className="small" type="button" onClick={() => movePolicy(1)} disabled={index < 0 || index >= activeMode.policies.length - 1} title="Move later">↓</button>
            <button className="small danger" type="button" onClick={() => activePolicy && deletePolicy(activePolicy.id)} disabled={!activePolicy}>Delete</button>
            <button className="small" type="button" onClick={() => setShowNewPolicy(true)}>New policy</button>
          </div>
        </div>

        {activePolicy ? (
          <div className="policy-split">
            <div className="policy-library">
              <NodeLibrary
                customNodes={config.customNodes}
                hasStart={activePolicy.steps.some((s) => s.kind === "node" && s.type === "start")}
                onAddStep={handleAddStep}
              />
            </div>
            <div className="policy-canvas">
              <GraphEditor
                policy={activePolicy}
                openStepId={openStepId}
                onPolicyChange={updatePolicy}
                onOpenStep={setOpenStepId}
                onDeleteStep={handleDeleteStep}
              />
            </div>
          </div>
        ) : (
          <p className="muted policy-empty">No policies yet. Use “New policy” to create one.</p>
        )}
      </div>

      {activePolicy && openStep && (
        <StepModal
          policy={activePolicy}
          step={openStep}
          customNodes={config.customNodes}
          onParamsChange={(id, params) => updatePolicy(updateStepParams(activePolicy, id, params))}
          onReadNode={onReadNode}
          onClose={() => setOpenStepId(null)}
        />
      )}

      {showNewPolicy && (
        <Modal
          title="New policy"
          onClose={() => setShowNewPolicy(false)}
          footer={<><button type="button" onClick={() => setShowNewPolicy(false)}>Cancel</button><button className="primary" type="button" onClick={addPolicy} disabled={!newPolicyName.trim()}>Create policy</button></>}
        >
          <label className="field">
            <span className="field-label">Policy name</span>
            <input autoFocus value={newPolicyName} onChange={(e) => setNewPolicyName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPolicy()} placeholder="Block social media" />
          </label>
        </Modal>
      )}
    </div>
  );
}
