import { useState, type ReactNode } from "react";
import type { CustomNodeConfig } from "../models/config/types";
import { Icon, SearchInput, type IconName } from "./ui";

const FLOW_NODES = [
  { type: "start", label: "Start", desc: "Entry point with optional trigger", tone: "start", icon: "play" as IconName },
  { type: "end", label: "End", desc: "Stop this policy flow", tone: "end", icon: "stop" as IconName },
];
const OPERATORS = [
  { type: "if", label: "If / Then / Else", desc: "One input, two outputs", tone: "operator", icon: "branch" as IconName },
  { type: "switch", label: "Switch", desc: "One output per case", tone: "operator", icon: "switch" as IconName },
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
      <SearchInput value={search} onChange={setSearch} placeholder="Search nodes…" ariaLabel="Search nodes" />
      <Section title="Flow">
        {flow.map((item) => <LibraryButton key={item.type} title={item.label} desc={item.desc} tone={item.tone} icon={item.icon} disabled={item.type === "start" && hasStart} onClick={() => onAddStep("node", item.type)} />)}
      </Section>
      <Section title="Logic">
        {operators.map((item) => <LibraryButton key={item.type} title={item.label} desc={item.desc} tone={item.tone} icon={item.icon} onClick={() => onAddStep("operator", item.type)} />)}
      </Section>
      <Section title="Custom">
        {nodes.map((node) => <LibraryButton key={node.id} title={node.name} desc={node.path.split("/").pop() ?? node.path} tone="custom" icon="hexagon" onClick={() => onAddStep("node", node.id)} />)}
        {nodes.length === 0 && <p className="muted library-empty">No matching nodes.</p>}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="library-section"><h3>{title}</h3><div className="library-items">{children}</div></section>;
}

function LibraryButton({ title, desc, tone, icon, disabled, onClick }: { title: string; desc: string; tone: string; icon: IconName; disabled?: boolean; onClick: () => void }) {
  return (
    <button className={`library-item ${tone}`} type="button" disabled={disabled} onClick={onClick} title={desc}>
      <span className="library-item-icon"><Icon name={icon} /></span>
      <span className="library-item-text">
        <strong>{title}</strong>
        <small>{desc}</small>
      </span>
    </button>
  );
}
