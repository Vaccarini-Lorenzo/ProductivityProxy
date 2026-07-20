import type { ProxyEvent } from "../proxy/proxyRepository";

export interface Notifier {
  notify(title: string, body: string): Promise<void>;
}

export function rememberNotificationEvents(events: ProxyEvent[]): Set<string> {
  return new Set(events.filter((event) => event.type === "notification").map(notificationKey));
}

export async function showNotificationEvents(notifier: Notifier, events: ProxyEvent[], seen: Set<string>): Promise<Set<string>> {
  const nextSeen = new Set<string>();
  for (const event of events) {
    if (event.type !== "notification") continue;
    const key = notificationKey(event);
    if (!seen.has(key)) {
      await notifier.notify(String(event.title ?? "ProductivityProxy"), String(event.body ?? ""));
    }
    nextSeen.add(key);
  }
  return nextSeen;
}

function notificationKey(event: ProxyEvent): string {
  return JSON.stringify(event);
}
