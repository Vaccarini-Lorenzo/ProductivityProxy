import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createDefaultConfig } from "@app/models/config/defaultConfig";
import { GraphEditor } from "@app/components/GraphEditor";
import { NodeLibrary } from "@app/components/NodeLibrary";

describe("GraphEditor", () => {
  it("renders the policy steps as graph nodes", () => {
    const config = createDefaultConfig();
    const policy = config.policies[0];

    const markup = renderToStaticMarkup(
      <GraphEditor
        policy={policy}
        openStepId={null}
        onPolicyChange={() => undefined}
        onOpenStep={() => undefined}
        onDeleteStep={() => undefined}
      />,
    );

    expect(markup).toContain("start");
    expect(markup).toContain("end");
  });

});

describe("NodeLibrary", () => {
  it("lists flow, logic, and custom nodes", () => {
    const markup = renderToStaticMarkup(
      <NodeLibrary customNodes={[]} hasStart={false} onAddStep={() => undefined} onReadNode={() => Promise.resolve("")} />,
    );

    expect(markup).toContain("Flow");
    expect(markup).toContain("If / Then / Else");
    expect(markup).toContain("Switch");
  });
});
