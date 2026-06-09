import { useEffect, useState } from "react";
import { GraphEditor, paramsToText } from "../components/GraphEditor";
import type { AppConfig, ModeConfig, PolicyConfig, PolicyEdge, PolicyStepKind, StepParams } from "../models/config/types";
import { createPolicy, slug } from "../services/config/configEditing";
import { addStep, updateEdgeOutput, updateStepParams } from "../services/policy/policyOperations";

interface Props {
  config: AppConfig;
  onConfigChange: (config: AppConfig) => void;
}

export function PolicyView({ config, onConfigChange }: Props) {
  const activeMode = config.modes.find((mode) => mode.id === config.activeModeId) ?? config.modes[0];
  const [selectedPolicyId, setSelectedPolicyId] = useState(activeMode?.policies[0]?.id ?? "");
  const [newPolicyName, setNewPolicyName] = useState("");
  const activePolicy = activeMode?.policies.find((policy) => policy.id === selectedPolicyId) ?? activeMode?.policies[0];

  useEffect(() => {
    if (!activeMode) return;
    if (!activeMode.policies.some((policy) => policy.id === selectedPolicyId)) {
      setSelectedPolicyId(activeMode.policies[0]?.id ?? "");
    }
  }, [activeMode, selectedPolicyId]);

  function updateMode(nextMode: ModeConfig) {
    onConfigChange({ ...config, modes: config.modes.map((mode) => (mode.id === nextMode.id ? nextMode : mode)) });
  }

  function updatePolicy(nextPolicy: PolicyConfig) {
    if (!activeMode) return;
    updateMode({ ...activeMode, policies: activeMode.policies.map((policy) => (policy.id === nextPolicy.id ? nextPolicy : policy)) });
  }

  function addPolicy() {
    if (!activeMode) return;
    const name = newPolicyName.trim();
    if (!name) return;
    const policy = createPolicy(slug(name), name, activeMode.policies.map((item) => item.id));
    updateMode({ ...activeMode, policies: [...activeMode.policies, policy] });
    setSelectedPolicyId(policy.id);
    setNewPolicyName("");
  }

  function deletePolicy(id: string) {
    if (!activeMode) return;
    const policies = activeMode.policies.filter((policy) => policy.id !== id);
    updateMode({ ...activeMode, policies });
    setSelectedPolicyId(policies[0]?.id ?? "");
  }

  function movePolicy(id: string, direction: -1 | 1) {
    if (!activeMode) return;
    const index = activeMode.policies.findIndex((policy) => policy.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= activeMode.policies.length) return;
    const policies = [...activeMode.policies];
    [policies[index], policies[target]] = [policies[target], policies[index]];
    updateMode({ ...activeMode, policies });
  }

  function handleAddStep(kind: PolicyStepKind, type: string) {
    if (activePolicy) updatePolicy(addStep(activePolicy, kind, type));
  }

  function handleDeleteStep(stepId: string) {
    if (!activePolicy) return;
    const step = activePolicy.steps.find((item) => item.id === stepId);
    if (step?.kind === "node" && step.type === "start") return;
    updatePolicy({
      ...activePolicy,
      steps: activePolicy.steps.filter((item) => item.id !== stepId),
      edges: activePolicy.edges.filter((edge) => edge.from !== stepId && edge.to !== stepId),
    });
  }

  if (!activeMode) {
    return <EmptyState title="No modes" message="Create a mode before editing policies." />;
  }

  return (
    <div className="page-stack policy-page">
      <section className="page-title">
        <p className="eyebrow">Policy</p>
        <h1>{activeMode.name}</h1>
      </section>

      <section className="terminal-card" aria-labelledby="policy-list-heading">
        <div className="section-head">
          <h2 id="policy-list-heading">Ordered policies</h2>
          <div className="actions compact">
            <input aria-label="New policy name" placeholder="New policy" value={newPolicyName} onChange={(e) => setNewPolicyName(e.target.value)} />
            <button type="button" onClick={addPolicy}>create</button>
          </div>
        </div>
        <div className="policy-strip">
          {activeMode.policies.map((policy, index) => (
            <article className={policy.id === activePolicy?.id ? "policy-pill active" : "policy-pill"} key={policy.id}>
              <button className="row-main" type="button" onClick={() => setSelectedPolicyId(policy.id)}>
                <strong>{index + 1}. {policy.name}</strong>
                <small>{policy.steps.length} steps · {policy.edges.length} routes</small>
              </button>
              <button className="small" type="button" onClick={() => movePolicy(policy.id, -1)} disabled={index === 0}>up</button>
              <button className="small" type="button" onClick={() => movePolicy(policy.id, 1)} disabled={index === activeMode.policies.length - 1}>down</button>
              <button className="danger small" type="button" onClick={() => deletePolicy(policy.id)}>delete</button>
            </article>
          ))}
        </div>
      </section>

      {!activePolicy ? (
        <EmptyState title="No policy selected" message="Create a policy to open the canvas." />
      ) : (
        <>
          <section className="terminal-card" aria-labelledby="policy-edit-heading">
            <h2 id="policy-edit-heading">Edit: {activePolicy.name}</h2>
            <div className="form-grid">
              <label className="field">
                <span>Policy name</span>
                <input value={activePolicy.name} onChange={(e) => updatePolicy({ ...activePolicy, name: e.target.value })} />
              </label>
              <label className="field">
                <span>Policy id</span>
                <input value={activePolicy.id} readOnly />
              </label>
            </div>
          </section>
          <GraphEditor policy={activePolicy} customNodes={config.customNodes} onPolicyChange={updatePolicy} onAddStep={handleAddStep} />
          <PolicyInspector
            policy={activePolicy}
            onDeleteStep={handleDeleteStep}
            onEdgeChange={(index, output) => updatePolicy(updateEdgeOutput(activePolicy, index, output))}
            onParamsChange={(stepId, params) => updatePolicy(updateStepParams(activePolicy, stepId, params))}
          />
        </>
      )}
    </div>
  );
}

