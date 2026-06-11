import { useCallback, useEffect, useState } from "react";
import type { CommandClient } from "../services/config/configRepository";
import { getProxyResources, type ProxyResources } from "../services/proxy/proxyRepository";
import { STATUS_POLL_MS } from "../services/proxy/polling";
import { errorMessage } from "../services/errors/errorMessage";

const HISTORY = 60;

export interface ProxyResourceState {
  resources: ProxyResources | null;
  cpu: number[];
  mem: number[];
  message: string;
}

/** Polls the proxy process resource sample (CPU/mem/uptime, taken from the Rust
 * side via `ps`) and keeps a short rolling history for the sparklines,
 * independent of the traffic window. */
export function useProxyResources(client: CommandClient, autoRefresh: boolean): ProxyResourceState {
  const [resources, setResources] = useState<ProxyResources | null>(null);
  const [cpu, setCpu] = useState<number[]>([]);
  const [mem, setMem] = useState<number[]>([]);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const next = await getProxyResources(client);
      setResources(next);
      setMessage("");
      if (next.running) {
        setCpu((history) => [...history, next.cpuPercent ?? 0].slice(-HISTORY));
        setMem((history) => [...history, next.memBytes ?? 0].slice(-HISTORY));
      } else {
        setCpu([]);
        setMem([]);
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

  return { resources, cpu, mem, message };
}
