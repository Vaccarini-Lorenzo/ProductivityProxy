import { describe, expect, it } from "vitest";

import { formatDuration } from "@app/components/ModeTransitionNotice";
import { cancelModeSwitch, getModeRuntimeStatus, requestModeSwitch } from "@app/services/modes/modeRepository";

class FakeClient {
  calls: Array<{ command: string; args?: Record<string, unknown> }> = [];

  async invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    this.calls.push({ command, args });
    return { activeModeId: "productivity", frictionSeconds: 1200, pending: null } as T;
  }
}

describe("modeRepository", () => {
  it("formats the configured 20-minute countdown", () => {
    expect(formatDuration(1200)).toBe("20:00");
    expect(formatDuration(59)).toBe("00:59");
  });

  it("reads runtime status", async () => {
    const client = new FakeClient();

    await expect(getModeRuntimeStatus(client)).resolves.toEqual({ activeModeId: "productivity", frictionSeconds: 1200, pending: null });
    expect(client.calls[0]).toEqual({ command: "mode_runtime_status", args: undefined });
  });

  it("requests and cancels mode switches", async () => {
    const client = new FakeClient();

    await requestModeSwitch(client, "chilling");
    await cancelModeSwitch(client);

    expect(client.calls).toEqual([
      { command: "request_mode_switch", args: { targetModeId: "chilling" } },
      { command: "cancel_mode_switch", args: undefined },
    ]);
  });
});
