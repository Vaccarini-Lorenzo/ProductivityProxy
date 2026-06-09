import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("App", () => {
  it("renders the full dashboard shell", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("ProductivityProxy");
    expect(markup).toContain("Proxy stopped");
    expect(markup).toContain("Policy modes");
    expect(markup).toContain("Productivity graph");
    expect(markup).toContain("Custom blocks");
    expect(markup).toContain("Proxy settings");
    expect(markup).toContain("Android setup");
    expect(markup).toContain("Recent proxy events");
  });
});
