export function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

export function includesSearch(query: string, text: string): boolean {
  const q = normalizeQuery(query);
  return !q || text.toLowerCase().includes(q);
}

/** Subsequence fuzzy match: every query char appears in order in the text. */
export function fuzzyMatch(query: string, text: string): boolean {
  const q = normalizeQuery(query);
  if (!q) return true;
  const t = text.toLowerCase();
  let index = 0;
  for (const ch of q) {
    if (ch === " ") continue;
    const next = t.indexOf(ch, index);
    if (next === -1) return false;
    index = next + 1;
  }
  return true;
}
