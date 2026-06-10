export type View = "settings" | "modes" | "policy" | "nodes" | "observability";

interface Props {
  active: View;
  running: boolean;
  onNavigate: (view: View) => void;
}

const LINKS: { view: View; label: string }[] = [
  { view: "settings", label: "Settings" },
  { view: "modes", label: "Modes" },
  { view: "policy", label: "Policy" },
  { view: "nodes", label: "Nodes" },
  { view: "observability", label: "Observability" },
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
        <span className="window-dots" aria-hidden="true">— □ ×</span>
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
            {link.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
