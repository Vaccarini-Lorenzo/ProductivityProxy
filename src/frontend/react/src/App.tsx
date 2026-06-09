import { useEffect, useRef, useState } from "react";

import { TerminalNav, type View } from "./components/TerminalNav";
import { OperatorsView } from "./views/OperatorsView";
import { PoliciesView } from "./views/PoliciesView";
import { SettingsView } from "./views/SettingsView";
import { createDefaultConfig } from "./models/config/defaultConfig";
import type { AppConfig } from "./models/config/types";
import { loadConfig, saveConfig, writeCustomBlock, type CommandClient } from "./services/config/configRepository";
import { validateAppConfig } from "./services/config/configValidation";
import { showNotificationEvents, type Notifier } from "./services/notifications/notificationService";
import { tauriNotifier } from "./services/notifications/tauriNotifier";
import { getProxyStatus, readRecentEvents, startProxy, stopProxy, type ProxyEvent, type ProxyStatus } from "./services/proxy/proxyRepository";
import { tauriClient } from "./services/tauri/tauriClient";
import "./styles.css";

interface Props {
  client?: CommandClient;
  notifier?: Notifier;
}

export function App({ client = tauriClient, notifier = tauriNotifier }: Props) {
  const [view, setView] = useState<View>("policies");
  const [config, setConfig] = useState<AppConfig>(() => createDefaultConfig());
  const [status, setStatus] = useState<ProxyStatus>({ running: false });
  const [events, setEvents] = useState<ProxyEvent[]>([]);
  const [message, setMessage] = useState("");
  const seenNotifications = useRef(new Set<string>());

  useEffect(() => {
    loadConfig(client).then(setConfig).catch(showError);
    getProxyStatus(client).then(setStatus).catch(showError);
    readRecentEvents(client, 50).then(setEvents).catch(showError);
  }, [client]);

  useEffect(() => {
    showNotificationEvents(notifier, events, seenNotifications.current)
      .then((seen) => { seenNotifications.current = seen; })
      .catch(showError);
  }, [events, notifier]);

  function showError(error: unknown) {
    const text = error instanceof Error ? error.message : String(error);
    setMessage(text.includes("invoke") ? "Browser preview — Tauri unavailable" : text);
  }

  async function handleSave() {
    const errors = validateAppConfig(config);
    if (errors.length > 0) { setMessage(errors.join(". ")); return; }
    await saveConfig(client, config).then(() => setMessage("Saved")).catch(showError);
  }

  async function handleStart() {
    await startProxy(client, config).then(() => setStatus({ running: true })).catch(showError);
  }

  async function handleStop() {
    await stopProxy(client).then(() => setStatus({ running: false })).catch(showError);
  }

  async function handleSaveBlock(name: string, fileName: string, entrypoint: string, code: string) {
    const path = await writeCustomBlock(client, fileName, code).catch((e) => { showError(e); return ""; });
    if (!path) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "block";
    setConfig({ ...config, customBlocks: [...config.customBlocks, { id, name, path, entrypoint }] });
    setMessage("Operator saved");
  }

  function handleDeleteBlock(id: string) {
    setConfig({ ...config, customBlocks: config.customBlocks.filter((b) => b.id !== id) });
  }

  function renderView() {
    switch (view) {
      case "settings":
        return <SettingsView proxy={config.proxy} running={status.running} onChange={(proxy) => setConfig({ ...config, proxy })} onStart={handleStart} onStop={handleStop} />;
      case "operators":
        return <OperatorsView blocks={config.customBlocks} onSave={handleSaveBlock} onDelete={handleDeleteBlock} />;
      case "policies":
        return <PoliciesView config={config} onConfigChange={setConfig} />;
    }
  }

  return (
    <div className="app-frame">
      <TerminalNav active={view} running={status.running} onNavigate={setView} />
      <main className="app-shell">
        <div className="top-bar">
          <button className="primary" type="button" onClick={handleSave}>Save config</button>
          {message && <span className="message" role="status">{message}</span>}
        </div>
        {renderView()}
      </main>
    </div>
  );
}
