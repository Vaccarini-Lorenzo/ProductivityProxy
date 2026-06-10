import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { searchApiReference, type ApiGroup } from "../services/apiReference/apiReference";
import { Icon, SearchInput, type IconName } from "./ui";
import "./ApiReferenceDrawer.css";

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Slide-over API reference. Reads the documented reference and lets you fuzzy-search it. */
export function ApiReferenceDrawer({ open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => searchApiReference(query), [query]);
  const searching = query.trim() !== "";

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="api-drawer-overlay" onMouseDown={onClose}>
      <aside className="api-drawer" role="dialog" aria-modal="true" aria-label="API reference" onMouseDown={(event) => event.stopPropagation()}>
        <header className="api-drawer-head">
          <div className="api-drawer-title"><Icon name="terminal" /><strong>API Reference</strong></div>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Close API reference">×</button>
        </header>
        <div className="api-drawer-search">
          <SearchInput value={query} onChange={setQuery} placeholder="Search API reference…" ariaLabel="Search API reference" />
        </div>
        <div className="api-drawer-body">
          {groups.map((group) => <GroupView key={group.id} group={group} forceOpen={searching} />)}
          {groups.length === 0 && <p className="muted api-drawer-empty">No matches.</p>}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

function GroupView({ group, forceOpen }: { group: ApiGroup; forceOpen: boolean }) {
  const [open, setOpen] = useState(true);
  const expanded = forceOpen || open;
  return (
    <section className="api-group">
      <button className="api-group-head" type="button" onClick={() => setOpen(!open)} aria-expanded={expanded}>
        <span className={expanded ? "api-chevron open" : "api-chevron"}>›</span>
        <span className="api-group-icon"><Icon name={group.icon as IconName} /></span>
        <span className="api-group-title">{group.title}</span>
      </button>
      {expanded && (
        <div className="api-entries">
          {group.entries.map((entry) => (
            <div className="api-entry" key={entry.name}>
              <div className="api-entry-text">
                <code className="api-entry-name">{entry.name}</code>
                <span className="api-entry-summary">{entry.summary}</span>
              </div>
              <span className="api-type">{entry.type}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
