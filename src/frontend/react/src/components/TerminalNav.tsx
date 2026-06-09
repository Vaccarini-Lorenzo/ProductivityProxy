export type View = "nodes" | "policies" | "settings";

interface Props {
  active: View;
  running: boolean;
  onNavigate: (view: View) => void;
}

const LINKS: { view: View; code: string; label: string }[] = [
  { view: "nodes", code: "NOD", label: "Nodes" },
  { view: "policies", code: "POL", label: "Policies" },
  { view: "settings", code: "SET", label: "Settings" },
];

export function TerminalNav({ active, running, onNavigate }: Props) {
  return (
    <aside className="terminal-nav" aria-label="Main navigation">
      <button className="brand-mark" type="button" onClick={() => onNavigate("policies")} aria-label="ProductivityProxy home">
        PX
      </button>
      <nav className="nav-list">
        {LINKS.map((link) => (
          <button
            className={active === link.view ? "nav-link active" : "nav-link"}
            key={link.view}
            type="button"
            onClick={() => onNavigate(link.view)}
            aria-current={active === link.view ? "page" : undefined}
          >
            <strong>{link.code}</strong>
            <span>{link.label}</span>
          </button>
        ))}
      </nav>
      <div className="nav-status" aria-live="polite">
        <span className={running ? "status-led on" : "status-led"} aria-hidden="true" />
        <span>{running ? "Running" : "Idle"}</span>
        <small>v0.1.0</small>
      </div>
    </aside>
  );
}
