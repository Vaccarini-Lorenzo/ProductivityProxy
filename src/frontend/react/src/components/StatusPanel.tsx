import type { AppConfig } from "../models/config/types";
import type { ProxyStatus, ProxyEvent } from "../services/proxy/proxyRepository";

interface Props {
  config: AppConfig;
  status: ProxyStatus;
  events: ProxyEvent[];
  onStart: () => void;
  onStop: () => void;
  onRefresh: () => void;
}

export function StatusPanel({ config, status, events, onStart, onStop, onRefresh }: Props) {
  const activeMode = config.modes.find((mode) => mode.id === config.activeModeId);

  return (
    <section className="panel status-grid" aria-labelledby="status-heading">
      <div>
        <p className="eyebrow">Current status</p>
        <h2 id="status-heading">{status.running ? "Proxy running" : "Proxy stopped"}</h2>
        <p className="muted">Mode: {activeMode?.name ?? "None"}</p>
        <p className="muted">Local proxy: 127.0.0.1:{config.proxy.port}</p>
        <p className="muted">LAN sharing: {config.proxy.allowLan ? "enabled" : "disabled"}</p>
      </div>
      <div className="button-row">
        <button className="primary" type="button" onClick={onStart} disabled={status.running}>
          Start proxy
        </button>
        <button type="button" onClick={onStop} disabled={!status.running}>
          Stop proxy
        </button>
        <button type="button" onClick={onRefresh}>
          Refresh
        </button>
      </div>
      <p className="muted">Recent events loaded: {events.length}</p>
    </section>
  );
}
