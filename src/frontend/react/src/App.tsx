import { useEffect, useRef, useState } from "react";

import { TerminalNav, type View } from "./components/TerminalNav";
import { ModesView } from "./views/ModesView";
import { NodesView, type SaveNodeInput } from "./views/NodesView";
import { ObservabilityView } from "./views/ObservabilityView";
import { PolicyView } from "./views/PolicyView";
import { SettingsView } from "./views/SettingsView";
import { createDefaultConfig } from "./models/config/defaultConfig";
import type { AppConfig } from "./models/config/types";
import { readCustomNode, loadConfig, saveConfig, writeCustomNode, type CommandClient } from "./services/config/configRepository";
import { uniqueSlug } from "./services/config/configEditing";
import { validateAppConfig } from "./services/config/configValidation";
import { showNotificationEvents, type Notifier } from "./services/notifications/notificationService";
import { tauriNotifier } from "./services/notifications/tauriNotifier";
import { getNetworkInfo, getProxyStatus, readRecentEvents, startProxy, stopProxy, type NetworkInfo, type ProxyEvent, type ProxyStatus } from "./services/proxy/proxyRepository";
import { tauriClient } from "./services/tauri/tauriClient";
import "./styles.css";

interface Props {
  client?: CommandClient;
  notifier?: Notifier;
}

export function App({ client = tauriClient, notifier = tauriNotifier }: Props) {
  const [view, setView] = useState<View>("settings");
  const [config, setConfig] = useState<AppConfig>(() => createDefaultConfig());
  const [status, setStatus] = useState<ProxyStatus>({ running: false });
  const [network, setNetwork] = useState<NetworkInfo>();
  const [events, setEvents] = useState<ProxyEvent[]>([]);
  const [message, setMessage] = useState("");
  const seenNotifications = useRef(new Set<string>());

  useEffect(() => {
    loadConfig(client).then(setConfig).catch(showError);
    getProxyStatus(client).then(setStatus).catch(showError);
    getNetworkInfo(client).then(setNetwork).catch(showError);
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
    await saveConfig(client, config).then(() => setMessage("Config saved")).catch(showError);
  }

  async function handleStart() {
    const errors = validateAppConfig(config);
    if (errors.length > 0) { setMessage(errors.join(". ")); return; }
    await startProxy(client, config).then(() => setStatus({ running: true })).catch(showError);
  }

  async function handleStop() {
    await stopProxy(client).then(() => setStatus({ running: false })).catch(showError);
  }

  async function handleSaveNode(input: SaveNodeInput) {
    const path = await writeCustomNode(client, input.fileName, input.code).catch((error) => { showError(error); return ""; });
    if (!path) return;
    const id = input.id ?? uniqueSlug(input.name, config.customNodes.map((node) => node.id));
    const next = { id, name: input.name, path };
    setConfig((current) => ({
      ...current,
      customNodes: current.customNodes.some((node) => node.id === id)
        ? current.customNodes.map((node) => (node.id === id ? next : node))
        : [...current.customNodes, next],
    }));
    setMessage("Node saved. Save config to persist it.");
  }

  function handleDeleteNode(id: string) {
    if (isNodeUsed(config, id)) {
      setMessage("Cannot delete a node used by a policy step.");
      return;
    }
    setConfig({ ...config, customNodes: config.customNodes.filter((node) => node.id !== id) });
  }

  function renderView() {
    switch (view) {
      case "settings":
        return <SettingsView proxy={config.proxy} running={status.running} network={network} onChange={(proxy) => setConfig({ ...config, proxy })} onStart={handleStart} onStop={handleStop} />;
      case "modes":
        return <ModesView config={config} onConfigChange={setConfig} />;
      case "policy":
        return <PolicyView config={config} onConfigChange={setConfig} onReadNode={(path) => readCustomNode(client, path)} />;
      case "nodes":
        return <NodesView nodes={config.customNodes} onSave={handleSaveNode} onRead={(path) => readCustomNode(client, path)} onDelete={handleDeleteNode} />;
      case "observability":
        return <ObservabilityView client={client} config={config} />;
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

function isNodeUsed(config: AppConfig, nodeId: string): boolean {
  return config.modes.some((mode) => mode.policies.some((policy) => policy.steps.some((step) => step.kind === "node" && step.type === nodeId)));
}
