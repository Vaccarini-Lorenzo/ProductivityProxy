import type { AppConfig } from "../../models/config/types";

export interface CommandClient {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
}

export function loadConfig(client: CommandClient): Promise<AppConfig> {
  return client.invoke<AppConfig>("read_app_config");
}

export function saveConfig(client: CommandClient, config: AppConfig): Promise<void> {
  return client.invoke<void>("write_app_config", { config });
}

export function writeCustomNode(client: CommandClient, fileName: string, code: string): Promise<string> {
  return client.invoke<string>("write_custom_node", { fileName, code });
}
