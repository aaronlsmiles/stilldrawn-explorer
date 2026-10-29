import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { mediaDev } from "./vite/media-dev.ts";
import { panelPreload } from "./vite/panel-preload.ts";

const MEDIA = fileURLToPath(new URL("../pipeline/out/media", import.meta.url));
const DATA = fileURLToPath(new URL("./public/data/v1", import.meta.url));

export default defineConfig({
  plugins: [react(), mediaDev(MEDIA), panelPreload(DATA)],
  test: { environment: "jsdom", include: ["src/**/*.test.{ts,tsx}", "vite/**/*.test.ts", "api/**/*.test.ts"] },
});
