import { describe, expect, it } from "vitest";

import { rememberNotificationEvents, showNotificationEvents } from "@app/services/notifications/notificationService";

class FakeNotifier {
  sent: Array<{ title: string; body: string }> = [];

  async notify(title: string, body: string): Promise<void> {
    this.sent.push({ title, body });
  }
}

describe("showNotificationEvents", () => {
  it("can mark existing notifications as already seen", async () => {
    const seen = rememberNotificationEvents([{ type: "notification", title: "Old", body: "Already loaded" }]);
    const notifier = new FakeNotifier();

    await showNotificationEvents(notifier, [{ type: "notification", title: "Old", body: "Already loaded" }], seen);

    expect(notifier.sent).toEqual([]);
  });

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

  it("forgets keys that are no longer in the recent event window", async () => {
    const notifier = new FakeNotifier();
    const old = { type: "notification", title: "Old", body: "Gone" };
    const current = { type: "notification", title: "Current", body: "Visible" };
    const seen = rememberNotificationEvents([old, current]);

    const nextSeen = await showNotificationEvents(notifier, [current], seen);

    expect(nextSeen.size).toBe(1);
    expect(notifier.sent).toEqual([]);
  });
});
