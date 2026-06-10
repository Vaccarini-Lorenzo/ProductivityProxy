import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { PythonCodeEditor } from "./PythonCodeEditor";
import { Field } from "./ui";
import { bundledNodeSource } from "../services/nodes/defaultNodeSources";
import type { CustomNodeConfig, PolicyConfig, PolicyStep, StepParams } from "../models/config/types";

interface Props {
  policy: PolicyConfig;
  step: PolicyStep;
  customNodes: CustomNodeConfig[];
  onParamsChange: (stepId: string, params: StepParams) => void;
  onReadNode: (path: string) => Promise<string>;
  onClose: () => void;
}

/** Step configuration popup. Operators edit their logic (autosave); nodes show read-only code + editable params. */
export function StepModal({ policy, step, customNodes, onParamsChange, onReadNode, onClose }: Props) {
  const isOperator = step.kind === "operator";
  const isStart = step.kind === "node" && step.type === "start";
  const isEnd = step.kind === "node" && step.type === "end";
  const customNode = customNodes.find((node) => node.id === step.type);
  const outEdges = policy.edges.filter((e) => e.from === step.id);
  const change = (params: StepParams) => onParamsChange(step.id, params);
  const badge = isOperator ? "operator" : "node";

  return (
    <Modal
      title={step.id}
      subtitle={<span className={`inspector-badge ${badge}`}>{step.kind} · {step.type}</span>}
      onClose={onClose}
      wide={isOperator || !!customNode}
    >
      {isOperator && <OperatorEditor step={step} onChange={change} />}
      {isStart && <TriggerEditor step={step} onChange={change} />}
      {isEnd && <p className="muted">The flow stops here. This node has no configuration.</p>}
      {customNode && <NodeView node={customNode} step={step} onChange={change} onReadNode={onReadNode} />}

      {outEdges.length > 0 && (
        <div className="inspector-routes">
          <h3>Outgoing routes</h3>
          {outEdges.map((e, i) => (
            <div className="route-row" key={i}>
              <span className="route-tag">{e.output}</span>
              <span className="muted">→ {e.to}</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function NodeView({ node, step, onChange, onReadNode }: { node: CustomNodeConfig; step: PolicyStep; onChange: (p: StepParams) => void; onReadNode: (path: string) => Promise<string> }) {
  const [code, setCode] = useState("Loading source…");

  useEffect(() => {
    let active = true;
    onReadNode(node.path)
      .then((source) => { if (active) setCode(source); })
      .catch(() => { if (active) setCode(bundledNodeSource(node.path) ?? "# Source unavailable in browser preview."); });
    return () => { active = false; };
  }, [node.path, onReadNode]);

  return (
    <div className="node-view">
      <div className="meta-grid">
        <div><dt>Name</dt><dd>{node.name}</dd></div>
        <div><dt>File</dt><dd>{node.path}</dd></div>
      </div>
      <ParamsEditor step={step} onChange={onChange} />
      <div className="code-readonly">
        <div className="code-readonly-head">Python source <span className="muted">read-only · edit in Nodes</span></div>
        <pre>{code}</pre>
      </div>
    </div>
  );
}

function TriggerEditor({ step, onChange }: { step: PolicyStep; onChange: (p: StepParams) => void }) {
  const trigger = (step.params?.trigger as Record<string, unknown>) ?? {};
  const hostPatterns = (trigger.hostPatterns as string[]) ?? [];
  const pathPatterns = (trigger.pathPatterns as string[]) ?? [];

  function setTrigger(key: string, value: string[]) {
    const next = { ...trigger, [key]: value };
    if (value.length === 0) delete next[key];
    onChange(Object.keys(next).length > 0 ? { ...step.params, trigger: next } : {});
  }

  return (
    <div className="inspector-form">
      <Field label="Host patterns" hint="One per line, suffix match">
        <textarea className="code-input small-code" value={hostPatterns.join("\n")} onChange={(e) => setTrigger("hostPatterns", lines(e.target.value))} />
      </Field>
      <Field label="Path patterns" hint="One per line, matched in URL + referer">
        <textarea className="code-input small-code" value={pathPatterns.join("\n")} onChange={(e) => setTrigger("pathPatterns", lines(e.target.value))} />
      </Field>
      <p className="inline-note">With no trigger, the policy runs on every request.</p>
    </div>
  );
}

function ParamsEditor({ step, onChange }: { step: PolicyStep; onChange: (p: StepParams) => void }) {
  const params = step.params ?? {};
  const entries = Object.entries(params);
  function setKey(key: string, value: string) {
    try { onChange({ ...params, [key]: JSON.parse(value) }); } catch { onChange({ ...params, [key]: value }); }
  }
  if (entries.length === 0) return <p className="muted">This node has no parameters.</p>;
  return (
    <div className="inspector-form">
      {entries.map(([key, value]) => (
        <Field key={key} label={key}>
          <input value={typeof value === "string" ? value : JSON.stringify(value)} onChange={(e) => setKey(key, e.target.value)} />
        </Field>
      ))}
    </div>
  );
}

function OperatorEditor({ step, onChange }: { step: PolicyStep; onChange: (p: StepParams) => void }) {
  const isIf = step.type === "if";
  const code = String(step.params?.code ?? "");
  const cases = (step.params?.cases as string[]) ?? [];
  return (
    <div className="inspector-form">
      <Field label="Condition" hint={isIf ? "Return True for the then port, False for else" : "Return a case label string"}>
        <div className="code-signature">{isIf ? "def if_condition(input) -> bool" : "def switch_condition(input) -> str"}</div>
        <PythonCodeEditor value={code} minHeight={130} onChange={(next) => onChange({ ...step.params, code: next })} />
      </Field>
      {!isIf && <SwitchCases cases={cases} onChange={(next) => onChange({ ...step.params, cases: next })} />}
      <p className="inline-note">Changes auto-save to disk.</p>
    </div>
  );
}

function SwitchCases({ cases, onChange }: { cases: string[]; onChange: (next: string[]) => void }) {
  return (
    <div className="switch-cases">
      <div className="switch-cases-head">
        <span>Cases <small className="muted">({cases.length})</small></span>
        <button type="button" className="small" onClick={() => cases.length < 7 && onChange([...cases, `case_${cases.length + 1}`])} disabled={cases.length >= 7}>Add case</button>
      </div>
      {cases.map((label, index) => (
        <div className="param-row" key={index}>
          <input className="param-value" value={label} onChange={(e) => onChange(cases.map((c, i) => (i === index ? e.target.value : c)))} />
          <button type="button" className="danger small" onClick={() => onChange(cases.filter((_, i) => i !== index))} disabled={cases.length <= 2}>Remove</button>
        </div>
      ))}
      <p className="inline-note">Each label is an output port (max 7).</p>
    </div>
  );
}

function lines(text: string): string[] { return text.split("\n").map((s) => s.trim()).filter(Boolean); }
