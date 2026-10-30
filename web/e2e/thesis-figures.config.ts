// Exports the thesis figures (not a test of behaviour): npx playwright test -c e2e/thesis-figures.config.ts
import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: /thesis-figures\.spec\.ts/,
  projects: (["light", "dark"] as const).flatMap((c) => [
    { name: c, use: { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, colorScheme: c } },
    // phones get the app's own 390 px layout (board above chart), at 3x
    { name: `phone-${c}`, use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, colorScheme: c, hasTouch: true } },
  ]),
});
