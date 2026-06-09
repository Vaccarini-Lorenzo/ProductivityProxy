import { useEffect, useMemo, useRef, useState } from "react";

import { CustomBlocksPanel } from "./components/CustomBlocksPanel";
import { EventsPanel } from "./components/EventsPanel";
import { GraphEditor, paramsToText } from "./components/GraphEditor";
import { ModesPanel } from "./components/ModesPanel";
import { NetworkPanel } from "./components/NetworkPanel";
import { ProxySettingsPanel } from "./components/ProxySettingsPanel";
import { StatusPanel } from "./components/StatusPanel";
import { createDefaultConfig } from "./models/config/defaultConfig";
import type { AppConfig, ModeConfig, PolicyGraph } from "./models/config/types";
import { loadConfig, saveConfig, writeCustomBlock, type CommandClient } from "./services/config/configRepository";
import { validateAppConfig } from "./services/config/configValidation";
import { addEdge, addNode, updateNodeParams } from "./services/graph/graphOperations";
import { androidSetupText } from "./services/network/androidSetup";
import { getNetworkInfo, type NetworkInfo } from "./services/network/networkRepository";
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
  const [config, setConfig] = useState<AppConfig>(() => createDefaultConfig());
  const [status, setStatus] = useState<ProxyStatus>({ running: false });
  const [events, setEvents] = useState<ProxyEvent[]>([]);
  const [network, setNetwork] = useState<NetworkInfo>({ localHost: "127.0.0.1", lanHost: null });
  const [message, setMessage] = useState("Ready");
  const [newModeName, setNewModeName] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState("productivity-start");
  const [paramsText, setParamsText] = useState("{}");
  const [edgeFrom, setEdgeFrom] = useState("productivity-start");
  const [edgeTo, setEdgeTo] = useState("productivity-end");
  const [edgeOutput, setEdgeOutput] = useState("next");
  const [blockName, setBlockName] = useState("Custom block");
  const [fileName, setFileName] = useState("custom_block.py");
  const [entrypoint, setEntrypoint] = useState("run");
  const [code, setCode] = useState('def run(context, params):\n    return {"output": "next"}\n');
  const seenNotifications = useRef(new Set<string>());

  const activeMode = useMemo(() => config.modes.find((mode) => mode.id === config.activeModeId) ?? config.modes[0], [config]);

  useEffect(() => {
    loadConfig(client).then(setConfig).catch(showError);
    refreshStatus();
    refreshEvents();
    refreshNetwork();
  }, [client]);

  useEffect(() => {
    const node = activeMode.graph.nodes.find((item) => item.id === selectedNodeId) ?? activeMode.graph.nodes[0];
    if (node) {
      setSelectedNodeId(node.id);
      setParamsText(paramsToText(node.params));
    }
  }, [activeMode.id, selectedNodeId]);

  useEffect(() => {
    showNotificationEvents(notifier, events, seenNotifications.current)
      .then((seen) => {
        seenNotifications.current = seen;
      })
      .catch(showError);
  }, [events, notifier]);

  function showError(error: unknown) {
    setMessage(error instanceof Error ? error.message : String(error));
  }

  async function refreshStatus() {
    getProxyStatus(client).then(setStatus).catch(showError);
  }

  async function refreshEvents() {
    readRecentEvents(client, 50).then(setEvents).catch(showError);
  }

  async function refreshNetwork() {
    getNetworkInfo(client).then(setNetwork).catch(showError);
  }

  async function handleSave() {
    const errors = validateAppConfig(config);
    if (errors.length > 0) {
      setMessage(errors.join(". "));
      return;
    }
    await saveConfig(client, config).then(() => setMessage("Config saved")).catch(showError);
  }

  async function handleStart() {
    await startProxy(client, config).then(() => setStatus({ running: true })).catch(showError);
  }

  async function handleStop() {
    await stopProxy(client).then(() => setStatus({ running: false })).catch(showError);
  }

  function updateGraph(nextGraph: PolicyGraph) {
    setConfig((current) => ({
      ...current,
      modes: current.modes.map((mode) => (mode.id === activeMode.id ? { ...mode, graph: nextGraph } : mode)),
    }));
  }

  function handleAddNode(type: string) {
    const nextGraph = addNode(activeMode.graph, type);
    const node = nextGraph.nodes[nextGraph.nodes.length - 1];
    updateGraph(nextGraph);
    setSelectedNodeId(node.id);
  }

  function handleApplyParams() {
    try {
      updateGraph(updateNodeParams(activeMode.graph, selectedNodeId, JSON.parse(paramsText)));
      setMessage("Node params updated");
    } catch {
      setMessage("Params must be valid JSON");
    }
  }

  function handleAddEdge() {
    updateGraph(addEdge(activeMode.graph, edgeFrom, edgeOutput || "next", edgeTo));
    setMessage("Edge added");
  }

  function handleSelectMode(modeId: string) {
    const mode = config.modes.find((item) => item.id === modeId);
    setConfig({ ...config, activeModeId: modeId });
    if (mode?.graph.nodes[0]) {
      setSelectedNodeId(mode.graph.nodes[0].id);
      setEdgeFrom(mode.graph.nodes[0].id);
      setEdgeTo(mode.graph.nodes[1]?.id ?? mode.graph.nodes[0].id);
    }
  }

  function handleAddMode() {
    const name = newModeName.trim();
    if (!name) return;
    const mode = createMode(name);
    setConfig({ ...config, modes: [...config.modes, mode], activeModeId: mode.id });
    setNewModeName("");
    setSelectedNodeId(mode.graph.nodes[0].id);
  }

  async function handleSaveBlock() {
    const path = await writeCustomBlock(client, fileName, code).catch((error) => {
      showError(error);
      return "";
    });
    if (!path) return;
    const block = { id: slugify(blockName), name: blockName, path, entrypoint };
    setConfig({ ...config, customBlocks: [...config.customBlocks, block] });
    setMessage("Custom block saved");
  }

  async function handleCopyAndroidSetup() {
    if (!network.lanHost) return;
    await navigator.clipboard.writeText(androidSetupText(network.lanHost, config.proxy.port));
    setMessage("Android setup copied");
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">Local traffic policy engine</p>
        <h1>ProductivityProxy</h1>
        <p className="muted">Build mode-specific traffic policies with visual graph blocks.</p>
        <div className="button-row">
          <button className="primary" type="button" onClick={handleSave}>Save config</button>
          <span className="message" role="status">{message}</span>
        </div>
      </header>

      <StatusPanel config={config} status={status} events={events} onStart={handleStart} onStop={handleStop} onRefresh={refreshStatus} />
      <div className="dashboard-grid">
        <ModesPanel config={config} newModeName={newModeName} onNewModeNameChange={setNewModeName} onSelectMode={handleSelectMode} onAddMode={handleAddMode} />
        <ProxySettingsPanel proxy={config.proxy} onChange={(proxy) => setConfig({ ...config, proxy })} />
        <NetworkPanel port={config.proxy.port} lanHost={network.lanHost} onCopy={handleCopyAndroidSetup} />
      </div>
      <GraphEditor
        mode={activeMode}
        selectedNodeId={selectedNodeId}
        paramsText={paramsText}
        edgeFrom={edgeFrom}
        edgeTo={edgeTo}
        edgeOutput={edgeOutput}
        onSelectNode={setSelectedNodeId}
        onAddNode={handleAddNode}
        onParamsTextChange={setParamsText}
        onApplyParams={handleApplyParams}
        onEdgeFromChange={setEdgeFrom}
        onEdgeToChange={setEdgeTo}
        onEdgeOutputChange={setEdgeOutput}
        onAddEdge={handleAddEdge}
      />
      <CustomBlocksPanel
        blocks={config.customBlocks}
        blockName={blockName}
        fileName={fileName}
        entrypoint={entrypoint}
        code={code}
        onBlockNameChange={setBlockName}
        onFileNameChange={setFileName}
        onEntrypointChange={setEntrypoint}
        onCodeChange={setCode}
        onSave={handleSaveBlock}
      />
      <EventsPanel events={events} onRefresh={refreshEvents} />
    </main>
  );
}

function createMode(name: string): ModeConfig {
  const id = slugify(name);
  return {
    id,
    name,
    graph: {
      nodes: [
        { id: `${id}-start`, type: "start", position: { x: 80, y: 120 } },
        { id: `${id}-end`, type: "end", position: { x: 320, y: 120 } },
      ],
      edges: [{ from: `${id}-start`, output: "next", to: `${id}-end` }],
    },
  };
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "custom-block";
}
