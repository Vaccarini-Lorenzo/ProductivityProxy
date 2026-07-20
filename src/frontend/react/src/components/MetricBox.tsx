import type { ReactNode } from "react";

export function MetricBox({ label, value, unit, meta, cap, ticks, xTicks, accent, children }: {
  label: string;
  value: ReactNode;
  unit?: string;
  meta?: string;
  cap?: string;
  ticks: string[];
  xTicks: string[];
  accent: "cpu" | "mem" | "lat" | "net";
  children: ReactNode;
}) {
  return (
    <div className={`metric-box ${accent}`}>
      <div className="mb-top">
        <span>{label}</span>
        {cap && <small>{cap}</small>}
      </div>
      <div className="mb-graph">
        <div className="mb-axis" aria-hidden="true">
          {ticks.map((tick, index) => <span key={`${tick}-${index}`}>{tick}</span>)}
        </div>
        <div className="mb-plot">{children}</div>
        <div />
        <div className="mb-xaxis" aria-hidden="true">{xTicks.map((tick, index) => <span key={`${tick}-${index}`}>{tick}</span>)}</div>
      </div>
      <div className="mb-bar">
        <span className="mb-reading">{value}{unit && <small>{unit}</small>}</span>
        {meta && <span className="mb-meta">{meta}</span>}
      </div>
    </div>
  );
}
