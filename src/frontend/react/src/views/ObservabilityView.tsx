import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AppConfig } from "../models/config/types";
import type { CommandClient } from "../services/config/configRepository";
import { queryEvents, type EventQuery, type ProxyEvent } from "../services/proxy/proxyRepository";

interface Props {
  client: CommandClient;
  config: AppConfig;
}

interface Filters {
  limit: number;
  category: string;
  type: string;
  level: string;
  policyId: string;
  requestId: string;
  search: string;
  windowMinutes: string;
}

const DEFAULT_FILTERS: Filters = { limit: 100, category: "", type: "", level: "", policyId: "", requestId: "", search: "", windowMinutes: "" };
const EVENT_TYPES = ["", "config_loaded", "config_rejected", "request_started", "request_finished", "request_failed", "policy_started", "policy_step", "policy_finished", "policy_error", "custom_node_log", "notification"];

export function ObservabilityView({ client, config }: Props) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [events, setEvents] = useState<ProxyEvent[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [message, setMessage] = useState("");
  const policies = useMemo(() => config.modes.flatMap((mode) => mode.policies), [config.modes]);
  const selected = events[selectedIndex];
  const requestId = text(selected, "requestId");
  const timeline = requestId ? events.filter((e) => text(e, "requestId") === requestId) : [];

  const load = useCallback(async () => {
    try {
      const result = await queryEvents(client, toQuery(filters));
      setEvents(result);
      setSelectedIndex((i) => Math.min(i, Math.max(result.length - 1, 0)));
      setMessage(`${result.length} events`);
    } catch (error) {
      const value = error instanceof Error ? error.message : String(error);
      setMessage(value.includes("invoke") ? "Browser preview — Tauri unavailable" : value);
    }
  }, [client, filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(load, 3000);
    return () => window.clearInterval(id);
  }, [autoRefresh, load]);

  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  return (
    <div className="page-stack">
      <section className="page-title">
        <p className="eyebrow">Observability</p>
        <h1>Policy trace</h1>
      </section>

      <section className="terminal-card" aria-labelledby="filters-heading">
        <div className="section-head">
          <h2 id="filters-heading">Filters</h2>
          <div className="actions compact">
            <label className="switch-field inline"><input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} /><span>Auto</span></label>
            <button type="button" onClick={load}>refresh</button>
            <span className="message">{message}</span>
          </div>
        </div>
        <div className="form-grid dense-grid">
          <F label="Limit"><input type="number" min="1" max="1000" value={filters.limit} onChange={(e) => update("limit", Number(e.target.value))} /></F>
          <F label="Category"><select value={filters.category} onChange={(e) => update("category", e.target.value)}><option value="">any</option><option value="observability">observability</option><option value="custom_node">custom_node</option></select></F>
          <F label="Type"><select value={filters.type} onChange={(e) => update("type", e.target.value)}>{EVENT_TYPES.map((t) => <option key={t} value={t}>{t || "any"}</option>)}</select></F>
          <F label="Level"><select value={filters.level} onChange={(e) => update("level", e.target.value)}><option value="">any</option><option value="debug">debug</option><option value="info">info</option><option value="warning">warning</option><option value="error">error</option></select></F>
          <F label="Policy"><select value={filters.policyId} onChange={(e) => update("policyId", e.target.value)}><option value="">any</option>{policies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></F>
          <F label="Request ID"><input value={filters.requestId} onChange={(e) => update("requestId", e.target.value)} placeholder="hex" /></F>
          <F label="Minutes"><input value={filters.windowMinutes} onChange={(e) => update("windowMinutes", e.target.value)} placeholder="15" /></F>
          <F label="Search"><input value={filters.search} onChange={(e) => update("search", e.target.value)} placeholder="keyword" /></F>
        </div>
      </section>

      <section className="observability-grid">
        <div className="terminal-card" aria-labelledby="events-heading">
          <h2 id="events-heading">Events</h2>
          <div className="event-table" role="list">
            {events.map((event, index) => (
              <button className={index === selectedIndex ? "event-row selected" : "event-row"} key={eventKey(event, index)} type="button" onClick={() => setSelectedIndex(index)} role="listitem">
                <span>{formatTime(event)}</span>
                <strong>{text(event, "type") || "event"}</strong>
                <small>{text(event, "policyName") || text(event, "source")}</small>
                <em>{text(event, "level")}</em>
              </button>
            ))}
            {events.length === 0 && <p className="muted">No events match filters.</p>}
          </div>
        </div>

        <div className="terminal-card detail-card" aria-labelledby="detail-heading">
          <h2 id="detail-heading">Detail</h2>
          {selected ? <pre>{JSON.stringify(selected, null, 2)}</pre> : <p className="muted">Select an event.</p>}
        </div>

        {timeline.length > 0 && (
          <div className="terminal-card timeline-card" aria-labelledby="timeline-heading">
            <h2 id="timeline-heading">Request timeline ({timeline.length} events)</h2>
            {timeline.map((event, index) => (
              <div className="timeline-row" key={eventKey(event, index)}>
                <span>{index + 1}</span>
                <div><strong>{text(event, "type")}</strong> <small>{text(event, "message")}</small></div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function F({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function toQuery(filters: Filters): EventQuery {
  const minutes = Number(filters.windowMinutes);
  const since = Number.isFinite(minutes) && minutes > 0 ? Date.now() / 1000 - minutes * 60 : undefined;
  return { limit: filters.limit, category: blank(filters.category), type: blank(filters.type), level: blank(filters.level), policyId: blank(filters.policyId), requestId: blank(filters.requestId), search: blank(filters.search), since };
}

function blank(value: string): string | undefined { const t = value.trim(); return t || undefined; }
function text(event: ProxyEvent | undefined, field: string): string { const v = event?.[field]; return typeof v === "string" ? v : v === undefined ? "" : String(v); }
function formatTime(event: ProxyEvent): string { const v = event.timestamp; if (typeof v !== "number") return "--:--"; return new Date(v * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
function eventKey(event: ProxyEvent, index: number): string { return `${text(event, "timestamp")}-${text(event, "type")}-${index}`; }
