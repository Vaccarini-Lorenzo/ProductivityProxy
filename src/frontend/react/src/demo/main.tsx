import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "../App";
import { demoClient, demoNotifier } from "./demoClient";
import "../style/index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App client={demoClient} notifier={demoNotifier} />
  </React.StrictMode>,
);
