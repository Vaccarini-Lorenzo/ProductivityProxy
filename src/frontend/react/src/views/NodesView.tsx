import { useState } from "react";
import type { CustomNodeConfig } from "../models/config/types";
import { bundledNodeSource } from "../services/nodes/defaultNodeSources";
import { PythonCodeEditor } from "../components/PythonCodeEditor";
import { Card, Field, IconButton, Modal, PageHeader } from "../components/ui";

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

interface Draft { id?: string; name: string; fileName: string; code: string; }

export function NodesView({ nodes, onSave, onRead, onDelete }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftBase, setDraftBase] = useState<Draft | null>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const visibleNodes = nodes.filter((node) => `${node.name} ${node.path}`.toLowerCase().includes(search.toLowerCase()));
  const draftDirty = !!draft && (!draftBase || JSON.stringify(draft) !== JSON.stringify(draftBase));

  function closeDraft() {
    setDraft(null);
    setDraftBase(null);
  }

  function nodeDraft(node: CustomNodeConfig, code: string): Draft {
    return { id: node.id, name: node.name, fileName: node.path.split("/").pop() ?? `${node.id}.py`, code };
  }

  function newNode() {
    setMessage("");
    setDraftBase(null);
    setDraft({ name: "Custom node", fileName: "custom_node.py", code: DEFAULT_CODE });
  }

  async function editNode(node: CustomNodeConfig) {
    const loadingDraft = nodeDraft(node, "");
    setMessage("Loading source…");
    setDraft(loadingDraft);
    setDraftBase(loadingDraft);
    try {
      const loadedDraft = nodeDraft(node, await onRead(node.path));
      setDraft(loadedDraft);
      setDraftBase(loadedDraft);
      setMessage("");
    } catch (error) {
      const bundled = bundledNodeSource(node.path);
      const fallbackDraft = nodeDraft(node, bundled ?? `# Could not load node source:\n# ${error instanceof Error ? error.message : String(error)}\n`);
      setDraft(fallbackDraft);
      setDraftBase(fallbackDraft);
      setMessage(bundled ? "Showing bundled default source" : "Could not load node source");
    }
  }

  async function saveNode() {
    if (!draft || !draftDirty) return;
    await onSave(draft);
    closeDraft();
    setMessage("");
  }

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Nodes" title="Custom nodes" subtitle="Reusable Python steps you can drop into any policy." />

      <Card title="Installed nodes" actions={<button className="primary" type="button" onClick={newNode}>New node</button>}>
        <input className="library-search" placeholder="Search nodes…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search nodes" />
        <div className="list" role="list">
          {visibleNodes.map((node) => (
            <div className="list-row" key={node.id} role="listitem">
              <button className="list-main" type="button" onClick={() => editNode(node)}>
                <span className="list-title">{node.name}</span>
                <small>{node.path}</small>
              </button>
              <span className="badge muted-badge">{node.path.includes("/defaults/") ? "default" : "custom"}</span>
              <IconButton className="small" icon="edit" label={`Edit ${node.name}`} onClick={() => editNode(node)} />
              <button className="danger small" type="button" onClick={() => onDelete(node.id)}>Delete</button>
            </div>
          ))}
          {visibleNodes.length === 0 && <p className="muted">No matching nodes.</p>}
        </div>
      </Card>

      {draft && (
        <Modal
          title={draft.id ? `Edit “${draft.name}”` : "New node"}
          onClose={closeDraft}
          wide
          footer={<>
            {message && <span className="message footer-message">{message}</span>}
            <button type="button" onClick={closeDraft}>Cancel</button>
            <IconButton className={draftDirty ? "primary save-button" : "save-button save-clean"} icon="save" label={draft.id ? "Update node" : "Save node"} onClick={saveNode} disabled={!draftDirty} />
          </>}
        >
          <div className="form-grid">
            <Field label="Name">
              <input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="File name">
              <input value={draft.fileName} onChange={(e) => setDraft({ ...draft, fileName: e.target.value })} />
            </Field>
          </div>
          <Field label="Python code">
            <PythonCodeEditor value={draft.code} minHeight={340} onChange={(code) => setDraft({ ...draft, code })} />
          </Field>
        </Modal>
      )}
    </div>
  );
}
