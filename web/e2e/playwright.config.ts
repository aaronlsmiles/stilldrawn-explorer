import { defineConfig } from "@playwright/test";

const sizes = [{ name: "desktop", width: 1440, height: 900 }, { name: "phone", width: 390, height: 844 }];
const schemes = ["light", "dark"] as const;

export default defineConfig({
  testDir: ".",
  testIgnore: /rate-live\.spec\.ts/, // needs a deployed preview: e2e/live.config.ts
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"]],
  webServer: { command: "npx vite --port 5199 --strictPort", port: 5199, reuseExistingServer: true, cwd: ".." },
  use: { baseURL: "http://localhost:5199" },
  projects: sizes.flatMap((s) => schemes.map((c) => ({
    name: `${s.name}-${c}`,
    use: { viewport: { width: s.width, height: s.height }, colorScheme: c, hasTouch: s.name === "phone" },
  }))),
});
