import { useEffect, useState } from "react";

import type { ModeConfig } from "../models/config/types";
import type { PendingModeSwitch } from "../services/modes/modeRepository";
import { Button, Icon } from "./ui";

interface Props {
  pending: PendingModeSwitch;
  modes: ModeConfig[];
  onCancel: () => void;
  compact?: boolean;
}

export function ModeTransitionNotice({ pending, modes, onCancel, compact = false }: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [pending.readyAtMs]);

  const target = modes.find((mode) => mode.id === pending.targetModeId)?.name ?? pending.targetModeId;
  const remaining = Math.max(0, Math.ceil((pending.readyAtMs - now) / 1000));

  return (
    <section className={compact ? "mode-transition compact" : "mode-transition"} aria-label={`Switch to ${target} pending`}>
      <span className="mode-transition-icon"><Icon name="lock" /></span>
      <span className="mode-transition-copy">
        <strong>Switching to {target}</strong>
        <small>{remaining > 0 ? "Friction timer in progress" : "Finishing mode switch…"}</small>
      </span>
      <time className="mode-countdown" dateTime={`PT${remaining}S`}>{formatDuration(remaining)}</time>
      <Button className="small" onClick={onCancel}>Cancel</Button>
    </section>
  );
}

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
