import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { mediaDev } from "./vite/media-dev.ts";

const MEDIA = fileURLToPath(new URL("../pipeline/out/media", import.meta.url));

export default defineConfig({
  plugins: [react(), mediaDev(MEDIA)],
  test: { environment: "jsdom", include: ["src/**/*.test.{ts,tsx}", "vite/**/*.test.ts", "api/**/*.test.ts"] },
});
