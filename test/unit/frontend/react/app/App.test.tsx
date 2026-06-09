import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { App } from "@app/App";

describe("App", () => {
  it("renders settings view by default with navigation", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("Settings");
    expect(markup).toContain("Proxy");
    expect(markup).toContain("Save config");
    expect(markup).toContain("Policies");
    expect(markup).toContain("Nodes");
  });
});
