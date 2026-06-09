import type { ProxyConfig } from "../models/config/types";

interface Props {
  proxy: ProxyConfig;
  onChange: (proxy: ProxyConfig) => void;
}

export function ProxySettingsPanel({ proxy, onChange }: Props) {
  return (
    <section className="panel" aria-labelledby="proxy-heading">
      <p className="eyebrow">Proxy</p>
      <h2 id="proxy-heading">Proxy settings</h2>
      <div className="form-grid">
        <label className="field">
          <span>Port</span>
          <input
            type="number"
            min="1"
            max="65535"
            value={proxy.port}
            onChange={(event) => onChange({ ...proxy, port: Number(event.target.value) })}
          />
        </label>
        <label className="check-field">
          <input
            type="checkbox"
            checked={proxy.allowLan}
            onChange={(event) => onChange({ ...proxy, allowLan: event.target.checked })}
          />
          <span>Allow devices on local network</span>
        </label>
        <label className="check-field">
          <input
            type="checkbox"
            checked={proxy.authEnabled}
            onChange={(event) => onChange({ ...proxy, authEnabled: event.target.checked })}
          />
          <span>Require proxy authentication</span>
        </label>
        <label className="field">
          <span>Auth username</span>
          <input value={proxy.authUsername} onChange={(event) => onChange({ ...proxy, authUsername: event.target.value })} />
        </label>
        <label className="field">
          <span>Auth password</span>
          <input
            type="password"
            value={proxy.authPassword}
            onChange={(event) => onChange({ ...proxy, authPassword: event.target.value })}
          />
        </label>
      </div>
    </section>
  );
}
