import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("App", () => {
  it("renders the dashboard shell with active mode", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("ProductivityProxy");
    expect(markup).toContain("Productivity");
    expect(markup).toContain("Proxy stopped");
  });
});
