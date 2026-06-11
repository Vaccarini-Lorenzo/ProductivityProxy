import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { indentUnit } from "@codemirror/language";
import { keymap, EditorView } from "@codemirror/view";
import { indentLess } from "@codemirror/commands";
import { autocompletion, acceptCompletion } from "@codemirror/autocomplete";
import { pythonCompletionSource } from "../services/apiReference/pythonCompletions";
import { ApiReferenceDrawer } from "./ApiReferenceDrawer";
import { Button, IconButton } from "./ui";

interface Props {
  value: string;
  onChange?: (value: string) => void;
  minHeight?: number;
  autoFocus?: boolean;
  ariaLabel?: string;
  readOnly?: boolean;
  apiQuery?: string;
}

const editorTheme = EditorView.theme({
  "&": {
    width: "100%",
    border: "1px solid var(--line)",
    borderRadius: "7px",
    backgroundColor: "#0b0a08",
    color: "var(--text)",
  },
  "&.cm-focused": { outline: "none", borderColor: "var(--amber)" },
  ".cm-scroller": {
    fontFamily: '"SFMono-Regular", "Menlo", "Consolas", monospace',
    fontSize: ".8rem",
    lineHeight: "1.5",
  },
  ".cm-content": { padding: "10px 0", caretColor: "var(--amber)" },
  ".cm-line": { padding: "0 12px" },
  ".cm-gutters": {
    backgroundColor: "#0b0a08",
    borderRight: "1px solid var(--line)",
    color: "var(--muted)",
  },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "rgba(245,158,11,.08)" },
  ".cm-cursor": { borderLeftColor: "var(--amber)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": { backgroundColor: "rgba(245,158,11,.24)" },
}, { dark: true });

const tabKeymap = keymap.of([
  { key: "Tab", run: acceptCompletion },
  { key: "Tab", run: insertIndent },
  { key: "Shift-Tab", run: indentLess },
]);

const pythonExtensions = [
  python(),
  indentUnit.of("    "),
  autocompletion({ override: [pythonCompletionSource], activateOnTyping: true }),
  tabKeymap,
  EditorView.lineWrapping,
  editorTheme,
];

/** Insert spaces to the next indent stop (like insertTab but without indenting the line). */
function insertIndent(view: EditorView): boolean {
  const { state } = view;
  const unit = state.facet(indentUnit);
  const size = unit.length || 4;
  view.dispatch(state.replaceSelection(" ".repeat(size)));
  return true;
}

export function PythonCodeEditor({ value, onChange, minHeight = 160, autoFocus = false, ariaLabel = "Python code", readOnly = false, apiQuery }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [apiOpen, setApiOpen] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || apiOpen) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setExpanded(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [expanded, apiOpen]);

  const title = readOnly ? "Python source" : "Python code";

  const fullscreen = expanded ? createPortal(
    <div className="python-editor-overlay" role="dialog" aria-modal="true" aria-label={`${ariaLabel} full screen`} onClick={() => setExpanded(false)}>
      <div className="python-editor-fullscreen" onClick={(event) => event.stopPropagation()}>
        <div className="python-editor-fullscreen-head">
          <div className="python-editor-titles"><strong>{title}</strong><span>{ariaLabel}</span></div>
          <div className="python-editor-actions">
            <Button className="small" onClick={() => setApiOpen(true)}>API</Button>
            <IconButton className="small" icon="close" label="Close" title="Close (Esc)" onClick={() => setExpanded(false)} />
          </div>
        </div>
        <div className="python-editor-fullscreen-body">
          {renderEditor(value, onChange, 0, true, ariaLabel, readOnly, "100%")}
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  return <>
    <div className="python-editor-shell">
      <div className="python-editor-head">
        <span className="python-editor-title">{title}</span>
        <div className="python-editor-actions">
          <button type="button" className="small python-editor-api" onClick={() => setApiOpen(true)}>API</button>
          <button type="button" className="small python-editor-expand" onClick={() => setExpanded(true)}>Full screen</button>
        </div>
      </div>
      {renderEditor(value, onChange, minHeight, autoFocus, ariaLabel, readOnly)}
    </div>
    {fullscreen}
    <ApiReferenceDrawer open={apiOpen} initialQuery={apiQuery} onClose={() => setApiOpen(false)} />
  </>;
}

function renderEditor(value: string, onChange: ((value: string) => void) | undefined, minHeight: number, autoFocus: boolean, ariaLabel: string, readOnly: boolean, height?: string) {
  return <CodeMirror
    aria-label={ariaLabel}
    autoFocus={autoFocus}
    className="python-codemirror"
    editable={!readOnly}
    extensions={pythonExtensions}
    height={height}
    indentWithTab={false}
    minHeight={height ? undefined : `${minHeight}px`}
    onChange={onChange}
    readOnly={readOnly}
    spellCheck={false}
    theme="dark"
    value={value}
  />;
}
