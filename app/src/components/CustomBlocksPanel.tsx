import type { CustomBlockConfig } from "../models/config/types";

interface Props {
  blocks: CustomBlockConfig[];
  blockName: string;
  fileName: string;
  entrypoint: string;
  code: string;
  onBlockNameChange: (value: string) => void;
  onFileNameChange: (value: string) => void;
  onEntrypointChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  onSave: () => void;
}

export function CustomBlocksPanel(props: Props) {
  return (
    <section className="panel" aria-labelledby="custom-blocks-heading">
      <p className="eyebrow">Custom Python</p>
      <h2 id="custom-blocks-heading">Custom blocks</h2>
      <p className="muted">Code runs inside mitmproxy with local process permissions.</p>

      <div className="block-list">
        {props.blocks.length === 0 ? <p className="muted">No custom blocks yet.</p> : null}
        {props.blocks.map((block) => (
          <div className="block-row" key={block.id}>
            <strong>{block.name}</strong>
            <span>{block.path}</span>
          </div>
        ))}
      </div>

      <div className="form-grid">
        <label className="field">
          <span>Block name</span>
          <input value={props.blockName} onChange={(event) => props.onBlockNameChange(event.target.value)} />
        </label>
        <label className="field">
          <span>File name</span>
          <input value={props.fileName} onChange={(event) => props.onFileNameChange(event.target.value)} />
        </label>
        <label className="field">
          <span>Entrypoint</span>
          <input value={props.entrypoint} onChange={(event) => props.onEntrypointChange(event.target.value)} />
        </label>
      </div>

      <label className="field">
        <span>Python code</span>
        <textarea className="code-input" value={props.code} onChange={(event) => props.onCodeChange(event.target.value)} />
      </label>
      <button type="button" onClick={props.onSave}>Save custom block</button>
    </section>
  );
}
