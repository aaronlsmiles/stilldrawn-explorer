import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { mediaDev } from "./vite/media-dev.ts";
import { panelPreload } from "./vite/panel-preload.ts";
import { thesis } from "./vite/thesis.ts";

const MEDIA = fileURLToPath(new URL("../pipeline/out/media", import.meta.url));
const DATA = fileURLToPath(new URL("./public/data/v1", import.meta.url));
const REPO = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  plugins: [react(), mediaDev(MEDIA), panelPreload(DATA), thesis(REPO)],
  test: { environment: "jsdom", include: ["src/**/*.test.{ts,tsx}", "vite/**/*.test.ts", "api/**/*.test.ts"] },
});
