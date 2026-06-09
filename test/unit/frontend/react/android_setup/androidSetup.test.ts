import { describe, expect, it } from "vitest";

import { androidSetupText } from "@app/services/network/androidSetup";

describe("androidSetupText", () => {
  it("formats proxy setup details", () => {
    expect(androidSetupText("172.20.10.2", 8080)).toContain("Proxy hostname: 172.20.10.2");
    expect(androidSetupText("172.20.10.2", 8080)).toContain("Proxy port: 8080");
  });
});
