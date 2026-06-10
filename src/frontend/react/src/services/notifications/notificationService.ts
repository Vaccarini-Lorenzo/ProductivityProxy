import type { ProxyEvent } from "../proxy/proxyRepository";

export interface Notifier {
  notify(title: string, body: string): Promise<void>;
}

export function rememberNotificationEvents(events: ProxyEvent[], seen: Set<string>): Set<string> {
  const nextSeen = new Set(seen);
  for (const event of events) {
    if (event.type === "notification") nextSeen.add(notificationKey(event));
  }
  return nextSeen;
}

export async function showNotificationEvents(notifier: Notifier, events: ProxyEvent[], seen: Set<string>): Promise<Set<string>> {
  const nextSeen = new Set(seen);
  for (const event of events) {
    if (event.type !== "notification") continue;
    const key = notificationKey(event);
    if (nextSeen.has(key)) continue;
    nextSeen.add(key);
    await notifier.notify(String(event.title ?? "ProductivityProxy"), String(event.body ?? ""));
  }
  return nextSeen;
}

function notificationKey(event: ProxyEvent): string {
  return JSON.stringify(event);
}
