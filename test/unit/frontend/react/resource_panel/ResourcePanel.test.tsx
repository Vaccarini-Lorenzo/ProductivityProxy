import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { samplesInWindow, timeTicks } from "@app/components/ResourcePanel";
import { Sparkline } from "@app/components/charts";
import type { ProxyResourceSample } from "@app/components/useProxyResources";

describe("resource chart windows", () => {
  it("formats fixed ticks for each selectable window", () => {
    expect(timeTicks(15)).toEqual(["-15m", "-10m", "-5m", "now"]);
    expect(timeTicks(30)).toEqual(["-30m", "-20m", "-10m", "now"]);
    expect(timeTicks(60)).toEqual(["-1h", "-40m", "-20m", "now"]);
    expect(timeTicks(180)).toEqual(["-3h", "-2h", "-1h", "now"]);
  });

  it("filters retained samples when the selected window changes", () => {
    const now = 4 * 60 * 60_000;
    const samples: ProxyResourceSample[] = [
      sample(now - 45 * 60_000),
      sample(now - 20 * 60_000),
      sample(now - 5 * 60_000),
    ];

    expect(samplesInWindow(samples, 15, now)).toHaveLength(1);
    expect(samplesInWindow(samples, 30, now)).toHaveLength(2);
    expect(samplesInWindow(samples, 60, now)).toHaveLength(3);
  });

  it("positions partial history inside the selected wall-clock window", () => {
    const hour = 60 * 60_000;
    const markup = renderToStaticMarkup(
      <Sparkline
        values={[25, 50]}
        timestamps={[hour / 2, hour]}
        startMs={0}
        endMs={hour}
        variant="cpu"
        min={0}
        max={100}
      />,
    );

    expect(markup).toContain("M300.0,");
    expect(markup).toContain("L600.0,");
  });
});

function sample(sampledAtMs: number): ProxyResourceSample {
  return { sampledAtMs, pid: 1, cpuPercent: 1, memBytes: 1 };
}
