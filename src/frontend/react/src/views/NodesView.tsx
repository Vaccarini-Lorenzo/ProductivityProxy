import { useState } from "react";
import type { CustomNodeConfig } from "../models/config/types";

interface Props {
  nodes: CustomNodeConfig[];
  onSave: (name: string, fileName: string, code: string) => void;
  onDelete: (id: string) => void;
}

const DEFAULT_CODE = "def run(input, context, params):\n    return input\n";

export function NodesView({ nodes, onSave, onDelete }: Props) {
  const [name, setName] = useState("Custom node");
  const [fileName, setFileName] = useState("custom_node.py");
  const [code, setCode] = useState(DEFAULT_CODE);
  const [editing, setEditing] = useState<string | null>(null);

  function handleEdit(node: CustomNodeConfig) {
    setEditing(node.id);
    setName(node.name);
    setFileName(node.path.split("/").pop() ?? "custom_node.py");
  }

  function handleSubmit() {
    onSave(name, fileName, code);
    setEditing(null);
    setName("Custom node");
    setFileName("custom_node.py");
    setCode(DEFAULT_CODE);
  }

  return (
    <div className="view-stack">
      <header className="view-header">
        <p className="eyebrow">Custom Python nodes</p>
        <h1>Nodes</h1>
      </header>

      <section className="panel" aria-labelledby="node-list-heading">
        <h2 id="node-list-heading">Registered nodes</h2>
        {nodes.length === 0 ? <p className="muted">No custom nodes yet.</p> : null}
        <div className="block-list">
          {nodes.map((node) => (
            <div className="block-row" key={node.id}>
              <div>
                <strong>{node.name}</strong>
                <span>{node.path}</span>
              </div>
              <div className="button-row">
                <button type="button" onClick={() => handleEdit(node)}>Edit</button>
                <button className="danger" type="button" onClick={() => onDelete(node.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel" aria-labelledby="new-node-heading">
        <h2 id="new-node-heading">{editing ? `Editing: ${name}` : "New node"}</h2>
        <div className="form-grid">
          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>File name</span>
            <input value={fileName} onChange={(e) => setFileName(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Python code</span>
          <textarea className="code-input" value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
        <button className="primary" type="button" style={{ marginTop: 16 }} onClick={handleSubmit}>
          {editing ? "Update node" : "Save node"}
        </button>
      </section>
    </div>
  );
}
