import { useEffect, useRef, useState } from "react";

import { Button, Card, CheckRow, Icon, count } from "./components/ui";
import type { AppConfig } from "./models/config/types";
import { loadConfig, saveConfig, type CommandClient } from "./services/config/configRepository";
import { getProxyStatus, startProxy, stopProxy } from "./services/proxy/proxyRepository";
import { tauriClient } from "./services/tauri/tauriClient";
import "./styles.css";
import "./Popover.css";

const STATUS_POLL_MS = 2000;

interface Props {
  client?: CommandClient;
}

/** Compact menu-bar popover: proxy on/off, running state, and mode switch. */
export function Popover({ client = tauriClient }: Props) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const refreshStatus = () => {
      getProxyStatus(client).then((status) => setRunning(status.running)).catch(() => {});
    };
    const reloadConfig = () => loadConfig(client).then(setConfig).catch(showError);
    reloadConfig();
    refreshStatus();
    // Only poll while the popover is on screen; refresh again whenever it reopens.
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshStatus();
    }, STATUS_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      refreshStatus();
      reloadConfig();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [client]);

  // Keep the native window sized to the content so it never scrolls internally.
  useEffect(() => {
    const element = shellRef.current;
    if (!element) return;
    const sync = () => {
      const height = element.offsetHeight;
      if (height > 0) client.invoke("resize_popover", { height }).catch(() => {});
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(element);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [client]);

  function showError(error: unknown) {
    const text = error instanceof Error ? error.message : String(error);
    setMessage(text.includes("invoke") ? "Tauri unavailable" : text);
  }

  async function toggleProxy(next: boolean) {
    if (!config || busy) return;
    setBusy(true);
    setMessage(next ? "Starting proxy\u2026" : "Stopping proxy\u2026");
    try {
      if (next) await startProxy(client, config);
      else await stopProxy(client);
      const status = await getProxyStatus(client);
      setRunning(status.running);
      setMessage("");
    } catch (error) {
      showError(error);
      getProxyStatus(client).then((status) => setRunning(status.running)).catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  function selectMode(id: string) {
    if (!config || config.activeModeId === id) return;
    const previous = config;
    const next = { ...config, activeModeId: id };
    setConfig(next);
    setMessage("");
    saveConfig(client, next).catch((error) => {
      showError(error);
      setConfig(previous);
    });
  }

  return (
    <div className="pop-shell" ref={shellRef}>
      <div className="pop-panel">
        <header className="pop-head">
          <span className="pop-brand">ProductivityProxy</span>
          <span className={running ? "run-state on" : "run-state"} aria-live="polite">
            <span className="led" aria-hidden="true" /> {running ? "RUNNING" : "STOPPED"}
          </span>
        </header>

        {config ? (
          <div className="pop-body">
            <div className={running ? "pop-power on" : "pop-power"}>
              <CheckRow
                checked={running}
                disabled={busy}
                onChange={toggleProxy}
                label={running ? "Proxy is on" : "Proxy is off"}
                hint={busy
                  ? "Working\u2026"
                  : running
                    ? `Filtering traffic on port ${config.proxy.port}`
                    : "Turn on to enforce your rules"}
              />
            </div>

            <Card title="Mode" icon="layers">
              <div className="list">
                {config.modes.map((mode) => {
                  const isActive = mode.id === config.activeModeId;
                  return (
                    <div className={isActive ? "list-row active" : "list-row"} key={mode.id}>
                      <button className="list-main" type="button" onClick={() => selectMode(mode.id)}>
                        <span className="list-title">
                          {mode.name}
                          {isActive && <span className="badge">active</span>}
                        </span>
                        <small>{mode.description || count(mode.policyIds.length, "policy", "policies")}</small>
                      </button>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        ) : (
          <div className="pop-body"><div className="pop-loading">Loading…</div></div>
        )}

        {message && <div className="pop-msg"><Icon name="info" />{message}</div>}

        <footer className="pop-foot">
          <Button icon="terminal" onClick={() => client.invoke("show_main_window").catch(showError)}>
            Dashboard
          </Button>
          <Button className="danger" onClick={() => client.invoke("quit_app").catch(showError)}>
            Quit
          </Button>
        </footer>
      </div>
    </div>
  );
}
