import { describe, expect, it } from "vitest";

import { createDefaultConfig } from "../../models/config/defaultConfig";
import { loadConfig, saveConfig, writeCustomBlock } from "./configRepository";

class FakeClient {
  calls: Array<{ command: string; args?: Record<string, unknown> }> = [];

  async invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    this.calls.push({ command, args });
    if (command === "read_app_config") {
      return createDefaultConfig() as T;
    }
    if (command === "write_custom_block") {
      return "custom_blocks/test.py" as T;
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

  it("writes custom block code through command client", async () => {
    const client = new FakeClient();

    const path = await writeCustomBlock(client, "test.py", "def run(context, params): pass");

    expect(path).toBe("custom_blocks/test.py");
    expect(client.calls[0].command).toBe("write_custom_block");
  });
});
