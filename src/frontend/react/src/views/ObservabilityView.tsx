import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppConfig } from "../models/config/types";
import type { CommandClient } from "../services/config/configRepository";
import { queryEvents, type EventQuery, type ProxyEvent } from "../services/proxy/proxyRepository";
import { Card, Field, IconButton, Modal, PageHeader, Toggle, count } from "../components/ui";

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
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [message, setMessage] = useState("");
  const policies = useMemo(() => config.policies, [config.policies]);
  const selected = openIndex === null ? undefined : events[openIndex];
  const requestId = text(selected, "requestId");
  const timeline = requestId ? events.filter((e) => text(e, "requestId") === requestId) : [];

  const load = useCallback(async () => {
    try {
      const result = await queryEvents(client, toQuery(filters));
      setEvents(result);
      setMessage("");
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

  const toolbar = (
    <>
      <span className="count-pill">{count(events.length, "event")}</span>
      <Toggle checked={autoRefresh} onChange={setAutoRefresh} label="Auto-refresh" />
      <IconButton icon="refresh" label="Refresh" onClick={load} />
    </>
  );

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Observability" title="Policy trace" subtitle="Inspect requests, policy steps, and custom-node logs." />

      <Card title="Filters" actions={toolbar}>
        <div className="form-grid dense-grid">
          <Field label="Limit"><input type="number" min="1" max="1000" value={filters.limit} onChange={(e) => update("limit", Number(e.target.value))} /></Field>
          <Field label="Category"><select value={filters.category} onChange={(e) => update("category", e.target.value)}><option value="">any</option><option value="observability">observability</option><option value="custom_node">custom_node</option></select></Field>
          <Field label="Type"><select value={filters.type} onChange={(e) => update("type", e.target.value)}>{EVENT_TYPES.map((t) => <option key={t} value={t}>{t || "any"}</option>)}</select></Field>
          <Field label="Level"><select value={filters.level} onChange={(e) => update("level", e.target.value)}><option value="">any</option><option value="debug">debug</option><option value="info">info</option><option value="warning">warning</option><option value="error">error</option></select></Field>
          <Field label="Policy"><select value={filters.policyId} onChange={(e) => update("policyId", e.target.value)}><option value="">any</option>{policies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Request ID"><input value={filters.requestId} onChange={(e) => update("requestId", e.target.value)} placeholder="hex" /></Field>
          <Field label="Minutes"><input value={filters.windowMinutes} onChange={(e) => update("windowMinutes", e.target.value)} placeholder="15" /></Field>
          <Field label="Search"><input value={filters.search} onChange={(e) => update("search", e.target.value)} placeholder="keyword" /></Field>
        </div>
        {message && <p className="inline-note">{message}</p>}
      </Card>

      <Card title="Events" actions={<span className="count-pill">{count(events.length, "event")}</span>}>
        <div className="event-table" role="list">
          {events.map((event, index) => (
            <button className="event-row" key={eventKey(event, index)} type="button" onClick={() => setOpenIndex(index)} role="listitem">
              <span>{formatTime(event)}</span>
              <strong>{text(event, "type") || "event"}</strong>
              <small>{text(event, "policyName") || text(event, "source")}</small>
              <em>{text(event, "level")}</em>
            </button>
          ))}
          {events.length === 0 && <p className="muted">No events match these filters. Start the proxy and browse to generate activity.</p>}
        </div>
      </Card>

      {selected && (
        <Modal
          title={text(selected, "type") || "Event"}
          subtitle={<span className="inspector-badge node">{text(selected, "level") || "info"}</span>}
          onClose={() => setOpenIndex(null)}
          wide
        >
          {timeline.length > 1 && (
            <div className="timeline-block">
              <h3>Request timeline · {count(timeline.length, "event")}</h3>
              {timeline.map((event, index) => (
                <div className="timeline-row" key={eventKey(event, index)}>
                  <span>{index + 1}</span>
                  <div><strong>{text(event, "type")}</strong> <small>{text(event, "message")}</small></div>
                </div>
              ))}
            </div>
          )}
          <div className="code-readonly">
            <div className="code-readonly-head">Payload</div>
            <pre>{JSON.stringify(selected, null, 2)}</pre>
          </div>
        </Modal>
      )}
    </div>
  );
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
