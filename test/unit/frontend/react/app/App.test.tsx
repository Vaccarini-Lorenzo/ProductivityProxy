import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { App } from "@app/App";

describe("App", () => {
  it("renders the policies view by default", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("Policies");
    expect(markup).toContain("Modes");
    expect(markup).toContain("Productivity graph");
    expect(markup).toContain("Save config");
  });
});
