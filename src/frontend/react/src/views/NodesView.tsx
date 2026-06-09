import { useState } from "react";
import type { CustomNodeConfig } from "../models/config/types";
import { bundledNodeSource } from "../services/nodes/defaultNodeSources";

export interface SaveNodeInput {
  id?: string;
  name: string;
  fileName: string;
  code: string;
}

interface Props {
  nodes: CustomNodeConfig[];
  onSave: (input: SaveNodeInput) => Promise<void>;
  onRead: (path: string) => Promise<string>;
  onDelete: (id: string) => void;
}

const DEFAULT_CODE = `def run(input, context, params):
    context.log.info("custom node executed")
    return input
`;

export function NodesView({ nodes, onSave, onRead, onDelete }: Props) {
  const [editingId, setEditingId] = useState<string | undefined>();
  const [name, setName] = useState("Custom node");
  const [fileName, setFileName] = useState("custom_node.py");
  const [code, setCode] = useState(DEFAULT_CODE);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const visibleNodes = nodes.filter((node) => `${node.name} ${node.path}`.toLowerCase().includes(search.toLowerCase()));

  async function editNode(node: CustomNodeConfig) {
    setEditingId(node.id);
    setName(node.name);
    setFileName(node.path.split("/").pop() ?? `${node.id}.py`);
    setMessage("Loading node source…");
    try {
      setCode(await onRead(node.path));
      setMessage("");
    } catch (error) {
      const bundled = bundledNodeSource(node.path);
      setCode(bundled ?? `# Could not load node source:\n# ${error instanceof Error ? error.message : String(error)}\n`);
      setMessage(bundled ? "Loaded bundled default source preview" : "Could not load node source");
    }
  }

  async function saveNode() {
    await onSave({ id: editingId, name, fileName, code });
    resetForm();
  }

  function resetForm() {
    setEditingId(undefined);
    setName("Custom node");
    setFileName("custom_node.py");
    setCode(DEFAULT_CODE);
    setMessage("");
  }

  return (
    <div className="nodes-layout">
      <section className="terminal-card node-list-card" aria-labelledby="node-list-heading">
        <div className="section-head">
          <div>
            <p className="command">$ ppx node list</p>
            <h1 id="node-list-heading">Custom nodes</h1>
          </div>
          <button type="button" onClick={resetForm}>$ ppx node new</button>
        </div>
        <label className="search-box">
          <span className="sr-only">Search nodes</span>
          <input placeholder="Search nodes…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <div className="table-list" role="list">
          {visibleNodes.map((node) => (
            <article className={node.id === editingId ? "table-row selected" : "table-row"} key={node.id} role="listitem">
              <button className="row-main" type="button" onClick={() => editNode(node)}>
                <strong>{node.name}</strong>
                <small>{node.path}</small>
              </button>
              <span className="tag">{node.path.includes("/defaults/") ? "default" : "custom"}</span>
              <button className="danger small" type="button" onClick={() => onDelete(node.id)}>delete</button>
            </article>
          ))}
          {visibleNodes.length === 0 && <p className="muted">No matching nodes.</p>}
        </div>
      </section>

      <section className="terminal-card code-card" aria-labelledby="node-editor-heading">
        <div className="editor-tab">{fileName}<span>×</span></div>
        <h2 id="node-editor-heading">{editingId ? `Editing ${name}` : "New node"}</h2>
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
          <textarea className="code-input node-code" value={code} spellCheck={false} onChange={(e) => setCode(e.target.value)} />
        </label>
        <div className="actions">
          <button className="primary" type="button" onClick={saveNode}>{editingId ? "$ ppx node update" : "$ ppx node save"}</button>
          <button type="button" onClick={resetForm}>clear</button>
          {message && <span className="message">{message}</span>}
        </div>
      </section>
    </div>
  );
}
