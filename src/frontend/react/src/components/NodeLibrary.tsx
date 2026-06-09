import { useState, type ReactNode } from "react";
import type { CustomNodeConfig } from "../models/config/types";

const FLOW_NODES = [
  { type: "start", label: "Start", desc: "Entry point with optional trigger" },
  { type: "end", label: "End", desc: "Stop this policy flow" },
];
const OPERATORS = [
  { type: "if", label: "If / Then / Else", desc: "One input, two outputs" },
  { type: "switch", label: "Switch", desc: "One output per case" },
];

interface Props {
  customNodes: CustomNodeConfig[];
  hasStart: boolean;
  onAddStep: (kind: "node" | "operator", type: string) => void;
}

export function NodeLibrary({ customNodes, hasStart, onAddStep }: Props) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const matches = (text: string) => !query || text.toLowerCase().includes(query);
  const flow = FLOW_NODES.filter((item) => matches(`${item.label} ${item.desc}`));
  const operators = OPERATORS.filter((item) => matches(`${item.label} ${item.desc}`));
  const nodes = customNodes.filter((node) => matches(`${node.name} ${node.id} ${node.path}`));

  return (
    <div className="library" aria-label="Node library">
      <input className="library-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search nodes…" aria-label="Search nodes" />
      <Section title="Flow">
        {flow.map((item) => <LibraryButton key={item.type} title={item.label} desc={item.desc} tone="flow" disabled={item.type === "start" && hasStart} onClick={() => onAddStep("node", item.type)} />)}
      </Section>
      <Section title="Logic">
        {operators.map((item) => <LibraryButton key={item.type} title={item.label} desc={item.desc} tone="operator" onClick={() => onAddStep("operator", item.type)} />)}
      </Section>
      <Section title="Custom">
        {nodes.map((node) => <LibraryButton key={node.id} title={node.name} desc={node.path.split("/").pop() ?? node.path} tone="custom" onClick={() => onAddStep("node", node.id)} />)}
        {nodes.length === 0 && <p className="muted library-empty">No matching nodes.</p>}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="library-section"><h3>{title}</h3><div className="library-items">{children}</div></section>;
}

function LibraryButton({ title, desc, tone, disabled, onClick }: { title: string; desc: string; tone: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button className={`library-item ${tone}`} type="button" disabled={disabled} onClick={onClick} title={desc}>
      <strong>{title}</strong>
      <small>{desc}</small>
    </button>
  );
}
