import type { AppConfig, ModeConfig } from "../models/config/types";

interface Props {
  config: AppConfig;
  newModeName: string;
  onNewModeNameChange: (value: string) => void;
  onSelectMode: (modeId: string) => void;
  onAddMode: () => void;
}

export function ModesPanel({ config, newModeName, onNewModeNameChange, onSelectMode, onAddMode }: Props) {
  return (
    <section className="panel" aria-labelledby="modes-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Modes</p>
          <h2 id="modes-heading">Policy modes</h2>
        </div>
      </div>
      <div className="mode-list">
        {config.modes.map((mode) => (
          <ModeButton key={mode.id} mode={mode} active={mode.id === config.activeModeId} onSelect={onSelectMode} />
        ))}
      </div>
      <label className="field">
        <span>New mode name</span>
        <input value={newModeName} onChange={(event) => onNewModeNameChange(event.target.value)} />
      </label>
      <button type="button" onClick={onAddMode}>Add mode</button>
    </section>
  );
}

function ModeButton({ mode, active, onSelect }: { mode: ModeConfig; active: boolean; onSelect: (id: string) => void }) {
  return (
    <button className={active ? "mode-card active" : "mode-card"} type="button" onClick={() => onSelect(mode.id)}>
      <span>{mode.name}</span>
      <small>{mode.graph.nodes.length} nodes</small>
    </button>
  );
}
