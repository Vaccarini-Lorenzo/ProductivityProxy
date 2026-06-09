import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createDefaultConfig } from "@app/models/config/defaultConfig";
import { GraphEditor, paramsToText } from "@app/components/GraphEditor";

describe("GraphEditor", () => {
  it("renders policy panel with nodes and operators", () => {
    const config = createDefaultConfig();
    const policy = config.modes[0].policies[0];

    const markup = renderToStaticMarkup(
      <GraphEditor policy={policy} customNodes={[]} onPolicyChange={() => undefined} onAddStep={() => undefined} />,
    );

    expect(markup).toContain("Productivity policy");
    expect(markup).toContain("$ add start");
    expect(markup).toContain("$ add if");
  });

  it("formats params as editable JSON", () => {
    expect(paramsToText({ message: "Blocked" })).toContain("Blocked");
  });
});
