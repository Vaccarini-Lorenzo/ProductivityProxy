import { createDefaultConfig } from "./models/config/defaultConfig";
import "./styles.css";

export function App() {
  const config = createDefaultConfig();
  const activeMode = config.modes.find((mode) => mode.id === config.activeModeId);

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Local traffic policy engine</p>
        <h1>ProductivityProxy</h1>
        <p className="status">Proxy stopped</p>
      </section>

      <section className="panel">
        <h2>Active mode</h2>
        <p>{activeMode?.name ?? "No mode selected"}</p>
      </section>

      <section className="panel">
        <h2>Proxy</h2>
        <p>Local: 127.0.0.1:{config.proxy.port}</p>
        <p>LAN sharing: {config.proxy.allowLan ? "on" : "off"}</p>
      </section>
    </main>
  );
}
