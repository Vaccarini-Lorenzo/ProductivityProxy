import { describe, expect, it } from "vitest";

import { showNotificationEvents } from "./notificationService";

class FakeNotifier {
  sent: Array<{ title: string; body: string }> = [];

  async notify(title: string, body: string): Promise<void> {
    this.sent.push({ title, body });
  }
}

describe("showNotificationEvents", () => {
  it("shows only unseen notification events", async () => {
    const notifier = new FakeNotifier();
    const seen = new Set<string>();

    const nextSeen = await showNotificationEvents(notifier, [
      { type: "notification", title: "Blocked", body: "Reddit" },
      { type: "log", message: "ignored" },
    ], seen);
    await showNotificationEvents(notifier, [{ type: "notification", title: "Blocked", body: "Reddit" }], nextSeen);

    expect(notifier.sent).toEqual([{ title: "Blocked", body: "Reddit" }]);
  });
});
