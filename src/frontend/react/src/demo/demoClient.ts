// Dev-only mock of the Tauri command client, used to record README demo media.
// It keeps config/proxy state in memory so the dashboard behaves like the real
// app (clean autosave, working proxy toggle) without a Tauri backend.
import type { CommandClient } from "../services/config/configRepository";
import type { Notifier } from "../services/notifications/notificationService";
import { demoConfig, NODE_SOURCES } from "./demoConfig";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

let config = clone(demoConfig);
let running = false;

export const demoClient: CommandClient = {
  async invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    switch (command) {
      case "read_app_config":
        return clone(config) as T;
      case "write_app_config":
        config = clone(args!.config as typeof config);
        return { ok: true, issues: [] } as T;
      case "validate_node_code":
        return { ok: true, issues: [] } as T;
      case "write_custom_node": {
        const path = `/demo/custom_nodes/${String(args!.fileName)}`;
        NODE_SOURCES[path] = String(args!.code);
        return path as T;
      }
      case "read_custom_node": {
        const path = String(args!.path);
        if (path in NODE_SOURCES) return NODE_SOURCES[path] as T;
        throw new Error(`demo: no source for ${path}`);
      }
      case "start_proxy":
        running = true;
        return undefined as T;
      case "stop_proxy":
        running = false;
        return undefined as T;
      case "proxy_status":
        return { running } as T;
      case "read_recent_events":
      case "query_events":
        return [] as T;
      case "network_info":
        return { localHost: "127.0.0.1", lanHost: "192.168.1.42" } as T;
      case "show_main_window":
      case "resize_popover":
      case "quit_app":
        return undefined as T;
      default:
        throw new Error(`demo: unhandled command ${command}`);
    }
  },
};

export const demoNotifier: Notifier = {
  async notify() {
    // README capture: swallow notifications instead of hitting the OS.
  },
};
