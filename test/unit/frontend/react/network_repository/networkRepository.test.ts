import { describe, expect, it } from "vitest";

import { getNetworkInfo } from "@app/services/network/networkRepository";

class FakeClient {
  async invoke<T>(command: string): Promise<T> {
    expect(command).toBe("network_info");
    return { localHost: "127.0.0.1", lanHost: "172.20.10.2" } as T;
  }
}

describe("networkRepository", () => {
  it("loads network info", async () => {
    await expect(getNetworkInfo(new FakeClient())).resolves.toEqual({
      localHost: "127.0.0.1",
      lanHost: "172.20.10.2",
    });
  });
});
