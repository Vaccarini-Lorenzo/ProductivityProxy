// Browser-preview fallback for default node sources.
// The real app reads node files from disk; this only runs in browser preview
// (no Tauri). Sources are bundled straight from the actual Python files so they
// never drift from src/proxy/defaults/nodes/*.py.
const RAW_SOURCES = import.meta.glob("../../../../../proxy/defaults/nodes/*.py", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const SOURCES: Record<string, string> = Object.fromEntries(
  Object.entries(RAW_SOURCES).map(([path, source]) => [basename(path), source]),
);

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export function bundledNodeSource(path: string): string | undefined {
  return SOURCES[basename(path)];
}
