import { useState } from "react";
import type { CustomBlockConfig } from "../models/config/types";

interface Props {
  blocks: CustomBlockConfig[];
  onSave: (name: string, fileName: string, entrypoint: string, code: string) => void;
  onDelete: (id: string) => void;
}

export function OperatorsView({ blocks, onSave, onDelete }: Props) {
  const [name, setName] = useState("Custom block");
  const [fileName, setFileName] = useState("custom_block.py");
  const [entrypoint, setEntrypoint] = useState("run");
  const [code, setCode] = useState('def run(context, params):\n    return {"output": "next"}\n');
  const [editing, setEditing] = useState<string | null>(null);

  function handleEdit(block: CustomBlockConfig) {
    setEditing(block.id);
    setName(block.name);
    setFileName(block.path.split("/").pop() ?? "custom_block.py");
    setEntrypoint(block.entrypoint);
  }

  function handleSubmit() {
    onSave(name, fileName, entrypoint, code);
    setEditing(null);
    setName("Custom block");
    setFileName("custom_block.py");
    setEntrypoint("run");
    setCode('def run(context, params):\n    return {"output": "next"}\n');
  }

  return (
    <div className="view-stack">
      <header className="view-header">
        <p className="eyebrow">Custom Python operators</p>
        <h1>Operators</h1>
      </header>

      <section className="panel" aria-labelledby="block-list-heading">
        <h2 id="block-list-heading">Registered operators</h2>
        {blocks.length === 0 ? <p className="muted">No custom operators yet.</p> : null}
        <div className="block-list">
          {blocks.map((block) => (
            <div className="block-row" key={block.id}>
              <div>
                <strong>{block.name}</strong>
                <span>{block.path}</span>
              </div>
              <div className="button-row">
                <button type="button" onClick={() => handleEdit(block)}>Edit</button>
                <button className="danger" type="button" onClick={() => onDelete(block.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel" aria-labelledby="new-block-heading">
        <h2 id="new-block-heading">{editing ? `Editing: ${name}` : "New operator"}</h2>
        <div className="form-grid">
          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>File name</span>
            <input value={fileName} onChange={(e) => setFileName(e.target.value)} />
          </label>
          <label className="field">
            <span>Entrypoint function</span>
            <input value={entrypoint} onChange={(e) => setEntrypoint(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Python code</span>
          <textarea className="code-input" value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
        <button className="primary" type="button" onClick={handleSubmit}>
          {editing ? "Update operator" : "Save operator"}
        </button>
      </section>
    </div>
  );
}
