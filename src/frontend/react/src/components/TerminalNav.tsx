import { Icon, type IconName } from "./ui";

export type View = "settings" | "modes" | "policy" | "nodes" | "observability";

interface Props {
  active: View;
  running: boolean;
  onNavigate: (view: View) => void;
}

const LINKS: { view: View; label: string; icon: IconName }[] = [
  { view: "settings", label: "Settings", icon: "gear" },
  { view: "modes", label: "Modes", icon: "layers" },
  { view: "policy", label: "Policy", icon: "shield" },
  { view: "nodes", label: "Nodes", icon: "hexagon" },
  { view: "observability", label: "Observability", icon: "search" },
];

export function TerminalNav({ active, running, onNavigate }: Props) {
  return (
    <header className="terminal-head">
      <div className="title-row">
        <button className="brand-button" type="button" onClick={() => onNavigate("settings")}>ProductivityProxy</button>
        <span className={running ? "run-state on" : "run-state"} aria-live="polite">
          <span className="led" aria-hidden="true" /> Proxy: {running ? "RUNNING" : "STOPPED"}
        </span>
        <span className="version">v0.1.0-local</span>
      </div>
      <nav className="tab-row" aria-label="Main navigation">
        {LINKS.map((link) => (
          <button
            className={active === link.view ? "tab active" : "tab"}
            key={link.view}
            type="button"
            onClick={() => onNavigate(link.view)}
            aria-current={active === link.view ? "page" : undefined}
          >
            <Icon name={link.icon} />
            {link.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
