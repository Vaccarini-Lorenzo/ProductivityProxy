import type { ModeConfig, PolicyConfig } from "../../models/config/types";

const DEFAULT_START_TRIGGER_CODE = `def triggered_by(context: RequestContext) -> bool:
    return True
`;

export function createMode(name: string, existingIds: string[] = []): ModeConfig {
  const id = uniqueSlug(name, existingIds);
  return {
    id,
    name,
    description: "",
    policyIds: [],
  };
}

export function createPolicy(idBase: string, name: string, existingIds: string[] = []): PolicyConfig {
  const id = uniqueSlug(idBase, existingIds);
  return {
    id,
    name,
    steps: [
      { id: `${id}-start`, kind: "node", type: "start", position: { x: 80, y: 200 }, params: { code: DEFAULT_START_TRIGGER_CODE } },
      { id: `${id}-end`, kind: "node", type: "end", position: { x: 520, y: 200 } },
    ],
    edges: [{ from: `${id}-start`, output: "next", to: `${id}-end` }],
  };
}

export function slug(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}

export function uniqueSlug(value: string, existingIds: string[]): string {
  const base = slug(value);
  const existing = new Set(existingIds);
  if (!existing.has(base)) return base;
  let index = 2;
  while (existing.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}
