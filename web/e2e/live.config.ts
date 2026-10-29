// The /rate flow against a deployed preview and its real API (PREVIEW_URL, VERCEL_BYPASS).
// Run through op run so the bypass secret never sits in a file:
//   op run --env-file=<hub>/tools/stilldrawn-explorer.env.op -- env PREVIEW_URL=https://… npx playwright test -c e2e/live.config.ts
import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

if (!process.env.PREVIEW_URL || !process.env.VERCEL_BYPASS) throw new Error("PREVIEW_URL and VERCEL_BYPASS must be set");

export default defineConfig({
  ...base,
  webServer: undefined,
  testIgnore: [],
  testMatch: /rate-live\.spec\.ts/,
  timeout: 180_000,
  use: { ...base.use, baseURL: process.env.PREVIEW_URL },
});
