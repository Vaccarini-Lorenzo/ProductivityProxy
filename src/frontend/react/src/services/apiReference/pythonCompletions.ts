import { type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";

/** Completions for our Python authoring API (request.*, context.*, params[*]). */

interface Item { label: string; detail: string; }

const REQUEST_PROPS: Item[] = [
  { label: "method", detail: "str — HTTP method" },
  { label: "host", detail: "str — host name" },
  { label: "url", detail: "str — full URL" },
  { label: "path", detail: "str — path + query" },
  { label: "headers", detail: "mapping — HTTP headers" },
  { label: "text()", detail: "str — body as text" },
  { label: "redirect(url)", detail: "redirect the request" },
  { label: "block(status, message)", detail: "block with a response" },
];

const CONTEXT_PROPS: Item[] = [
  { label: "state", detail: "shared key/value store" },
  { label: "log(type, message, level, **data)", detail: "emit event to Observability" },
  { label: "notify(type, message, level, **data)", detail: "send UI notification" },
  { label: "run_node(node_name, args)", detail: "run a registered custom node" },
  { label: "run_async(work)", detail: "queue a callable on the policy worker" },
];

const STATE_PROPS: Item[] = [
  { label: "get(key, default)", detail: "read with fallback" },
  { label: "setdefault(key, value)", detail: "get or create" },
];

const TOP_LEVEL: Item[] = [
  { label: "input", detail: "previous node output" },
  { label: "request", detail: "current HTTP request" },
  { label: "context", detail: "state/log/node helpers" },
  { label: "params", detail: "configured node values" },
];

function completionsFor(prefix: string): Item[] | null {
  if (prefix === "request.") return REQUEST_PROPS;
  if (prefix === "context.") return CONTEXT_PROPS;
  if (prefix === "context.state.") return STATE_PROPS;
  return null;
}

export function pythonCompletionSource(ctx: CompletionContext): CompletionResult | null {
  // Dot completions: request. / context. / context.state.
  const dotMatch = ctx.matchBefore(/[\w.]+\./);
  if (dotMatch) {
    const items = completionsFor(dotMatch.text);
    if (items) {
      return {
        from: dotMatch.to,
        options: items.map((item) => ({ label: item.label, detail: item.detail, type: "property" })),
      };
    }
  }

  // Word completions: top-level identifiers
  const word = ctx.matchBefore(/\w+/);
  if (!word || word.from === word.to) return null;
  // Only suggest if explicitly requested (Tab) or at least 2 chars typed
  if (!ctx.explicit && word.text.length < 2) return null;
  return {
    from: word.from,
    options: TOP_LEVEL.map((item) => ({ label: item.label, detail: item.detail, type: "variable" })),
  };
}
