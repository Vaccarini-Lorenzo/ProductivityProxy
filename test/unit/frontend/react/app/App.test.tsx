import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { App } from "@app/App";

describe("App", () => {
  it("renders settings view by default with navigation", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("Settings");
    expect(markup).toContain("Proxy control");
    expect(markup).toContain("$ ppx save");
    expect(markup).toContain("Modes");
    expect(markup).toContain("Policy");
    expect(markup).toContain("Observability");
  });
});
