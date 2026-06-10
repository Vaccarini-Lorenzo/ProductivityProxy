import { useEffect, useState, type ReactNode } from "react";
import type { CustomNodeConfig, StepParams } from "../models/config/types";
import { readNodeSource } from "../services/nodes/defaultNodeSources";
import { fuzzyMatch } from "../services/search/search";
import { IF_CONDITION_CODE, START_TRIGGER_CODE, SWITCH_CONDITION_CODE } from "../services/policy/codeTemplates";
import { PythonCodeEditor } from "./PythonCodeEditor";
import { FieldGroup, Icon, IconButton, Modal, SearchInput, type IconName } from "./ui";

const FLOW_NODES: LibraryItem[] = [
  { kind: "node", type: "start", label: "Start", desc: "Entry point with Python triggered_by(request) code", tone: "start", icon: "play", code: START_TRIGGER_CODE },
  { kind: "node", type: "end", label: "End", desc: "Stop this policy flow", tone: "end", icon: "stop" },
];
const OPERATORS: LibraryItem[] = [
  { kind: "operator", type: "if", label: "If / Then / Else", desc: "One input, two outputs. Routes by Python if_condition(input).", tone: "operator", icon: "branch", code: IF_CONDITION_CODE },
  { kind: "operator", type: "switch", label: "Switch", desc: "One input, one output per case. Routes by Python switch_condition(input).", tone: "operator", icon: "switch", code: SWITCH_CONDITION_CODE },
];

interface Props {
  customNodes: CustomNodeConfig[];
  hasStart: boolean;
  onAddStep: (kind: "node" | "operator", type: string, params?: StepParams) => void;
  onReadNode: (path: string) => Promise<string>;
}

interface LibraryItem {
  kind: "node" | "operator";
  type: string;
  label: string;
  desc: string;
  tone: string;
  icon: IconName;
  code?: string;
  path?: string;
}

export function NodeLibrary({ customNodes, hasStart, onAddStep, onReadNode }: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<LibraryItem | null>(null);
  const [previewCode, setPreviewCode] = useState("");
  const flow = FLOW_NODES.filter((item) => fuzzyMatch(search, `${item.label} ${item.desc}`));
  const operators = OPERATORS.filter((item) => fuzzyMatch(search, `${item.label} ${item.desc}`));
  const nodes = customNodes.map(customItem).filter((node) => fuzzyMatch(search, `${node.label} ${node.type} ${node.desc}`));
  const addDisabled = selected?.type === "start" && hasStart;
  const canEditCode = selected?.kind === "operator" || selected?.type === "start";

  useEffect(() => {
    if (!selected) return;
    if (!selected.path) { setPreviewCode(selected.code ?? ""); return; }
    let active = true;
    setPreviewCode("Loading source…");
    readNodeSource(onReadNode, selected.path)
      .then(({ source }) => { if (active) setPreviewCode(source); });
    return () => { active = false; };
  }, [selected, onReadNode]);

  function addSelected() {
    if (!selected || addDisabled) return;
    onAddStep(selected.kind, selected.type, paramsFor(selected, previewCode));
    setSelected(null);
  }

  return (
    <div className="library" aria-label="Node library">
      <SearchInput value={search} onChange={setSearch} placeholder="Search nodes…" ariaLabel="Search nodes" />
      <Section title="Flow">
        {flow.map((item) => <LibraryButton key={item.type} item={item} onClick={() => setSelected(item)} />)}
      </Section>
      <Section title="Logic">
        {operators.map((item) => <LibraryButton key={item.type} item={item} onClick={() => setSelected(item)} />)}
      </Section>
      <Section title="Custom">
        {nodes.map((node) => <LibraryButton key={node.type} item={{ ...node, desc: shortPath(node.desc) }} onClick={() => setSelected(node)} />)}
        {nodes.length === 0 && <p className="muted library-empty">No matching nodes.</p>}
      </Section>
      {selected && (
        <Modal
          title={selected.label}
          subtitle={<span className={`inspector-badge ${selected.kind === "operator" ? "operator" : "node"}`}>{selected.kind} · {selected.type}</span>}
          onClose={() => setSelected(null)}
          wide
          actions={<IconButton className="primary" icon="plus" label={addDisabled ? "Start already exists" : `Add ${selected.label}`} onClick={addSelected} disabled={addDisabled} />}
        >
          <div className="node-view">
            <p className="inline-note">{selected.desc}</p>
            {addDisabled && <p className="message">This policy already has a start node.</p>}
            {previewCode ? (
              <FieldGroup label={codeLabel(selected)} hint={canEditCode ? "Edit before adding" : "Read-only preview"}>
                <PythonCodeEditor value={previewCode} minHeight={260} readOnly={!canEditCode} ariaLabel={`${selected.label} Python preview`} onChange={canEditCode ? setPreviewCode : undefined} apiQuery={apiQueryFor(selected)} />
              </FieldGroup>
            ) : <p className="muted">This flow node has no Python code.</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}

function customItem(node: CustomNodeConfig): LibraryItem {
  return { kind: "node", type: node.id, label: node.name, desc: node.path, tone: "custom", icon: "hexagon", path: node.path };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="library-section"><h3>{title}</h3><div className="library-items">{children}</div></section>;
}

function LibraryButton({ item, onClick }: { item: LibraryItem; onClick: () => void }) {
  return (
    <button className={`library-item ${item.tone}`} type="button" onClick={onClick} title={item.desc}>
      <span className="library-item-icon"><Icon name={item.icon} /></span>
      <span className="library-item-text">
        <strong>{item.label}</strong>
        <small>{item.desc}</small>
      </span>
    </button>
  );
}

function paramsFor(item: LibraryItem, code: string): StepParams | undefined {
  if (item.type === "start") return { code };
  if (item.kind !== "operator") return undefined;
  if (item.type === "switch") return { code, cases: ["case_a", "case_b", "case_c", "default"] };
  return { code };
}

function codeLabel(item: LibraryItem): string {
  if (item.kind === "operator") return "Python code";
  if (item.type === "start") return "Python trigger";
  return item.path ? "Python source" : "Python template";
}

function apiQueryFor(item: LibraryItem): string {
  if (item.kind === "operator") return item.type === "if" ? "if_condition" : "switch_condition";
  if (item.type === "start") return "triggered_by";
  return "run";
}

function shortPath(path: string): string { return path.split("/").pop() ?? path; }
