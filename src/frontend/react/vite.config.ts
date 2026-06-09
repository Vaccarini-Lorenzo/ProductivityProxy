import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  resolve: {
    alias: {
      "@app": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["../../../test/unit/frontend/react/**/*.test.{ts,tsx}", "../../../test/integration/frontend/react/**/*.test.{ts,tsx}"],
  },
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
  },
});
