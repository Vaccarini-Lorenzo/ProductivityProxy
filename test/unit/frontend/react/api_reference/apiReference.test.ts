import { describe, expect, it } from "vitest";

import { apiReference, fuzzyMatch, searchApiReference } from "@app/services/apiReference/apiReference";

describe("apiReference", () => {
  it("documents non-empty groups and entries", () => {
    expect(apiReference.groups.length).toBeGreaterThan(0);
    for (const group of apiReference.groups) {
      expect(group.entries.length).toBeGreaterThan(0);
      for (const entry of group.entries) {
        expect(entry.name).toBeTruthy();
        expect(entry.type).toBeTruthy();
        expect(entry.summary).toBeTruthy();
      }
    }
  });

  it("returns every group for an empty query, preserving documented order", () => {
    const all = searchApiReference("   ");
    expect(all.map((group) => group.id)).toEqual(apiReference.groups.map((group) => group.id));
  });

  it("filters to matching entries and drops unrelated ones", () => {
    const names = searchApiReference("triggered").flatMap((group) => group.entries.map((entry) => entry.name));
    expect(names).toContain("triggered_by(context)");
    expect(names).not.toContain("params[key]");
  });

  it("returns a full group when its title matches", () => {
    const groups = searchApiReference("requestcontext");
    const context = groups.find((group) => group.id === "context");
    expect(context).toBeDefined();
    const original = apiReference.groups.find((group) => group.id === "context")!;
    expect(context!.entries.length).toBe(original.entries.length);
  });

  it("isolates one entry for a function-name query (the editor seed)", () => {
    const entries = searchApiReference("if_condition").flatMap((group) => group.entries);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("if_condition(input)");
    expect(entries[0].details?.length ?? 0).toBeGreaterThan(0);
  });

  it("fuzzy-matches identifier subsequences", () => {
    expect(fuzzyMatch("now", "context.now()")).toBe(true);
    expect(fuzzyMatch("ctxlog", "context.log")).toBe(true);
    expect(fuzzyMatch("zzz", "context.now()")).toBe(false);
  });
});
