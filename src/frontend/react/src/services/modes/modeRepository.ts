import type { CommandClient } from "../config/configRepository";

export interface PendingModeSwitch {
  sourceModeId: string;
  targetModeId: string;
  readyAtMs: number;
}

export interface ModeRuntimeStatus {
  activeModeId: string;
  frictionSeconds: number;
  pending: PendingModeSwitch | null;
}

export function getModeRuntimeStatus(client: CommandClient): Promise<ModeRuntimeStatus> {
  return client.invoke<ModeRuntimeStatus>("mode_runtime_status");
}

export function requestModeSwitch(client: CommandClient, targetModeId: string): Promise<ModeRuntimeStatus> {
  return client.invoke<ModeRuntimeStatus>("request_mode_switch", { targetModeId });
}

export function cancelModeSwitch(client: CommandClient): Promise<ModeRuntimeStatus> {
  return client.invoke<ModeRuntimeStatus>("cancel_mode_switch");
}
