import { fuzzyMatch, includesSearch } from "../search/search";
import reference from "./pythonApiReference.json";

export interface ApiDetail {
  label: string;
  text: string;
}

export interface ApiEntry {
  name: string;
  type: string;
  summary: string;
  details?: ApiDetail[];
}

export interface ApiGroup {
  id: string;
  title: string;
  icon: string;
  summary?: string;
  entries: ApiEntry[];
}

export interface ApiReference {
  version: string;
  intro?: string;
  groups: ApiGroup[];
}

// Loaded once at module import. The JSON is the single source of truth for
// what is documented and in what order; this module only reads and filters it.
export const apiReference = reference as ApiReference;

/** Filter groups/entries by query, preserving the documented order.
 *  Identifiers use fuzzy (subsequence) matching; type/summary use substring. */
export function searchApiReference(query: string): ApiGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return apiReference.groups;
  const groups: ApiGroup[] = [];
  for (const group of apiReference.groups) {
    const groupHit = fuzzyMatch(q, group.title);
    const entries = group.entries.filter(
      (entry) =>
        groupHit ||
        fuzzyMatch(q, entry.name) ||
        includesSearch(q, entry.type) ||
        includesSearch(q, entry.summary) ||
        (entry.details ?? []).some((detail) => includesSearch(q, `${detail.label} ${detail.text}`)),
    );
    if (entries.length > 0) groups.push({ ...group, entries });
  }
  return groups;
}
