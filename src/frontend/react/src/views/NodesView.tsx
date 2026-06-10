import { useEffect, useRef, useState } from "react";
import type { CustomNodeConfig, ValidationIssue, ValidationReport } from "../models/config/types";
import { bundledNodeSource } from "../services/nodes/defaultNodeSources";
import { PythonCodeEditor } from "../components/PythonCodeEditor";
import { Card, Field, FieldGroup, Icon, IconButton, Modal, PageHeader, SearchInput } from "../components/ui";

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
  onValidateCode: (code: string) => Promise<ValidationReport>;
  onDelete: (id: string) => void;
}

const DEFAULT_CODE = `from typing import Any

from proxy.api import Context, Request


def run(input: Any, request: Request, context: Context, params: dict[str, Any]) -> Any:
    context.log("custom_node", "custom node executed", url=request.url)
    return input
`;

interface Draft { id?: string; name: string; fileName: string; code: string; }

export function NodesView({ nodes, onSave, onRead, onValidateCode, onDelete }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftBase, setDraftBase] = useState<Draft | null>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [nodeIssues, setNodeIssues] = useState<ValidationIssue[]>([]);
  const [showReset, setShowReset] = useState(false);
  const validateRun = useRef(0);
  const visibleNodes = nodes.filter((node) => `${node.name} ${node.path}`.toLowerCase().includes(search.toLowerCase()));
  const draftDirty = !!draft && (!draftBase || JSON.stringify(draft) !== JSON.stringify(draftBase));
  const nodeInvalid = nodeIssues.length > 0;

  // The backend is the single source of truth: it checks code syntax + a run() function.
  useEffect(() => {
    if (!draft || !draft.code.trim()) { setNodeIssues([]); return; }
    const run = ++validateRun.current;
    const code = draft.code;
    const timeout = window.setTimeout(() => {
      onValidateCode(code)
        .then((report) => { if (run === validateRun.current) setNodeIssues(report.issues); })
        .catch(() => { if (run === validateRun.current) setNodeIssues([]); });
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [draft?.code, onValidateCode]);

  function closeDraft() {
    setDraft(null);
    setDraftBase(null);
    setNodeIssues([]);
    setShowReset(false);
  }

  function resetNode() {
    if (draftBase) setDraft({ ...draftBase });
    else closeDraft();
    setShowReset(false);
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
    if (!draft || !draftDirty || nodeInvalid) return;
    await onSave(draft);
    closeDraft();
    setMessage("");
  }

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Nodes" title="Custom nodes" subtitle="Reusable Python steps you can drop into any policy." />

      <Card title="Installed nodes" icon="hexagon" actions={<IconButton className="primary" icon="plus" label="New node" onClick={newNode} />}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search nodes…" ariaLabel="Search nodes" />
        <div className="box-grid" role="list">
          {visibleNodes.map((node) => (
            <div className="box-card node" key={node.id} role="listitem">
              <button className="box-card-main" type="button" onClick={() => editNode(node)} aria-label={`Edit ${node.name}`}>
                <span className="box-card-icon"><Icon name="hexagon" /></span>
                <span className="box-card-body">
                  <span className="box-card-title"><span className="box-card-name">{node.name}</span></span>
                  <span className="box-card-pill">{node.path.split("/").pop()}</span>
                </span>
              </button>
              <div className="box-card-actions">
                <IconButton className="danger small" icon="trash" label={`Delete ${node.name}`} onClick={() => onDelete(node.id)} />
              </div>
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
            {nodeInvalid && <button type="button" className="danger" onClick={() => setShowReset(true)}>Reset</button>}
            <button type="button" onClick={closeDraft}>Cancel</button>
            <IconButton className={draftDirty && !nodeInvalid ? "primary save-button" : "save-button save-clean"} icon="save" label={draft.id ? "Update node" : "Save node"} onClick={saveNode} disabled={!draftDirty || nodeInvalid} />
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
          <FieldGroup label="Python code">
            <PythonCodeEditor value={draft.code} minHeight={340} ariaLabel={`Python code for ${draft.name}`} onChange={(code) => setDraft({ ...draft, code })} apiQuery="run" />
          </FieldGroup>
          {nodeInvalid && (
            <div className="policy-issues" role="alert">
              <span className="policy-issues-badge">Invalid · not saved</span>
              {nodeIssues.map((issue, i) => (
                <div className="policy-issue" key={i}><strong>{issue.message}</strong>{issue.hint && <span className="muted">{issue.hint}</span>}</div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {showReset && draft && (
        <Modal
          title={`Reset “${draft.name}”`}
          wide={!!draftBase}
          onClose={() => setShowReset(false)}
          footer={<><button type="button" onClick={() => setShowReset(false)}>Cancel</button><button className="primary" type="button" onClick={resetNode}>{draftBase ? "Reset to last saved" : "Discard new node"}</button></>}
        >
          {draftBase ? (
            <>
              <p className="inline-note">This discards the current invalid code and restores the last saved version below.</p>
              <FieldGroup label="Last saved code">
                <PythonCodeEditor value={draftBase.code} minHeight={300} readOnly ariaLabel="Last saved node code" />
              </FieldGroup>
            </>
          ) : (
            <p className="danger-text">This node was never saved, so there is no valid version to restore. Reset will discard it.</p>
          )}
        </Modal>
      )}
    </div>
  );
}
