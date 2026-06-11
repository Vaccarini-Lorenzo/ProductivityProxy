import { useCallback, useEffect, useMemo, useState } from "react";
import type { CommandClient } from "../services/config/configRepository";
import { queryEvents, type ProxyEvent } from "../services/proxy/proxyRepository";
import { EVENT_POLL_MS } from "../services/proxy/polling";
import { errorMessage } from "../services/errors/errorMessage";
import { Select } from "./Select";
import { MetricBox } from "./MetricBox";
import { useProxyResources } from "./useProxyResources";
import { Sparkline, formatBytes, formatMs, percentile, type Bucket } from "./charts";
import { Card } from "./ui";

interface Props {
  client: CommandClient;
  autoRefresh: boolean;
}

const WINDOW_OPTIONS = [
  { value: "15", label: "last 15 min" },
  { value: "30", label: "last 30 min" },
  { value: "60", label: "last hour" },
  { value: "180", label: "last 3 hours" },
];
const BUCKETS = 40;
const MAX_EVENTS = 200000;

interface Stats {
  buckets: Bucket[];
  total: number;
  blocked: number;
  bytes: number;
  withBytes: number;
  latSamples: number;
  latP50: number;
  latP95: number;
  maxRequests: number;
  maxBytes: number;
  maxLatency: number;
  truncated: boolean;
}

/** Resource consumption as four always-visible tiles. Each tile is just the
 * graph plus a compact value bar pinned to the bottom; no expand/collapse. */
export function ResourcePanel({ client, autoRefresh }: Props) {
  const [windowMinutes, setWindowMinutes] = useState("15");
  const [events, setEvents] = useState<ProxyEvent[]>([]);
  const [message, setMessage] = useState("");
  const { resources, cpu, mem, message: sysMessage } = useProxyResources(client, autoRefresh);

  const load = useCallback(async () => {
    const since = Date.now() / 1000 - Number(windowMinutes) * 60;
    try {
      setEvents(await queryEvents(client, { type: "request_finished", limit: MAX_EVENTS, since }));
      setMessage("");
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }, [client, windowMinutes]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(load, EVENT_POLL_MS);
    return () => window.clearInterval(id);
  }, [autoRefresh, load]);

  const windowMins = Number(windowMinutes);
  const stats = useMemo(() => aggregate(events, windowMins), [events, windowMins]);
  const windowSelect = <Select ariaLabel="Resource window" value={windowMinutes} options={WINDOW_OPTIONS} onChange={setWindowMinutes} />;
  const xTicks = timeTicks(windowMins);
  const running = resources?.running ?? false;
  const cpuNow = cpu.length ? cpu[cpu.length - 1] : resources?.cpuPercent ?? 0;
  const memNow = mem.length ? mem[mem.length - 1] : resources?.memBytes ?? 0;
  const latency = stats.buckets.map((b) => b.latMax);
  const traffic = stats.buckets.map((b) => b.total);
  const memScale = niceScale(Math.max(...mem, memNow, 1));
  const latScale = niceScale(Math.max(stats.maxLatency, stats.latP95, 1));
  const trafficScale = niceCount(stats.maxRequests);
  const [memValue, memUnit] = splitUnit(running ? formatBytes(memNow) : "—");
  const [latValue, latUnit] = splitUnit(stats.latSamples ? formatMs(stats.latP95) : "—");
  const trafficSub = stats.total ? `${percent(stats.blocked, stats.total)} blocked${stats.withBytes ? ` · ${formatBytes(stats.bytes)} out` : ""}` : undefined;

  return (
    <Card title="Resource consumption" actions={windowSelect} className="resource-card">
      {(message || sysMessage) && <p className="inline-note">{message || sysMessage}</p>}
      <div className="metric-boxes">
        <MetricBox label="CPU" accent="cpu" value={running ? cpuNow.toFixed(1) : "—"} unit={running ? "%" : undefined} meta={running ? `peak ${Math.max(...cpu, cpuNow, 0).toFixed(1)}%` : "stopped"} cap="100%" ticks={["100%", "75%", "50%", "25%", "0%"]} xTicks={xTicks}>
          <Sparkline values={cpu} variant="cpu" mini min={0} max={100} />
        </MetricBox>

        <MetricBox label="Memory" accent="mem" value={memValue} unit={memUnit} meta={running ? `peak ${formatBytes(Math.max(...mem, memNow, 0))}` : "stopped"} cap={formatBytes(memScale)} ticks={byteTicks(memScale)} xTicks={xTicks}>
          <Sparkline values={mem} variant="mem" mini min={0} max={memScale} />
        </MetricBox>

        <MetricBox label="Engine latency" accent="lat" value={latValue} unit={latUnit} meta={stats.latSamples ? `p95 · p50 ${formatMs(stats.latP50)} · max ${formatMs(stats.maxLatency)}` : "no data"} cap={formatMs(latScale)} ticks={msTicks(latScale)} xTicks={xTicks}>
          <Sparkline values={latency} variant="lat" mini min={0} max={latScale} />
        </MetricBox>

        <MetricBox label="Traffic" accent="net" value={stats.total.toLocaleString()} unit="requests" meta={trafficSub} cap={`${formatCount(trafficScale)} req`} ticks={countTicks(trafficScale)} xTicks={xTicks}>
          <Sparkline values={traffic} variant="net" mini min={0} max={trafficScale} />
        </MetricBox>
      </div>
      {stats.truncated && <p className="inline-note">Showing the most recent {MAX_EVENTS.toLocaleString()} requests in this window.</p>}
    </Card>
  );
}

