import { useEffect, useState } from "react";
import { GraphEditor } from "../components/GraphEditor";
import type { AppConfig, ModeConfig, PolicyConfig, PolicyStep, PolicyStepKind, StepParams } from "../models/config/types";
import { createPolicy, slug } from "../services/config/configEditing";
import { addStep, updateEdgeOutput, updateStepParams } from "../services/policy/policyOperations";

interface Props {
  config: AppConfig;
  onConfigChange: (config: AppConfig) => void;
}

export function PolicyView({ config, onConfigChange }: Props) {
  const activeMode = config.modes.find((m) => m.id === config.activeModeId) ?? config.modes[0];
  const [selectedPolicyId, setSelectedPolicyId] = useState(activeMode?.policies[0]?.id ?? "");
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [newPolicyName, setNewPolicyName] = useState("");
  const activePolicy = activeMode?.policies.find((p) => p.id === selectedPolicyId) ?? activeMode?.policies[0];

  useEffect(() => {
    if (!activeMode) return;
    if (!activeMode.policies.some((p) => p.id === selectedPolicyId)) setSelectedPolicyId(activeMode.policies[0]?.id ?? "");
  }, [activeMode, selectedPolicyId]);

  function updateMode(next: ModeConfig) { onConfigChange({ ...config, modes: config.modes.map((m) => (m.id === next.id ? next : m)) }); }
  function updatePolicy(next: PolicyConfig) { if (activeMode) updateMode({ ...activeMode, policies: activeMode.policies.map((p) => (p.id === next.id ? next : p)) }); }

  function addPolicy() {
    if (!activeMode || !newPolicyName.trim()) return;
    const p = createPolicy(slug(newPolicyName), newPolicyName.trim(), activeMode.policies.map((x) => x.id));
    updateMode({ ...activeMode, policies: [...activeMode.policies, p] });
    setSelectedPolicyId(p.id);
    setNewPolicyName("");
  }

  function deletePolicy(id: string) {
    if (!activeMode) return;
    const policies = activeMode.policies.filter((p) => p.id !== id);
    updateMode({ ...activeMode, policies });
    setSelectedPolicyId(policies[0]?.id ?? "");
  }

  function movePolicy(id: string, dir: -1 | 1) {
    if (!activeMode) return;
    const i = activeMode.policies.findIndex((p) => p.id === id);
    const t = i + dir;
    if (i < 0 || t < 0 || t >= activeMode.policies.length) return;
    const arr = [...activeMode.policies];
    [arr[i], arr[t]] = [arr[t], arr[i]];
    updateMode({ ...activeMode, policies: arr });
  }

  function handleAddStep(kind: PolicyStepKind, type: string) {
    if (activePolicy) { const p = addStep(activePolicy, kind, type); updatePolicy(p); setSelectedStepId(p.steps[p.steps.length - 1].id); }
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
    if (selectedStepId === stepId) setSelectedStepId(null);
  }

  if (!activeMode) return <Empty title="No modes" msg="Create a mode first." />;

  return (
    <div className="page-stack policy-page">
      <section className="page-title">
        <p className="eyebrow">Policy</p>
        <h1>{activeMode.name}</h1>
      </section>

      <section className="terminal-card" aria-labelledby="pol-list">
        <div className="section-head">
          <h2 id="pol-list">Ordered policies</h2>
          <div className="actions compact">
            <input aria-label="New policy name" placeholder="New policy" value={newPolicyName} onChange={(e) => setNewPolicyName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPolicy()} />
            <button type="button" onClick={addPolicy}>create</button>
          </div>
        </div>
        <div className="policy-strip">
          {activeMode.policies.map((p, i) => (
            <article className={p.id === activePolicy?.id ? "policy-pill active" : "policy-pill"} key={p.id}>
              <button className="row-main" type="button" onClick={() => { setSelectedPolicyId(p.id); setSelectedStepId(null); }}>
                <strong>{i + 1}. {p.name}</strong>
                <small>{p.steps.length} steps · {p.edges.length} routes</small>
              </button>
              <button className="small" type="button" onClick={() => movePolicy(p.id, -1)} disabled={i === 0}>↑</button>
              <button className="small" type="button" onClick={() => movePolicy(p.id, 1)} disabled={i === activeMode.policies.length - 1}>↓</button>
              <button className="danger small" type="button" onClick={() => deletePolicy(p.id)}>del</button>
            </article>
          ))}
        </div>
      </section>

      {activePolicy && (
        <>
          <GraphEditor
            policy={activePolicy}
            customNodes={config.customNodes}
            selectedStepId={selectedStepId}
            onPolicyChange={updatePolicy}
            onAddStep={handleAddStep}
            onSelectStep={setSelectedStepId}
            onDeleteStep={handleDeleteStep}
          />
          <StepInspector
            policy={activePolicy}
            selectedStepId={selectedStepId}
            onParamsChange={(id, params) => updatePolicy(updateStepParams(activePolicy, id, params))}
            onEdgeChange={(i, output) => updatePolicy(updateEdgeOutput(activePolicy, i, output))}
          />
        </>
      )}
    </div>
  );
}

