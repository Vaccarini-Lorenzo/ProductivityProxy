import { useEffect, useRef, useState } from "react";

import popoverLogo from "./assets/popover-logo.png";
import { Button, Card, CheckRow, Icon, count } from "./components/ui";
import type { AppConfig } from "./models/config/types";
import { loadConfig, saveConfig, type CommandClient } from "./services/config/configRepository";
import { errorMessage } from "./services/errors/errorMessage";
import type { Notifier } from "./services/notifications/notificationService";
import { tauriNotifier } from "./services/notifications/tauriNotifier";
import { STATUS_POLL_MS } from "./services/proxy/polling";
import { getProxyStatus, restartProxy, startProxy, stopProxy } from "./services/proxy/proxyRepository";
import { tauriClient } from "./services/tauri/tauriClient";

interface Props {
  client?: CommandClient;
  notifier?: Notifier;
}

/** Compact menu-bar popover: proxy on/off, running state, and mode switch. */
export function Popover({ client = tauriClient, notifier = tauriNotifier }: Props) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const shellRef = useRef<HTMLDivElement>(null);
  // While a start/stop request is in flight we trust the optimistic toggle and
  // ignore status polls, which would otherwise clobber it before it settles.
  const pending = useRef(false);

  useEffect(() => {
    const refreshStatus = () => {
      getProxyStatus(client)
        .then((status) => { if (!pending.current) setRunning(status.running); })
        .catch(() => {});
    };
    const reloadConfig = () => loadConfig(client).then(setConfig).catch(showError);
    reloadConfig();
    refreshStatus();
    // Poll the backend unconditionally: it is the single source of truth for
    // whether the proxy is actually running (it may be started/stopped from the
    // dashboard, or exit on its own).
    const poll = window.setInterval(refreshStatus, STATUS_POLL_MS);
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
    setMessage(errorMessage(error, "Tauri unavailable"));
  }

  // Optimistic + async: flip the toggle immediately and run the start/stop in
  // the background. If it fails, snap the toggle back and notify the user.
  async function toggleProxy(next: boolean) {
    if (!config || pending.current) return;
    pending.current = true;
    setRunning(next);
    setMessage("");
    try {
      if (next) await startProxy(client, config);
      else await stopProxy(client);
    } catch (error) {
      setRunning(!next);
      const action = next ? "start" : "stop";
      notifier.notify("ProductivityProxy", `Couldn't ${action} the proxy: ${errorMessage(error)}`).catch(() => {});
    } finally {
      pending.current = false;
    }
  }

  function selectMode(id: string) {
    if (!config || config.activeModeId === id || pending.current) return;
    const previous = config;
    const next = { ...config, activeModeId: id };
    setConfig(next);
    setMessage("");
    pending.current = true;
    saveConfig(client, next)
      .then(async (report) => {
        if (!report.ok) {
          setConfig(previous);
          setMessage(report.issues[0]?.message ?? "Mode was not saved");
          return;
        }
        if (!running) return;
        setMessage("Reopening proxy connections…");
        await restartProxy(client, next);
        setRunning(true);
        setMessage("");
      })
      .catch((error) => {
        showError(error);
        setConfig(previous);
        getProxyStatus(client).then((status) => setRunning(status.running)).catch(() => {});
      })
      .finally(() => { pending.current = false; });
  }

  return (
    <div className="pop-shell" ref={shellRef}>
      <div className="pop-panel">
        <header className="pop-head">
          <span className="pop-brand-wrap">
            <img className="pop-logo" src={popoverLogo} alt="" />
            <span className="pop-brand">ProductivityProxy</span>
          </span>
          <span className={running ? "run-state on" : "run-state"} aria-live="polite">
            <span className="led" aria-hidden="true" /> {running ? "RUNNING" : "STOPPED"}
          </span>
        </header>

        {config ? (
          <div className="pop-body">
            <div className={running ? "pop-power on" : "pop-power"}>
              <CheckRow
                checked={running}
                onChange={toggleProxy}
                label={running ? "Proxy is on" : "Proxy is off"}
                hint={running
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