function aggregate(events: ProxyEvent[], windowMinutes: number): Stats {
  const bucketMs = (windowMinutes * 60 * 1000) / BUCKETS;
  const startSlot = Math.floor(Date.now() / bucketMs) - (BUCKETS - 1);
  const buckets: Bucket[] = Array.from({ length: BUCKETS }, () => ({ total: 0, blocked: 0, bytes: 0, latSum: 0, latCount: 0, latMax: 0 }));
  const latencies: number[] = [];
  let total = 0;
  let blocked = 0;
  let bytes = 0;
  let withBytes = 0;

  for (const event of events) {
    const ts = typeof event.timestamp === "number" ? event.timestamp * 1000 : NaN;
    if (!Number.isFinite(ts)) continue;
    const index = Math.floor(ts / bucketMs) - startSlot;
    if (index < 0 || index >= BUCKETS) continue;
    const size = typeof event.requestBytes === "number" ? event.requestBytes : 0;
    const isBlocked = event.outcome === "blocked";
    const bucket = buckets[index];
    bucket.total += 1;
    bucket.bytes += size;
    if (isBlocked) bucket.blocked += 1;
    if (typeof event.evalMs === "number") {
      bucket.latSum += event.evalMs;
      bucket.latCount += 1;
      bucket.latMax = Math.max(bucket.latMax, event.evalMs);
      latencies.push(event.evalMs);
    }
    total += 1;
    bytes += size;
    if (typeof event.requestBytes === "number") withBytes += 1;
    if (isBlocked) blocked += 1;
  }

  return {
    buckets,
    total,
    blocked,
    bytes,
    withBytes,
    latSamples: latencies.length,
    latP50: percentile(latencies, 50),
    latP95: percentile(latencies, 95),
    maxRequests: buckets.reduce((max, b) => Math.max(max, b.total), 0),
    maxBytes: buckets.reduce((max, b) => Math.max(max, b.bytes), 0),
    maxLatency: buckets.reduce((max, b) => Math.max(max, b.latMax), 0),
    truncated: events.length >= MAX_EVENTS,
  };
}

function splitUnit(text: string): [string, string] {
  const match = text.match(/^(.+)\s([^\s]+)$/);
  return match ? [match[1], match[2]] : [text, ""];
}

function niceScale(value: number): number {
  const safe = Math.max(value, 1);
  const pow = 10 ** Math.floor(Math.log10(safe));
  return Math.ceil(safe / pow) * pow;
}

function niceCount(value: number): number {
  if (value <= 1) return 1;
  return Math.ceil(value / 5) * 5;
}

function byteTicks(max: number): string[] {
  return [max, max * 0.75, max * 0.5, max * 0.25, 0].map(formatBytes);
}

function msTicks(max: number): string[] {
  return [max, max * 0.75, max * 0.5, max * 0.25, 0].map(formatMs);
}

function countTicks(max: number): string[] {
  return [max, max * 0.75, max * 0.5, max * 0.25, 0].map((value) => formatCount(value));
}

function formatCount(value: number): string {
  return Math.round(value).toLocaleString();
}

function timeTicks(minutes: number): string[] {
  const step = Math.max(1, Math.round(minutes / 3));
  return [`-${minutes}m`, `-${minutes - step}m`, `-${step}m`, "now"];
}

function percent(part: number, whole: number): string {
  if (whole === 0) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}
