import type { AppConfig } from "../../models/config/types";
import type { CommandClient } from "../config/configRepository";

export interface ProxyStatus {
  running: boolean;
}

export interface NetworkInfo {
  localHost: string;
  lanHost?: string;
}

export type ProxyEvent = Record<string, unknown>;

export interface EventQuery {
  limit: number;
  category?: string;
  type?: string;
  level?: string;
  source?: string;
  modeId?: string;
  policyId?: string;
  stepId?: string;
  requestId?: string;
  search?: string;
  since?: number;
  until?: number;
}

export function startProxy(client: CommandClient, config: AppConfig): Promise<void> {
  return client.invoke<void>("start_proxy", { config });
}

export function stopProxy(client: CommandClient): Promise<void> {
  return client.invoke<void>("stop_proxy");
}

export function getProxyStatus(client: CommandClient): Promise<ProxyStatus> {
  return client.invoke<ProxyStatus>("proxy_status");
}

export function getNetworkInfo(client: CommandClient): Promise<NetworkInfo> {
  return client.invoke<NetworkInfo>("network_info");
}

export function readRecentEvents(client: CommandClient, limit: number): Promise<ProxyEvent[]> {
  return client.invoke<ProxyEvent[]>("read_recent_events", { limit });
}

export function queryEvents(client: CommandClient, query: EventQuery): Promise<ProxyEvent[]> {
  return client.invoke<ProxyEvent[]>("query_events", { query });
}
