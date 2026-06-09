import type { ProxyEvent } from "../services/proxy/proxyRepository";

interface Props {
  events: ProxyEvent[];
  onRefresh: () => void;
}

export function EventsPanel({ events, onRefresh }: Props) {
  return (
    <section className="panel" aria-labelledby="events-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Events</p>
          <h2 id="events-heading">Recent proxy events</h2>
        </div>
        <button type="button" onClick={onRefresh}>Refresh events</button>
      </div>
      <div className="event-list" aria-live="polite">
        {events.length === 0 ? <p className="muted">No events loaded.</p> : null}
        {events.map((event, index) => (
          <pre key={index}>{JSON.stringify(event, null, 2)}</pre>
        ))}
      </div>
    </section>
  );
}
