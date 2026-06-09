import type { ProxyConfig } from "../models/config/types";

interface Props {
  proxy: ProxyConfig;
  running: boolean;
  onChange: (proxy: ProxyConfig) => void;
  onStart: () => void;
  onStop: () => void;
}

export function SettingsView({ proxy, running, onChange, onStart, onStop }: Props) {
  return (
    <div className="view-stack">
      <header className="view-header">
        <p className="eyebrow">Configuration</p>
        <h1>Settings</h1>
      </header>

      <section className="panel" aria-labelledby="proxy-heading">
        <h2 id="proxy-heading">Proxy</h2>
        <div className="button-row">
          <button className="primary" type="button" onClick={onStart} disabled={running}>Start proxy</button>
          <button type="button" onClick={onStop} disabled={!running}>Stop proxy</button>
          <span className={running ? "status-badge on" : "status-badge"}>{running ? "Running" : "Stopped"}</span>
        </div>
      </section>

      <section className="panel" aria-labelledby="port-heading">
        <h2 id="port-heading">Connection</h2>
        <div className="form-grid">
          <label className="field">
            <span>Port</span>
            <input type="number" min="1" max="65535" value={proxy.port} onChange={(e) => onChange({ ...proxy, port: Number(e.target.value) })} />
          </label>
          <label className="check-field">
            <input type="checkbox" checked={proxy.allowLan} onChange={(e) => onChange({ ...proxy, allowLan: e.target.checked })} />
            <span>Allow LAN connections</span>
          </label>
        </div>
      </section>

      <section className="panel" aria-labelledby="auth-heading">
        <h2 id="auth-heading">Authentication</h2>
        <div className="form-grid">
          <label className="check-field">
            <input type="checkbox" checked={proxy.authEnabled} onChange={(e) => onChange({ ...proxy, authEnabled: e.target.checked })} />
            <span>Require authentication</span>
          </label>
          <label className="field">
            <span>Username</span>
            <input value={proxy.authUsername} onChange={(e) => onChange({ ...proxy, authUsername: e.target.value })} />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" value={proxy.authPassword} onChange={(e) => onChange({ ...proxy, authPassword: e.target.value })} />
          </label>
        </div>
      </section>
    </div>
  );
}
