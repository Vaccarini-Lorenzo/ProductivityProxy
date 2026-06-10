import { useState } from "react";
import type { ProxyConfig } from "../models/config/types";
import type { NetworkInfo } from "../services/proxy/proxyRepository";
import { Button, Card, CheckRow, Field, Icon, PageHeader } from "../components/ui";

interface Props {
  proxy: ProxyConfig;
  running: boolean;
  network?: NetworkInfo;
  onChange: (proxy: ProxyConfig) => void;
  onStart: () => void;
  onStop: () => void;
}

export function SettingsView({ proxy, running, network, onChange, onStart, onStop }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const host = proxy.allowLan ? network?.lanHost ?? "0.0.0.0" : network?.localHost ?? "127.0.0.1";

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Configuration" title="Settings" subtitle="Control the local proxy and how it accepts connections." />

      <Card title="Proxy control" icon="terminal">
        <div className="status-grid">
          <div><dt>State</dt><dd className={running ? "ok" : undefined}>{running ? "Running" : "Stopped"}</dd></div>
          <div><dt>Address</dt><dd>{host}:{proxy.port}</dd></div>
          <div><dt>Authentication</dt><dd>{proxy.authEnabled ? "Enabled" : "Disabled"}</dd></div>
          <div><dt>LAN access</dt><dd>{proxy.allowLan ? "Enabled" : "Local only"}</dd></div>
        </div>
        <div className="actions hero-actions">
          <Button icon="play" className="primary hero" onClick={onStart} disabled={running}>Start proxy</Button>
          <Button icon="stop" className="hero" onClick={onStop} disabled={!running}>Stop proxy</Button>
        </div>
      </Card>

      <Card title="Connection" icon="link">
        <Field label="Listen port" className="field-narrow">
          <input type="number" min="1" max="65535" value={proxy.port} onChange={(e) => onChange({ ...proxy, port: Number(e.target.value) })} />
        </Field>
        <CheckRow
          checked={proxy.allowLan}
          onChange={(allowLan) => onChange({ ...proxy, allowLan })}
          label="Allow LAN connections"
          hint={`Other devices on your network can use the proxy at ${host}:${proxy.port}.`}
        />
      </Card>

      <Card title="Authentication" icon="lock">
        <CheckRow
          checked={proxy.authEnabled}
          onChange={(authEnabled) => onChange({ ...proxy, authEnabled })}
          label="Require username and password"
          hint="Clients must authenticate before the proxy forwards their traffic."
        />
        <fieldset className="form-grid credentials" disabled={!proxy.authEnabled}>
          <Field label="Username">
            <input autoComplete="off" value={proxy.authUsername} onChange={(e) => onChange({ ...proxy, authUsername: e.target.value })} />
          </Field>
          <Field label="Password">
            <div className="password-field">
              <input type={showPassword ? "text" : "password"} autoComplete="new-password" value={proxy.authPassword} onChange={(e) => onChange({ ...proxy, authPassword: e.target.value })} />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"}>
                <Icon name={showPassword ? "eyeOff" : "eye"} />
              </button>
            </div>
          </Field>
        </fieldset>
      </Card>
    </div>
  );
}