function PolicyInspector({ policy, onDeleteStep, onEdgeChange, onParamsChange }: {
  policy: PolicyConfig;
  onDeleteStep: (stepId: string) => void;
  onEdgeChange: (index: number, output: string) => void;
  onParamsChange: (stepId: string, params: StepParams) => void;
}) {
  return (
    <section className="inspector-grid">
      <div className="terminal-card">
        <h2>Steps</h2>
        <div className="block-list">
          {policy.steps.map((step) => (
            <div className="block-row" key={step.id}>
              <div><strong>{step.id}</strong><span>{step.kind}:{step.type}</span></div>
              <button className="danger small" type="button" onClick={() => onDeleteStep(step.id)} disabled={step.kind === "node" && step.type === "start"}>delete</button>
            </div>
          ))}
        </div>
      </div>
      <div className="terminal-card">
        <h2>Routes</h2>
        {policy.edges.map((edge, index) => (
          <label className="field compact-field" key={edgeKey(edge, index)}>
            <span>{edge.from} → {edge.to}</span>
            <input value={edge.output} onChange={(event) => onEdgeChange(index, event.target.value)} />
          </label>
        ))}
      </div>
      <div className="terminal-card wide-card">
        <h2>Step params</h2>
        {policy.steps.map((step) => (
          <label className="field" key={step.id}>
            <span>{step.id}</span>
            <textarea className="code-input small-code" defaultValue={paramsToText(step.params)} onBlur={(event) => handleParamsBlur(step.id, event.currentTarget.value, onParamsChange)} />
          </label>
        ))}
      </div>
    </section>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return <section className="terminal-card"><h2>{title}</h2><p className="muted">{message}</p></section>;
}

function handleParamsBlur(stepId: string, value: string, onChange: (stepId: string, params: StepParams) => void) {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("Step params must be a JSON object");
    onChange(stepId, parsed as StepParams);
  } catch (error) {
    window.alert(error instanceof Error ? error.message : String(error));
  }
}

function edgeKey(edge: PolicyEdge, index: number): string {
  return `${edge.from}-${edge.output}-${edge.to}-${index}`;
}
