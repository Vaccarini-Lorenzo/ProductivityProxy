import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createDefaultConfig } from "@app/models/config/defaultConfig";
import { GraphEditor, paramsToText } from "@app/components/GraphEditor";

describe("GraphEditor", () => {
  it("renders graph panel with mode name", () => {
    const config = createDefaultConfig();
    const mode = config.modes[0];

    const markup = renderToStaticMarkup(
      <GraphEditor mode={mode} onGraphChange={() => undefined} onAddNode={() => undefined} />,
    );

    expect(markup).toContain("Productivity graph");
    expect(markup).toContain("[+] block");
    expect(markup).toContain("[+] log");
  });

  it("formats params as editable JSON", () => {
    expect(paramsToText({ message: "Blocked" })).toContain("Blocked");
  });
});