/* --- Step Inspector: shows selected step's params + outgoing routes --- */

function StepInspector({ policy, selectedStepId, onParamsChange, onEdgeChange }: {
  policy: PolicyConfig;
  selectedStepId: string | null;
  onParamsChange: (stepId: string, params: StepParams) => void;
  onEdgeChange: (index: number, output: string) => void;
}) {
  const step = policy.steps.find((s) => s.id === selectedStepId);
  const outEdges = policy.edges.map((e, i) => ({ ...e, index: i })).filter((e) => e.from === selectedStepId);

  if (!step) {
    return (
      <section className="terminal-card">
        <p className="muted">Click a node in the graph to inspect its configuration.</p>
      </section>
    );
  }

  return (
    <section className="terminal-card" aria-labelledby="inspector-heading">
      <div className="section-head">
        <h2 id="inspector-heading">
          <span className={step.kind === "operator" ? "inspector-badge operator" : "inspector-badge node"}>{step.kind}</span>
          {step.id} <small className="muted">({step.type})</small>
        </h2>
      </div>

      {step.kind === "node" && step.type === "start" && <TriggerEditor step={step} onParamsChange={onParamsChange} />}
      {step.kind === "node" && step.type !== "start" && step.type !== "end" && <ParamsEditor step={step} onParamsChange={onParamsChange} />}
      {step.kind === "operator" && <OperatorEditor step={step} onParamsChange={onParamsChange} />}

      {outEdges.length > 0 && (
        <div className="inspector-routes">
          <h3>Outgoing routes</h3>
          {outEdges.map((e) => (
            <div className="route-row" key={e.index}>
              <input className="route-output" value={e.output} onChange={(ev) => onEdgeChange(e.index, ev.target.value)} />
              <span className="muted">→ {e.to}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* --- Specialized param editors --- */

function TriggerEditor({ step, onParamsChange }: { step: PolicyStep; onParamsChange: (id: string, p: StepParams) => void }) {
  const trigger = (step.params?.trigger as Record<string, unknown>) ?? {};
  const hostPatterns = (trigger.hostPatterns as string[]) ?? [];
  const pathPatterns = (trigger.pathPatterns as string[]) ?? [];

  function setTrigger(key: string, value: string[]) {
    const next = { ...trigger, [key]: value };
    if (value.length === 0) delete next[key];
    const params = Object.keys(next).length > 0 ? { ...step.params, trigger: next } : {};
    onParamsChange(step.id, params);
  }

  return (
    <div className="trigger-editor">
      <label className="field">
        <span>Host patterns <small className="muted">(one per line, suffix match)</small></span>
        <textarea className="code-input small-code" value={hostPatterns.join("\n")} onChange={(e) => setTrigger("hostPatterns", lines(e.target.value))} />
      </label>
      <label className="field">
        <span>Path patterns <small className="muted">(one per line, substring match in URL + referer)</small></span>
        <textarea className="code-input small-code" value={pathPatterns.join("\n")} onChange={(e) => setTrigger("pathPatterns", lines(e.target.value))} />
      </label>
      <p className="inline-note">If no trigger is set, the policy activates on all requests.</p>
    </div>
  );
}

function ParamsEditor({ step, onParamsChange }: { step: PolicyStep; onParamsChange: (id: string, p: StepParams) => void }) {
  const params = step.params ?? {};
  const entries = Object.entries(params);

  function setKey(key: string, value: string) {
    try { onParamsChange(step.id, { ...params, [key]: JSON.parse(value) }); } catch { onParamsChange(step.id, { ...params, [key]: value }); }
  }

  return (
    <div className="params-editor">
      {entries.length === 0 && <p className="muted">No parameters configured for this node.</p>}
      {entries.map(([key, value]) => (
        <div className="param-row" key={key}>
          <span className="param-key">{key}</span>
          <input className="param-value" value={typeof value === "string" ? value : JSON.stringify(value)} onChange={(e) => setKey(key, e.target.value)} />
        </div>
      ))}
    </div>
  );
}

function OperatorEditor({ step, onParamsChange }: { step: PolicyStep; onParamsChange: (id: string, p: StepParams) => void }) {
  const path = String(step.params?.path ?? "");
  return (
    <div className="params-editor">
      <label className="field">
        <span>Condition path <small className="muted">(dot-separated field in input data)</small></span>
        <input value={path} onChange={(e) => onParamsChange(step.id, { ...step.params, path: e.target.value })} />
      </label>
      <p className="inline-note">{step.type === "if" ? 'Outputs: "true" / "false"' : 'Outputs: the value at path, or "default"'}</p>
    </div>
  );
}

function Empty({ title, msg }: { title: string; msg: string }) {
  return <section className="terminal-card"><h2>{title}</h2><p className="muted">{msg}</p></section>;
}

function lines(text: string): string[] { return text.split("\n").map((s) => s.trim()).filter(Boolean); }
