import { useState } from "react";
import { GraphEditor, paramsToText } from "../components/GraphEditor";
import type { AppConfig, ModeConfig, PolicyConfig, PolicyEdge, PolicyStepKind, StepParams } from "../models/config/types";
import { addStep, updateEdgeOutput, updateStepParams } from "../services/policy/policyOperations";

interface Props {
  config: AppConfig;
  onConfigChange: (config: AppConfig) => void;
}

export function PoliciesView({ config, onConfigChange }: Props) {
  const activeMode = config.modes.find((mode) => mode.id === config.activeModeId) ?? config.modes[0];
  const [newModeName, setNewModeName] = useState("");
  const [newPolicyName, setNewPolicyName] = useState("");
  const [selectedPolicyId, setSelectedPolicyId] = useState(activeMode.policies[0]?.id ?? "");
  const activePolicy = activeMode.policies.find((policy) => policy.id === selectedPolicyId) ?? activeMode.policies[0] ?? createPolicy("empty-policy", "Empty policy");

  function updateMode(nextMode: ModeConfig) {
    onConfigChange({ ...config, modes: config.modes.map((mode) => (mode.id === nextMode.id ? nextMode : mode)) });
  }

  function updatePolicy(nextPolicy: PolicyConfig) {
    updateMode({ ...activeMode, policies: activeMode.policies.map((policy) => (policy.id === nextPolicy.id ? nextPolicy : policy)) });
  }

  function handleAddStep(kind: PolicyStepKind, type: string) {
    updatePolicy(addStep(activePolicy, kind, type));
  }

  function handleSelectMode(id: string) {
    const mode = config.modes.find((item) => item.id === id);
    setSelectedPolicyId(mode?.policies[0]?.id ?? "");
    onConfigChange({ ...config, activeModeId: id });
  }

  function handleAddMode() {
    const name = newModeName.trim();
    if (!name) return;
    const mode = createMode(name);
    onConfigChange({ ...config, modes: [...config.modes, mode], activeModeId: mode.id });
    setSelectedPolicyId(mode.policies[0].id);
    setNewModeName("");
  }

  function handleDeleteMode(id: string) {
    if (config.modes.length <= 1) return;
    const modes = config.modes.filter((mode) => mode.id !== id);
    const activeModeId = config.activeModeId === id ? modes[0].id : config.activeModeId;
    onConfigChange({ ...config, modes, activeModeId });
    setSelectedPolicyId(modes[0].policies[0]?.id ?? "");
  }

  function handleAddPolicy() {
    const name = newPolicyName.trim();
    if (!name) return;
    const policy = createPolicy(slug(name), name);
    updateMode({ ...activeMode, policies: [...activeMode.policies, policy] });
    setSelectedPolicyId(policy.id);
    setNewPolicyName("");
  }

  function handleDeletePolicy(id: string) {
    if (activeMode.policies.length <= 1) return;
    const policies = activeMode.policies.filter((policy) => policy.id !== id);
    updateMode({ ...activeMode, policies });
    setSelectedPolicyId(policies[0].id);
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
                <small>{mode.policies.reduce((count, policy) => count + policy.steps.length, 0)} steps</small>
              </button>
              <button className="danger small" type="button" onClick={() => handleDeleteMode(mode.id)} disabled={config.modes.length <= 1}>
                [-]
              </button>
            </div>
          ))}
        </div>
        <div className="button-row">
          <input placeholder="New mode name" value={newModeName} onChange={(event) => setNewModeName(event.target.value)} />
          <button type="button" onClick={handleAddMode}>[+] Add mode</button>
        </div>
      </section>

      <section className="panel" aria-labelledby="policies-heading">
        <h2 id="policies-heading">Ordered policies</h2>
        <div className="mode-list">
          {activeMode.policies.map((policy) => (
            <div key={policy.id} className={policy.id === activePolicy.id ? "mode-card active" : "mode-card"}>
              <button type="button" onClick={() => setSelectedPolicyId(policy.id)}>
                <strong>{policy.name}</strong>
                <small>{policy.steps.length} steps</small>
              </button>
              <button className="danger small" type="button" onClick={() => handleDeletePolicy(policy.id)} disabled={activeMode.policies.length <= 1}>
                [-]
              </button>
            </div>
          ))}
        </div>
        <div className="button-row">
          <input placeholder="New policy name" value={newPolicyName} onChange={(event) => setNewPolicyName(event.target.value)} />
          <button type="button" onClick={handleAddPolicy}>[+] Add policy</button>
        </div>
      </section>

      <GraphEditor policy={activePolicy} customNodes={config.customNodes} onPolicyChange={updatePolicy} onAddStep={handleAddStep} />
      <EdgeOutputs policy={activePolicy} onChange={(index, output) => updatePolicy(updateEdgeOutput(activePolicy, index, output))} />
      <StepParams policy={activePolicy} onChange={(stepId, params) => updatePolicy(updateStepParams(activePolicy, stepId, params))} />
    </div>
  );
}

function EdgeOutputs({ policy, onChange }: { policy: PolicyConfig; onChange: (index: number, output: string) => void }) {
  return (
    <section className="panel" aria-labelledby="edges-heading">
      <h2 id="edges-heading">Edge outputs</h2>
      {policy.edges.map((edge, index) => (
        <label className="field" key={edgeKey(edge, index)}>
          <span>{edge.from} → {edge.to}</span>
          <input value={edge.output} onChange={(event) => onChange(index, event.target.value)} />
        </label>
      ))}
    </section>
  );
}

function StepParams({ policy, onChange }: { policy: PolicyConfig; onChange: (stepId: string, params: StepParams) => void }) {
  return (
    <section className="panel" aria-labelledby="params-heading">
      <h2 id="params-heading">Step params</h2>
      {policy.steps.map((step) => (
        <label className="field" key={step.id}>
          <span>{step.id}</span>
          <textarea
            className="code-input"
            defaultValue={paramsToText(step.params)}
            onBlur={(event) => handleParamsBlur(step.id, event.currentTarget.value, onChange)}
          />
        </label>
      ))}
    </section>
  );
}

function handleParamsBlur(stepId: string, value: string, onChange: (stepId: string, params: StepParams) => void) {
  try {
    onChange(stepId, parseParams(value));
  } catch (error) {
    window.alert(error instanceof Error ? error.message : String(error));
  }
}

function parseParams(value: string): StepParams {
  const parsed = JSON.parse(value);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("Step params must be a JSON object");
  }
  return parsed as StepParams;
}

function createMode(name: string): ModeConfig {
  const id = slug(name);
  return { id, name, policies: [createPolicy(`${id}-policy`, `${name} policy`)] };
}

function createPolicy(id: string, name: string): PolicyConfig {
  return {
    id,
    name,
    steps: [
      { id: `${id}-start`, kind: "node", type: "start", position: { x: 80, y: 200 } },
      { id: `${id}-end`, kind: "node", type: "end", position: { x: 460, y: 200 } },
    ],
    edges: [{ from: `${id}-start`, output: "next", to: `${id}-end` }],
  };
}

function slug(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}

function edgeKey(edge: PolicyEdge, index: number): string {
  return `${edge.from}-${edge.output}-${edge.to}-${index}`;
}
