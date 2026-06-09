import type { ProxyConfig } from "../models/config/types";
import type { NetworkInfo } from "../services/proxy/proxyRepository";

interface Props {
  proxy: ProxyConfig;
  running: boolean;
  network?: NetworkInfo;
  onChange: (proxy: ProxyConfig) => void;
  onStart: () => void;
  onStop: () => void;
}

export function SettingsView({ proxy, running, network, onChange, onStart, onStop }: Props) {
  const host = proxy.allowLan ? network?.lanHost ?? "0.0.0.0" : network?.localHost ?? "127.0.0.1";

  return (
    <div className="page-stack">
      <section className="page-title">
        <p className="eyebrow">Configuration</p>
        <h1>Settings</h1>
      </section>

      <section className="terminal-card" aria-labelledby="proxy-heading">
        <p className="command">$ ppx status</p>
        <h2 id="proxy-heading">Proxy control</h2>
        <div className="settings-summary">
          <dl className="status-list">
            <div><dt>State</dt><dd className={running ? "hot" : undefined}>{running ? "RUNNING" : "STOPPED"}</dd></div>
            <div><dt>Listening</dt><dd>{host}:{proxy.port}</dd></div>
            <div><dt>Auth</dt><dd>{proxy.authEnabled ? "enabled" : "disabled"}</dd></div>
            <div><dt>LAN</dt><dd>{proxy.allowLan ? "enabled" : "local only"}</dd></div>
          </dl>
          <div className="actions">
            <button className="primary" type="button" onClick={onStart} disabled={running}>$ ppx start</button>
            <button type="button" onClick={onStop} disabled={!running}>$ ppx stop</button>
          </div>
        </div>
      </section>

      <section className="terminal-card" aria-labelledby="network-heading">
        <p className="eyebrow">Network</p>
        <h2 id="network-heading">Connection</h2>
        <div className="form-grid">
          <label className="field">
            <span>Listen port</span>
            <input type="number" min="1" max="65535" value={proxy.port} onChange={(e) => onChange({ ...proxy, port: Number(e.target.value) })} />
          </label>
          <label className="switch-field">
            <input type="checkbox" checked={proxy.allowLan} onChange={(e) => onChange({ ...proxy, allowLan: e.target.checked })} />
            <span>Allow LAN connections</span>
          </label>
        </div>
        <p className="inline-note">Bound to: {host}:{proxy.port}</p>
      </section>

      <section className="terminal-card" aria-labelledby="auth-heading">
        <p className="eyebrow">Access</p>
        <h2 id="auth-heading">Authentication</h2>
        <div className="form-grid">
          <label className="switch-field">
            <input type="checkbox" checked={proxy.authEnabled} onChange={(e) => onChange({ ...proxy, authEnabled: e.target.checked })} />
            <span>Require token auth</span>
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
