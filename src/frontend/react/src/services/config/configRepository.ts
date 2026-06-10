import type { AppConfig, ValidationReport } from "../../models/config/types";

export interface CommandClient {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
}

export function loadConfig(client: CommandClient): Promise<AppConfig> {
  return client.invoke<AppConfig>("read_app_config");
}

/** Backend validates (source of truth) and writes only when valid. The report
 *  is returned either way so the UI can show issues without persisting. */
export function saveConfig(client: CommandClient, config: AppConfig): Promise<ValidationReport> {
  return client.invoke<ValidationReport>("write_app_config", { config });
}

export function validateNodeCode(client: CommandClient, code: string): Promise<ValidationReport> {
  return client.invoke<ValidationReport>("validate_node_code", { code });
}

export function writeCustomNode(client: CommandClient, fileName: string, code: string): Promise<string> {
  return client.invoke<string>("write_custom_node", { fileName, code });
}

export function readCustomNode(client: CommandClient, path: string): Promise<string> {
  return client.invoke<string>("read_custom_node", { path });
}
