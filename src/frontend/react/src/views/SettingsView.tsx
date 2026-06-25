import { useEffect, useRef, useState } from "react";
import type { AppCaptureTarget, LocalRoutingMode, ProxyConfig } from "../models/config/types";
import type { ActiveApp, NetworkInfo } from "../services/proxy/proxyRepository";
import { fuzzyMatch } from "../services/search/search";
import { Button, Card, CheckRow, Field, FieldGroup, Icon, PageHeader, SearchInput } from "../components/ui";

interface Props {
  proxy: ProxyConfig;
  running: boolean;
  network?: NetworkInfo;
  activeApps: ActiveApp[];
  onChange: (proxy: ProxyConfig) => void;
  onStart: () => void;
  onStop: () => void;
}

export function SettingsView({ proxy, running, network, activeApps, onChange, onStart, onStop }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [appQuery, setAppQuery] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(0);
  const routingMode = proxy.localRoutingMode ?? "systemWide";
  const appTargets = proxy.appCaptureTargets ?? [];
  const systemWide = routingMode === "systemWide";
  const host = proxy.allowLan && systemWide ? network?.lanHost ?? "0.0.0.0" : network?.localHost ?? "127.0.0.1";
  const address = systemWide ? `${host}:${proxy.port}` : `${appTargets.length} selected process${appTargets.length === 1 ? "" : "es"}`;
  const apps = visibleApps(activeApps, appTargets);
  const filteredApps = apps.filter((app) => fuzzyMatch(appQuery, `${app.name} ${app.processNames.join(" ")}`));
  const appGridColumns = balancedColumns(filteredApps.length, gridWidth);

  useEffect(() => {
    const element = gridRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => setGridWidth(entries[0].contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [systemWide]);

  function setRoutingMode(localRoutingMode: LocalRoutingMode) {
    onChange({ ...proxy, localRoutingMode });
  }

  function setAppTarget(app: ActiveApp, checked: boolean) {
    const remove = new Set(app.processNames);
    const next = checked
      ? unique([...appTargets, ...app.processNames])
      : appTargets.filter((item) => !remove.has(item));
    onChange({ ...proxy, appCaptureTargets: next });
  }

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Configuration" title="Settings" subtitle="Control the local proxy and how traffic is routed." />

      <Card title="Proxy control" icon="terminal">
        <div className="status-grid">
          <div><dt>State</dt><dd className={running ? "ok" : undefined}>{running ? "Running" : "Stopped"}</dd></div>
          <div><dt>Routing</dt><dd>{systemWide ? "System-wide" : "App-specific"}</dd></div>
          <div><dt>Address</dt><dd>{address}</dd></div>
          <div><dt>Authentication</dt><dd>{systemWide ? proxy.authEnabled ? "Enabled" : "Disabled" : "Not used"}</dd></div>
        </div>
        <div className="actions hero-actions">
          <Button icon="play" className="primary hero" onClick={onStart} disabled={running}>Start proxy</Button>
          <Button icon="stop" className="hero" onClick={onStop} disabled={!running}>Stop proxy</Button>
        </div>
      </Card>

      <Card title="Traffic routing" icon="link">
        <FieldGroup label="Capture mode" hint="Choose whether ProductivityProxy changes the system proxy or captures selected local apps.">
          <div className="box-grid modes">
            <button type="button" className={systemWide ? "box-card routing-choice active" : "box-card routing-choice"} onClick={() => setRoutingMode("systemWide")}>
              <span className="box-card-body">
                <span className="box-card-title"><span className="box-card-name">System-wide</span></span>
                <span className="box-card-sub">Route this computer through the OS HTTP/HTTPS proxy settings.</span>
              </span>
            </button>
            <button type="button" className={!systemWide ? "box-card routing-choice active" : "box-card routing-choice"} onClick={() => setRoutingMode("appSpecific")}>
              <span className="box-card-body">
                <span className="box-card-title"><span className="box-card-name">App-specific</span></span>
                <span className="box-card-sub">Use mitmproxy Local Capture for selected running apps.</span>
              </span>
            </button>
          </div>
        </FieldGroup>

        {!systemWide && (
          <FieldGroup label="Current active apps" hint="Search and toggle apps currently running on this computer.">
            <div className="app-picker-panel">
              <div className="app-picker-toolbar">
                <SearchInput value={appQuery} onChange={setAppQuery} placeholder="Search active apps…" ariaLabel="Search active apps" className="app-picker-search" />
                <span className="count-pill"><span className="dot" />{filteredApps.length} apps</span>
              </div>
              <div ref={gridRef} className="app-icon-grid" style={{ gridTemplateColumns: `repeat(${appGridColumns}, minmax(0, 1fr))` }}>
                {filteredApps.map((app) => {
                  const checked = app.processNames.some((name) => appTargets.includes(name));
                  return (
                    <label key={app.name} className={checked ? "app-icon-card active" : "app-icon-card"} title={appHint(app)}>
                      <span className="app-icon-image" aria-hidden="true">
                        {app.iconDataUrl ? <img src={app.iconDataUrl} alt="" /> : <span className="app-icon-fallback">{initials(app.name)}</span>}
                      </span>
                      <span className="app-icon-label">{app.processCount === 0 ? `${app.name}*` : app.name}</span>
                      <input className="switch app-icon-toggle" type="checkbox" checked={checked} onChange={(event) => setAppTarget(app, event.target.checked)} aria-label={`Capture ${app.name}`} />
                    </label>
                  );
                })}
              </div>
              {filteredApps.length === 0 && <p className="field-hint">No matching active apps.</p>}
            </div>
            <p className="field-hint">First use on macOS asks you to approve the mitmproxy system extension in System Settings → General → Login Items &amp; Extensions → Network Extensions. Capture starts only after you approve it.</p>
          </FieldGroup>
        )}

        <Field label="Listen port" className="field-narrow">
          <input type="number" min="1" max="65535" value={proxy.port} onChange={(e) => onChange({ ...proxy, port: Number(e.target.value) })} />
        </Field>
        <CheckRow checked={proxy.allowLan} onChange={(allowLan) => onChange({ ...proxy, allowLan })} label="Allow LAN connections" hint={systemWide ? `Other devices on your network can use the proxy at ${host}:${proxy.port}.` : "LAN HTTP proxy access only applies to System-wide routing."} disabled={!systemWide} />
      </Card>

      <Card title="Authentication" icon="lock">
        <CheckRow checked={proxy.authEnabled} onChange={(authEnabled) => onChange({ ...proxy, authEnabled })} label="Require username and password" hint={systemWide ? "Clients must authenticate before the proxy forwards their traffic." : "App-specific routing captures local apps directly, so proxy authentication is not used."} disabled={!systemWide} />
        <fieldset className="form-grid credentials" disabled={!systemWide || !proxy.authEnabled}>
          <Field label="Username"><input autoComplete="off" value={proxy.authUsername} onChange={(e) => onChange({ ...proxy, authUsername: e.target.value })} /></Field>
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

function visibleApps(activeApps: ActiveApp[], targets: AppCaptureTarget[]): ActiveApp[] {
  const seen = new Set(activeApps.flatMap((app) => app.processNames));
  const missing = targets.filter((target) => !seen.has(target)).map((target) => ({ name: target, processNames: [target], processCount: 0 }));
  return [...activeApps, ...missing];
}

function appHint(app: ActiveApp): string {
  const count = app.processCount || app.processNames.length;
  return `${count} ${count === 1 ? "process" : "processes"}: ${app.processNames.join(", ")}`;
}

function balancedColumns(count: number, width: number): number {
  if (count <= 0) return 1;
  const tile = 168;
  const gap = 10;
  const maxByWidth = Math.max(1, Math.floor((width + gap) / (tile + gap)));
  const columns = Math.min(maxByWidth || count, count);
  const rows = Math.ceil(count / columns);
  return Math.ceil(count / rows);
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

function unique(items: AppCaptureTarget[]): AppCaptureTarget[] {
  return [...new Set(items)];
}
