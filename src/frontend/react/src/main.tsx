import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./App";
import { Popover } from "./Popover";

function currentWindowLabel(): string {
  const internals = (window as unknown as {
    __TAURI_INTERNALS__?: { metadata?: { currentWindow?: { label?: string } } };
  }).__TAURI_INTERNALS__;
  return internals?.metadata?.currentWindow?.label ?? "main";
}

const isPopover = currentWindowLabel() === "popover";
if (isPopover) document.documentElement.classList.add("popover-mode");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{isPopover ? <Popover /> : <App />}</React.StrictMode>,
);
