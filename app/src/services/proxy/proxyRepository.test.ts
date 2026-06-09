import { describe, expect, it } from "vitest";

import { createDefaultConfig } from "../../models/config/defaultConfig";
import { readRecentEvents, startProxy, stopProxy, getProxyStatus } from "./proxyRepository";

class FakeClient {
  calls: Array<{ command: string; args?: Record<string, unknown> }> = [];

  async invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    this.calls.push({ command, args });
    if (command === "proxy_status") {
      return { running: true } as T;
    }
    if (command === "read_recent_events") {
      return [{ type: "log" }] as T;
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
    await expect(readRecentEvents(client, 10)).resolves.toEqual([{ type: "log" }]);
  });
});
