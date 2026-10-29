// Screenshots for the design pass: SHOTS_DIR=<dir> npx playwright test -c e2e/shots.config.ts
import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({ ...base, testIgnore: [], testMatch: /shots\.spec\.ts/, timeout: 60_000, workers: 4 });
