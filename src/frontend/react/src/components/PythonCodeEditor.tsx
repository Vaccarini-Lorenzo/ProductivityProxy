import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { indentUnit } from "@codemirror/language";
import { EditorView } from "@codemirror/view";

interface Props {
  value: string;
  onChange: (value: string) => void;
  minHeight?: number;
  autoFocus?: boolean;
  ariaLabel?: string;
}

const editorTheme = EditorView.theme({
  "&": {
    width: "100%",
    border: "1px solid var(--line)",
    borderRadius: "7px",
    backgroundColor: "#0b0a08",
    color: "var(--text)",
  },
  "&.cm-focused": {
    outline: "none",
    borderColor: "var(--amber)",
  },
  ".cm-scroller": {
    fontFamily: '"SFMono-Regular", "Menlo", "Consolas", monospace',
    fontSize: ".8rem",
    lineHeight: "1.5",
  },
  ".cm-content": {
    padding: "10px 0",
    caretColor: "var(--amber)",
  },
  ".cm-line": {
    padding: "0 12px",
  },
  ".cm-gutters": {
    backgroundColor: "#0b0a08",
    borderRight: "1px solid var(--line)",
    color: "var(--muted)",
  },
  ".cm-activeLine, .cm-activeLineGutter": {
    backgroundColor: "rgba(245,158,11,.08)",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--amber)",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "rgba(245,158,11,.24)",
  },
}, { dark: true });

const pythonExtensions = [python(), indentUnit.of("    "), EditorView.lineWrapping, editorTheme];

export function PythonCodeEditor({ value, onChange, minHeight = 160, autoFocus = false, ariaLabel = "Python code" }: Props) {
  return (
    <CodeMirror
      aria-label={ariaLabel}
      autoFocus={autoFocus}
      extensions={pythonExtensions}
      indentWithTab
      minHeight={`${minHeight}px`}
      onChange={onChange}
      spellCheck={false}
      theme="dark"
      value={value}
    />
  );
}
