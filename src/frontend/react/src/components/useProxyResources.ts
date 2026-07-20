import { useCallback, useEffect, useState } from "react";
import type { CommandClient } from "../services/config/configRepository";
import { getProxyResources, type ProxyResources } from "../services/proxy/proxyRepository";
import { STATUS_POLL_MS } from "../services/proxy/polling";
import { errorMessage } from "../services/errors/errorMessage";

const RESOURCE_HISTORY_MS = 180 * 60_000;

export interface ProxyResourceSample {
  sampledAtMs: number;
  pid?: number;
  cpuPercent: number;
  memBytes: number;
}

export interface ProxyResourceState {
  resources: ProxyResources | null;
  samples: ProxyResourceSample[];
  message: string;
}

/** Polls proxy CPU/RSS via the Rust side and retains the largest selectable
 * window. The view filters this timestamped history without losing older data. */
export function useProxyResources(client: CommandClient, autoRefresh: boolean): ProxyResourceState {
  const [resources, setResources] = useState<ProxyResources | null>(null);
  const [samples, setSamples] = useState<ProxyResourceSample[]>([]);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const next = await getProxyResources(client);
      setResources(next);
      setMessage("");
      if (next.running) {
        const sample = {
          sampledAtMs: Date.now(),
          pid: next.pid,
          cpuPercent: next.cpuPercent ?? 0,
          memBytes: next.memBytes ?? 0,
        };
        setSamples((history) => {
          const sameProcess = history.length === 0 || history[history.length - 1].pid === sample.pid;
          const current = sameProcess ? history : [];
          const cutoff = sample.sampledAtMs - RESOURCE_HISTORY_MS;
          return [...current, sample].filter((item) => item.sampledAtMs >= cutoff);
        });
      } else {
        setSamples([]);
      }
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(load, STATUS_POLL_MS);
    return () => window.clearInterval(id);
  }, [autoRefresh, load]);

  return { resources, samples, message };
}
