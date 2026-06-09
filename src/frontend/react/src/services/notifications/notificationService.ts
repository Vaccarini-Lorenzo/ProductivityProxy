import type { ProxyEvent } from "../proxy/proxyRepository";

export interface Notifier {
  notify(title: string, body: string): Promise<void>;
}

export async function showNotificationEvents(notifier: Notifier, events: ProxyEvent[], seen: Set<string>): Promise<Set<string>> {
  const nextSeen = new Set(seen);
  for (const event of events) {
    if (event.type !== "notification") continue;
    const key = JSON.stringify(event);
    if (nextSeen.has(key)) continue;
    nextSeen.add(key);
    await notifier.notify(String(event.title ?? "ProductivityProxy"), String(event.body ?? ""));
  }
  return nextSeen;
}
