import { describe, expect, it } from "vitest";

import { createDefaultConfig } from "@app/models/config/defaultConfig";
import { readRecentEvents, startProxy, stopProxy, getProxyStatus, queryEvents, getNetworkInfo } from "@app/services/proxy/proxyRepository";

class FakeClient {
  calls: Array<{ command: string; args?: Record<string, unknown> }> = [];

  async invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    this.calls.push({ command, args });
    if (command === "proxy_status") {
      return { running: true } as T;
    }
    if (command === "network_info") {
      return { localHost: "127.0.0.1", lanHost: "192.168.1.10" } as T;
    }
    if (command === "read_recent_events") {
      return [{ type: "log" }] as T;
    }
    if (command === "query_events") {
      return [{ type: "policy_step" }] as T;
    }
    return undefined as T;
  }
}

describe("proxyRepository", () => {
  it("starts proxy with current config", async () => {
    const client = new FakeClient();
    const config = createDefaultConfig();

    await startProxy(client, config);

    expect(client.calls[0]).toEqual({ command: "start_proxy", args: { config } });
  });

  it("stops proxy", async () => {
    const client = new FakeClient();

    await stopProxy(client);

    expect(client.calls[0].command).toBe("stop_proxy");
  });

  it("reads proxy status and recent events", async () => {
    const client = new FakeClient();

    await expect(getProxyStatus(client)).resolves.toEqual({ running: true });
    await expect(getNetworkInfo(client)).resolves.toEqual({ localHost: "127.0.0.1", lanHost: "192.168.1.10" });
    await expect(readRecentEvents(client, 10)).resolves.toEqual([{ type: "log" }]);
  });

  it("queries filtered events", async () => {
    const client = new FakeClient();

    await expect(queryEvents(client, { limit: 25, category: "observability", policyId: "policy" })).resolves.toEqual([{ type: "policy_step" }]);

    expect(client.calls[0]).toEqual({
      command: "query_events",
      args: { query: { limit: 25, category: "observability", policyId: "policy" } },
    });
  });
});
