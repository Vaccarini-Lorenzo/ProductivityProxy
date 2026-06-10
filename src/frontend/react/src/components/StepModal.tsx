import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { PythonCodeEditor } from "./PythonCodeEditor";
import { Field, FieldGroup } from "./ui";
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

const DEFAULT_START_TRIGGER_CODE = `def triggered_by(context: RequestContext) -> bool:
    return True
`;

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
      <FieldGroup label="Python source" hint="Read-only · edit in Nodes">
        <PythonCodeEditor value={code} minHeight={260} readOnly ariaLabel={`Python source for ${node.name}`} />
      </FieldGroup>
    </div>
  );
}

function TriggerEditor({ step, onChange }: { step: PolicyStep; onChange: (p: StepParams) => void }) {
  const code = startTriggerCode(step.params);
  function setCode(next: string) {
    const { trigger: _legacy, ...rest } = step.params ?? {};
    onChange({ ...rest, code: next });
  }

  return (
    <div className="inspector-form">
      <FieldGroup label="Trigger function" hint="Return True to run this policy for the request. Return False to skip it.">
        <div className="code-signature">def triggered_by(context: RequestContext) -&gt; bool</div>
        <PythonCodeEditor value={code} minHeight={190} ariaLabel="Start trigger Python code" onChange={setCode} />
      </FieldGroup>
      <p className="inline-note">The function receives the live request context, including context.flow.request.</p>
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
      <FieldGroup label="Condition" hint={isIf ? "Return True for the then port, False for else" : "Return a case label string"}>
        <div className="code-signature">{isIf ? "def if_condition(input) -> bool" : "def switch_condition(input) -> str"}</div>
        <PythonCodeEditor value={code} minHeight={130} ariaLabel={`${step.type} operator Python code`} onChange={(next) => onChange({ ...step.params, code: next })} />
      </FieldGroup>
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

function startTriggerCode(params: StepParams | undefined): string {
  if (typeof params?.code === "string") return params.code;
  const trigger = params?.trigger;
  if (trigger && typeof trigger === "object") return legacyTriggerCode(trigger as Record<string, unknown>);
  return DEFAULT_START_TRIGGER_CODE;
}

function legacyTriggerCode(trigger: Record<string, unknown>): string {
  const hosts = Array.isArray(trigger.hostPatterns) ? trigger.hostPatterns.map(String) : [];
  const paths = Array.isArray(trigger.pathPatterns) ? trigger.pathPatterns.map(String) : [];
  return `def triggered_by(context: RequestContext) -> bool:
    host = context.flow.request.pretty_host.lower().strip(".")
    host_patterns = ${pythonList(hosts)}
    if host_patterns and not any(host == item or host.endswith("." + item) for item in host_patterns):
        return False
    haystack = context.flow.request.pretty_url.lower() + " " + context.flow.request.headers.get("referer", "").lower()
    path_patterns = ${pythonList(paths)}
    return not path_patterns or any(item in haystack for item in path_patterns)
`;
}

function pythonList(values: string[]): string {
  return `[${values.map((value) => JSON.stringify(value)).join(", ")}]`;
}
