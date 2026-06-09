import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createDefaultConfig } from "@app/models/config/defaultConfig";
import { addEdge, addNode } from "@app/services/graph/graphOperations";
import { GraphEditor, paramsToText } from "@app/components/GraphEditor";

describe("GraphEditor", () => {
  it("renders nodes, edges, and accessible controls", () => {
    const config = createDefaultConfig();
    const mode = config.modes[0];
    mode.graph = addNode(mode.graph, "block");
    mode.graph = addEdge(mode.graph, "productivity-start", "next", "block-2");

    const markup = renderToStaticMarkup(
      <GraphEditor
        mode={mode}
        selectedNodeId="block-2"
        edgeOutput="next"
        edgeFrom="productivity-start"
        edgeTo="block-2"
        paramsText="{}"
        onSelectNode={() => undefined}
        onAddNode={() => undefined}
        onParamsTextChange={() => undefined}
        onApplyParams={() => undefined}
        onEdgeOutputChange={() => undefined}
        onEdgeFromChange={() => undefined}
        onEdgeToChange={() => undefined}
        onAddEdge={() => undefined}
      />,
    );

    expect(markup).toContain("Productivity graph");
    expect(markup).toContain("block-2");
    expect(markup).toContain("Params JSON");
    expect(markup).toContain("Operators");
  });

  it("formats params as editable JSON", () => {
    expect(paramsToText({ message: "Blocked" })).toContain("Blocked");
  });
});
