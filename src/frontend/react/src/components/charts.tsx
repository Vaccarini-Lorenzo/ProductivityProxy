import { useId } from "react";

export interface Bucket {
  total: number;
  blocked: number;
  bytes: number;
  latSum: number;
  latCount: number;
  latMax: number;
}

const VIEW_W = 600;

/** Smooth, gradient-filled area sparkline with a glowing line and an end dot.
 * `variant` (cpu | mem | lat | bytes) selects the accent colour via CSS. */
export function Sparkline({ values, variant, height = 120, mini = false, min, max }: { values: number[]; variant: string; height?: number; mini?: boolean; min?: number; max?: number }) {
  const gradientId = useId();
  const lo = min ?? (values.length ? Math.min(...values) : 0);
  const hi = max ?? (values.length ? Math.max(...values) : 1);
  const pad = min === undefined && max === undefined ? (hi - lo || Math.abs(hi) || 1) * 0.15 : 0;
  const bottom = lo - pad;
  const span = hi + pad - bottom || 1;
  const points = values.map((value, index) => {
    const x = values.length > 1 ? (index / (values.length - 1)) * VIEW_W : 0;
    const y = height - ((value - bottom) / span) * height;
    return [x, y] as const;
  });
  const line = smoothPath(points);
  const area = points.length ? `${line} L${VIEW_W},${height} L0,${height} Z` : "";
  const last = points[points.length - 1];

  return (
    <svg className={`resource-chart spark ${variant}`} viewBox={`0 0 ${VIEW_W} ${height}`} preserveAspectRatio={mini ? "none" : undefined} role="img" aria-label={`${variant} over time`}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className="spark-stop-top" />
          <stop offset="100%" className="spark-stop-bottom" />
        </linearGradient>
      </defs>
      {area && <path className="spark-area" d={area} fill={`url(#${gradientId})`} />}
      {line && <path className="spark-line" d={line} fill="none" vectorEffect="non-scaling-stroke" />}
      {!mini && last && <circle className="spark-dot" cx={last[0]} cy={last[1]} r={3.5} vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

/** Stacked request bars (allowed + blocked) with gradient fills, rounded tops
 * and a soft glow. Bars share fixed wall-clock slots so the series slides left
 * over time instead of rescaling in place. */
export function RequestBars({ buckets, max, mini = false }: { buckets: Bucket[]; max: number; mini?: boolean }) {
  const height = 120;
  const allowedId = useId();
  const blockedId = useId();
  const slot = VIEW_W / buckets.length;
  const barW = slot * 0.62;
  return (
    <svg className="resource-chart bars" viewBox={`0 0 ${VIEW_W} ${height}`} preserveAspectRatio={mini ? "none" : undefined} role="img" aria-label="Requests over time">
      <defs>
        <linearGradient id={allowedId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className="bar-allowed-top" />
          <stop offset="100%" className="bar-allowed-bottom" />
        </linearGradient>
        <linearGradient id={blockedId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className="bar-blocked-top" />
          <stop offset="100%" className="bar-blocked-bottom" />
        </linearGradient>
      </defs>
      {buckets.map((bucket, index) => {
        const totalH = max ? (bucket.total / max) * (height - 3) : 0;
        const blockedH = max ? (bucket.blocked / max) * (height - 3) : 0;
        const allowedH = Math.max(0, totalH - blockedH);
        const x = index * slot + (slot - barW) / 2;
        return (
          <g key={index} className="bar-group">
            {allowedH > 0 && <rect className="bar" x={x} y={height - totalH} width={barW} height={allowedH} rx={mini ? 0 : 2.5} fill={`url(#${allowedId})`} />}
            {blockedH > 0 && <rect className="bar" x={x} y={height - blockedH} width={barW} height={blockedH} rx={mini ? 0 : 2.5} fill={`url(#${blockedId})`} />}
          </g>
        );
      })}
    </svg>
  );
}

/** Catmull-Rom spline through the points, emitted as cubic Béziers. */
function smoothPath(points: ReadonlyArray<readonly [number, number]>): string {
  if (points.length === 0) return "";
  if (points.length < 3) return `M${points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L")}`;
  let path = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[Math.max(0, i - 1)];
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const [x3, y3] = points[Math.min(points.length - 1, i + 2)];
    const c1x = x1 + (x2 - x0) / 6;
    const c1y = y1 + (y2 - y0) / 6;
    const c2x = x2 - (x3 - x1) / 6;
    const c2y = y2 - (y3 - y1) / 6;
    path += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
  }
  return path;
}

export function percentile(values: number[], pct: number): number {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const index = Math.min(ordered.length - 1, Math.max(0, Math.round((pct / 100) * (ordered.length - 1))));
  return ordered[index];
}

export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${Math.round(bytes)} B`;
  const units = ["kB", "MB", "GB", "TB"];
  let value = bytes / 1000;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}

export function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  if (ms >= 10) return `${ms.toFixed(1)} ms`;
  return `${ms.toFixed(2)} ms`;
}

export function formatUptime(seconds?: number): string {
  if (seconds === undefined) return "\u2014";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  return `${hours}h ${Math.floor((seconds % 3600) / 60)}m`;
}
