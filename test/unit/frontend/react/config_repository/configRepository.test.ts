import { describe, expect, it } from "vitest";

import { createDefaultConfig } from "@app/models/config/defaultConfig";
import { loadConfig, saveConfig, writeCustomNode } from "@app/services/config/configRepository";

class FakeClient {
  calls: Array<{ command: string; args?: Record<string, unknown> }> = [];

  async invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    this.calls.push({ command, args });
    if (command === "read_app_config") {
      return createDefaultConfig() as T;
    }
    if (command === "write_custom_node") {
      return "custom_nodes/test.py" as T;
    }
    return undefined as T;
  }
}

describe("configRepository", () => {
  it("loads config through command client", async () => {
    const client = new FakeClient();

    const config = await loadConfig(client);

    expect(config.activeModeId).toBe("productivity");
    expect(client.calls[0].command).toBe("read_app_config");
  });

  it("saves config through command client", async () => {
    const client = new FakeClient();
    const config = createDefaultConfig();

    await saveConfig(client, config);

    expect(client.calls[0]).toEqual({ command: "write_app_config", args: { config } });
  });

  it("writes custom node code through command client", async () => {
    const client = new FakeClient();

    const path = await writeCustomNode(client, "test.py", "def run(input, context, params): pass");

    expect(path).toBe("custom_nodes/test.py");
    expect(client.calls[0].command).toBe("write_custom_node");
  });
});
