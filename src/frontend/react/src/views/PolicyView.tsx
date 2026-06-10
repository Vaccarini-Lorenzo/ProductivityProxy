import { useEffect, useState } from "react";
import { GraphEditor } from "../components/GraphEditor";
import { NodeLibrary } from "../components/NodeLibrary";
import { StepModal } from "../components/StepModal";
import { Modal } from "../components/Modal";
import { PageHeader, IconButton, count } from "../components/ui";
import type { AppConfig, PolicyConfig, PolicyStepKind, StepParams, ValidationIssue } from "../models/config/types";
import { createPolicy, slug } from "../services/config/configEditing";
import { addStep, updateStepParams } from "../services/policy/policyOperations";

interface Props {
  config: AppConfig;
  savedConfig: AppConfig;
  issues: ValidationIssue[];
  onConfigChange: (config: AppConfig) => void;
  onReadNode: (path: string) => Promise<string>;
}

export function PolicyView({ config, savedConfig, issues, onConfigChange, onReadNode }: Props) {
  const [selectedPolicyId, setSelectedPolicyId] = useState(config.policies[0]?.id ?? "");
  const [openStepId, setOpenStepId] = useState<string | null>(null);
  const [showNewPolicy, setShowNewPolicy] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [newPolicyName, setNewPolicyName] = useState("");
  const activePolicy = config.policies.find((p) => p.id === selectedPolicyId) ?? config.policies[0];
  const openStep = activePolicy?.steps.find((s) => s.id === openStepId) ?? null;
  const usedIn = activePolicy ? config.modes.filter((m) => m.policyIds.includes(activePolicy.id)) : [];
  const policyIssues = activePolicy ? issues.filter((i) => i.policyId === activePolicy.id) : [];
  const invalidStepIds = new Set(policyIssues.flatMap((i) => i.stepIds));
  const savedPolicy = activePolicy ? savedConfig.policies.find((p) => p.id === activePolicy.id) : undefined;

  useEffect(() => {
    if (!config.policies.some((p) => p.id === selectedPolicyId)) setSelectedPolicyId(config.policies[0]?.id ?? "");
  }, [config.policies, selectedPolicyId]);

  function updatePolicy(next: PolicyConfig) {
    onConfigChange({ ...config, policies: config.policies.map((p) => (p.id === next.id ? next : p)) });
  }

  function selectPolicy(id: string) { setSelectedPolicyId(id); setOpenStepId(null); }

  function addPolicy() {
    if (!newPolicyName.trim()) return;
    const p = createPolicy(slug(newPolicyName), newPolicyName.trim(), config.policies.map((x) => x.id));
    onConfigChange({ ...config, policies: [...config.policies, p] });
    selectPolicy(p.id);
    setNewPolicyName("");
    setShowNewPolicy(false);
  }

  function deletePolicy(id: string) {
    const policies = config.policies.filter((p) => p.id !== id);
    const modes = config.modes.map((m) => ({ ...m, policyIds: m.policyIds.filter((pid) => pid !== id) }));
    onConfigChange({ ...config, policies, modes });
    selectPolicy(policies[0]?.id ?? "");
  }

  function resetPolicy() {
    if (!activePolicy) return;
    if (savedPolicy) {
      onConfigChange({ ...config, policies: config.policies.map((p) => (p.id === savedPolicy.id ? savedPolicy : p)) });
      setOpenStepId(null);
    } else {
      deletePolicy(activePolicy.id);
    }
    setShowReset(false);
  }

  function handleAddStep(kind: PolicyStepKind, type: string, params?: StepParams) {
    if (!activePolicy) return;
    updatePolicy(addStep(activePolicy, kind, type, params));
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

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Policy" title="Policies" subtitle="Edit policy graphs here. Policies are shared; add them to modes on the Modes page." />

      <div className="policy-box">
        <div className="policy-bar">
          <div className="policy-bar-row">
            <select className="policy-select" aria-label="Select policy" value={activePolicy?.id ?? ""} onChange={(e) => selectPolicy(e.target.value)} disabled={config.policies.length === 0}>
              {config.policies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="policy-bar-actions">
              {policyIssues.length > 0 && <IconButton className="danger" icon="refresh" label="Reset policy to last saved" onClick={() => setShowReset(true)} disabled={!activePolicy} />}
              <IconButton className="danger" icon="trash" label="Delete policy" onClick={() => activePolicy && deletePolicy(activePolicy.id)} disabled={!activePolicy} />
              <IconButton className="primary" icon="plus" label="New policy" onClick={() => setShowNewPolicy(true)} />
            </div>
          </div>
          {activePolicy && (
            <p className="policy-bar-meta">
              {count(activePolicy.steps.length, "step")} · {count(activePolicy.edges.length, "route")} · {usedIn.length > 0 ? `used in ${usedIn.map((m) => m.name).join(", ")}` : "not in any mode"}
            </p>
          )}
        </div>

        {activePolicy && policyIssues.length > 0 && (
          <div className="policy-issues" role="alert">
            <span className="policy-issues-badge">Broken · not saved</span>
            {policyIssues.map((issue, i) => (
              <div className="policy-issue" key={i}>
                <strong>{issue.message}</strong>
                {issue.hint && <span className="muted">{issue.hint}</span>}
              </div>
            ))}
          </div>
        )}

        {activePolicy ? (
          <div className="policy-split">
            <div className="policy-library">
              <NodeLibrary
                customNodes={config.customNodes}
                hasStart={activePolicy.steps.some((s) => s.kind === "node" && s.type === "start")}
                onAddStep={handleAddStep}
                onReadNode={onReadNode}
              />
            </div>
            <div className="policy-canvas">
              <GraphEditor
                policy={activePolicy}
                openStepId={openStepId}
                invalidStepIds={invalidStepIds}
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
          <p className="inline-note">New policies are added to the shared library. Add them to a mode on the Modes page to make them run.</p>
        </Modal>
      )}
      {showReset && activePolicy && (
        <Modal
          title={`Reset “${activePolicy.name}”`}
          wide={!!savedPolicy}
          onClose={() => setShowReset(false)}
          footer={<><button type="button" onClick={() => setShowReset(false)}>Cancel</button><button className="primary" type="button" onClick={resetPolicy}>{savedPolicy ? "Reset to last saved" : "Remove policy"}</button></>}
        >
          {savedPolicy ? (
            <>
              <p className="inline-note">This discards the current broken changes and restores the last saved version shown below.</p>
              <div className="reset-preview">
                <GraphEditor policy={savedPolicy} openStepId={null} readOnly onPolicyChange={() => undefined} onOpenStep={() => undefined} onDeleteStep={() => undefined} />
              </div>
            </>
          ) : (
            <p className="danger-text">This policy was never saved, so there is no valid version to restore. Reset will remove it.</p>
          )}
        </Modal>
      )}
    </div>
  );
}
