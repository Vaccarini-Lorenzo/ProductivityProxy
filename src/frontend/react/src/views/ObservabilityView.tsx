import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppConfig } from "../models/config/types";
import type { CommandClient } from "../services/config/configRepository";
import { queryEvents, type EventQuery, type ProxyEvent } from "../services/proxy/proxyRepository";
import { EVENT_POLL_MS } from "../services/proxy/polling";
import { errorMessage } from "../services/errors/errorMessage";
import { Select } from "../components/Select";
import { Card, Field, FieldGroup, Icon, IconButton, Modal, PageHeader, SearchInput, Toggle, count } from "../components/ui";

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
const EVENT_TYPE_OPTIONS = EVENT_TYPES.map((type) => ({ value: type, label: type || "any" }));
const LEVEL_OPTIONS = ["", "debug", "info", "warning", "error"].map((level) => ({ value: level, label: level || "any" }));
const CATEGORY_OPTIONS = ["", "observability", "custom_node"].map((category) => ({ value: category, label: category || "any" }));

export function ObservabilityView({ client, config }: Props) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [events, setEvents] = useState<ProxyEvent[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [message, setMessage] = useState("");
  const policyOptions = useMemo(() => [{ value: "", label: "any" }, ...config.policies.map((p) => ({ value: p.id, label: p.name }))], [config.policies]);
  const selected = openIndex === null ? undefined : events[openIndex];
  const requestId = text(selected, "requestId");
  const timeline = requestId ? events.filter((e) => text(e, "requestId") === requestId) : [];

  const load = useCallback(async () => {
    try {
      const result = await queryEvents(client, toQuery(filters));
      setEvents(result);
      setMessage("");
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }, [client, filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(load, EVENT_POLL_MS);
    return () => window.clearInterval(id);
  }, [autoRefresh, load]);

  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  const toolbar = (
    <>
      <Toggle checked={autoRefresh} onChange={setAutoRefresh} label="Auto-refresh" />
      <IconButton icon="refresh" label="Refresh" onClick={load} />
    </>
  );

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Observability" title="Policy trace" subtitle="Inspect requests, policy steps, and custom-node logs." />

      <Card title="Filters" icon="search" actions={toolbar}>
        <SearchInput value={filters.search} onChange={(v) => update("search", v)} placeholder="Search events…" ariaLabel="Search events" />
        <div className="filter-grid">
          <FieldGroup label="Type"><Select ariaLabel="Filter by event type" value={filters.type} options={EVENT_TYPE_OPTIONS} onChange={(v) => update("type", v)} /></FieldGroup>
          <FieldGroup label="Level"><Select ariaLabel="Filter by level" value={filters.level} options={LEVEL_OPTIONS} onChange={(v) => update("level", v)} /></FieldGroup>
          <FieldGroup label="Category"><Select ariaLabel="Filter by category" value={filters.category} options={CATEGORY_OPTIONS} onChange={(v) => update("category", v)} /></FieldGroup>
          <FieldGroup label="Policy"><Select ariaLabel="Filter by policy" value={filters.policyId} options={policyOptions} onChange={(v) => update("policyId", v)} /></FieldGroup>
          <Field label="Request ID"><input value={filters.requestId} onChange={(e) => update("requestId", e.target.value)} placeholder="hex" /></Field>
          <Field label="Minutes"><input value={filters.windowMinutes} onChange={(e) => update("windowMinutes", e.target.value)} placeholder="15" /></Field>
          <Field label="Limit"><input type="number" min="1" max="1000" value={filters.limit} onChange={(e) => update("limit", Number(e.target.value))} /></Field>
        </div>
        {message && <p className="inline-note">{message}</p>}
      </Card>

      <Card title="Events" actions={<span className="count-pill"><span className="dot" />{count(events.length, "event")}</span>}>
        <div className="event-table" role="list">
          {events.length > 0 && (
            <div className="event-head"><span>Timestamp</span><span>Event type</span><span>Source / Policy</span><span>Level</span></div>
          )}
          {events.map((event, index) => (
            <button className="event-row" key={eventKey(event, index)} type="button" onClick={() => setOpenIndex(index)} role="listitem">
              <span>{formatTime(event)}</span>
              <strong>{text(event, "type") || "event"}</strong>
              <small>{text(event, "policyName") || text(event, "source")}</small>
              <em>{text(event, "level")}</em>
            </button>
          ))}
          {events.length === 0 && (
            <div className="empty-state">
              <Icon name="inbox" />
              <p>No events match these filters. Start the proxy and browse to generate activity.</p>
            </div>
          )}
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
