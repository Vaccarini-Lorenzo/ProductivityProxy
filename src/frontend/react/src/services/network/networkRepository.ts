import type { CommandClient } from "../config/configRepository";

export interface NetworkInfo {
  localHost: string;
  lanHost: string | null;
}

export function getNetworkInfo(client: CommandClient): Promise<NetworkInfo> {
  return client.invoke<NetworkInfo>("network_info");
}
