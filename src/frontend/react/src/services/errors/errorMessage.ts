export function errorMessage(error: unknown, invokeMessage = "Browser preview — Tauri unavailable"): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.includes("invoke") ? invokeMessage : text;
}
