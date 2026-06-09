import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createDefaultConfig } from "@app/models/config/defaultConfig";
import { GraphEditor, paramsToText } from "@app/components/GraphEditor";

describe("GraphEditor", () => {
  it("renders policy panel with nodes and operators", () => {
    const config = createDefaultConfig();
    const policy = config.modes[0].policies[0];

    const markup = renderToStaticMarkup(
      <GraphEditor
        policy={policy}
        customNodes={[]}
        selectedStepId={null}
        onPolicyChange={() => undefined}
        onAddStep={() => undefined}
        onSelectStep={() => undefined}
        onDeleteStep={() => undefined}
      />,
    );

    expect(markup).toContain("Block YouTube Shorts");
    expect(markup).toContain("start");
    expect(markup).toContain("Library");
    expect(markup).toContain("If / Then / Else");
  });

  it("formats params as editable JSON", () => {
    expect(paramsToText({ message: "Blocked" })).toContain("Blocked");
  });
});
