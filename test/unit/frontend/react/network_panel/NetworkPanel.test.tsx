import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NetworkPanel } from "@app/components/NetworkPanel";

describe("NetworkPanel", () => {
  it("renders local and android setup information", () => {
    const markup = renderToStaticMarkup(<NetworkPanel port={8080} lanHost="172.20.10.2" onCopy={() => undefined} />);

    expect(markup).toContain("Android setup");
    expect(markup).toContain("127.0.0.1:8080");
    expect(markup).toContain("172.20.10.2:8080");
  });
});
