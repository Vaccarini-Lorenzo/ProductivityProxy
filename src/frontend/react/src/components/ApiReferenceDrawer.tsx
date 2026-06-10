import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { searchApiReference, type ApiEntry, type ApiGroup } from "../services/apiReference/apiReference";
import { Icon, SearchInput, type IconName } from "./ui";
import "./ApiReferenceDrawer.css";

interface Props {
  open: boolean;
  initialQuery?: string;
  onClose: () => void;
}

/** Slide-over API reference. Reads the documented reference and lets you fuzzy-search it. */
export function ApiReferenceDrawer({ open, initialQuery, onClose }: Props) {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => searchApiReference(query), [query]);
  const searching = query.trim() !== "";
  const totalEntries = groups.reduce((sum, group) => sum + group.entries.length, 0);
  const bodyRef = useRef<HTMLDivElement>(null);

  const scrollToGroup = useCallback((groupId: string) => {
    setQuery("");
    // Wait for the filter to clear and groups to render, then scroll.
    requestAnimationFrame(() => {
      const el = bodyRef.current?.querySelector(`[data-group-id="${groupId}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  // Seed the search each time the drawer opens (e.g. with the current function name).
  useEffect(() => { if (open) setQuery(initialQuery ?? ""); }, [open, initialQuery]);

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
        <div className="api-drawer-body" ref={bodyRef}>
          {groups.map((group) => <GroupView key={group.id} group={group} forceOpen={searching} autoExpandEntry={searching && totalEntries === 1} scrollToGroup={scrollToGroup} />)}
          {groups.length === 0 && <p className="muted api-drawer-empty">No matches.</p>}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

function GroupView({ group, forceOpen, autoExpandEntry, scrollToGroup }: { group: ApiGroup; forceOpen: boolean; autoExpandEntry: boolean; scrollToGroup: (id: string) => void }) {
  const [open, setOpen] = useState(true);
  const expanded = forceOpen || open;
  return (
    <section className="api-group" data-group-id={group.id}>
      <button className="api-group-head" type="button" onClick={() => setOpen(!open)} aria-expanded={expanded}>
        <span className={expanded ? "api-chevron open" : "api-chevron"}>›</span>
        <span className="api-group-icon"><Icon name={group.icon as IconName} /></span>
        <span className="api-group-title">{group.title}</span>
      </button>
      {expanded && (
        <div className="api-entries">
          {group.entries.map((entry) => <EntryView key={entry.name} entry={entry} autoExpand={autoExpandEntry} scrollToGroup={scrollToGroup} />)}
        </div>
      )}
    </section>
  );
}

function EntryView({ entry, autoExpand, scrollToGroup }: { entry: ApiEntry; autoExpand: boolean; scrollToGroup: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const hasDetails = (entry.details?.length ?? 0) > 0;
  const expanded = hasDetails && (autoExpand || open);
  return (
    <div className={expanded ? "api-entry expanded" : "api-entry"}>
      <button className="api-entry-head" type="button" onClick={() => hasDetails && setOpen(!open)} aria-expanded={expanded} disabled={!hasDetails}>
        <span className="api-entry-text">
          <code className="api-entry-name">{entry.name}</code>
          <span className="api-entry-summary">{entry.summary}</span>
        </span>
        <span className="api-entry-right">
          <span className="api-type">{entry.type}</span>
          {hasDetails && <span className={expanded ? "api-entry-toggle open" : "api-entry-toggle"}>›</span>}
        </span>
      </button>
      {expanded && (
        <dl className="api-detail">
          {entry.details!.map((detail) => (
            <div className="api-detail-row" key={detail.label}>
              <dt>{detail.label}</dt>
              <dd><DetailText text={detail.text} scrollToGroup={scrollToGroup} /></dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** Renders detail text with inline `code` (linkable when matching a section) and bullet lists. */
function DetailText({ text, scrollToGroup }: { text: string; scrollToGroup: (id: string) => void }) {
  const lines = text.split("\n");
  const isList = lines.length > 1 && lines.every((line) => line.startsWith("- "));
  if (isList) {
    return (
      <ul className="api-detail-list">
        {lines.map((line, i) => <li key={i}>{renderInlineCode(line.slice(2), scrollToGroup)}</li>)}
      </ul>
    );
  }
  return <>{renderInlineCode(text, scrollToGroup)}</>;
}

const LINKABLE_GROUPS = new Set(["request", "context", "params"]);

function renderInlineCode(text: string, scrollToGroup: (id: string) => void): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  const regex = /`([^`]+)`/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const code = match[1];
    const linkTarget = LINKABLE_GROUPS.has(code) ? code : null;
    if (linkTarget) {
      parts.push(<button key={match.index} type="button" className="api-inline-code api-link" onClick={() => scrollToGroup(linkTarget)}>{code}</button>);
    } else {
      parts.push(<code key={match.index} className="api-inline-code">{code}</code>);
    }
    last = regex.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
