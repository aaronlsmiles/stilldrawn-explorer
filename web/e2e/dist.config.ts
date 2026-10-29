// Specs against a production build that streams media from the contract's media host:
//   VITE_MEDIA_BASE= npm run build && npx vite preview --port 5320 &
//   DIST_URL=http://localhost:5320 ALL_CLIPS=1 npx playwright test -c e2e/dist.config.ts allclips.spec.ts
import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

if (!process.env.DIST_URL) throw new Error("DIST_URL must be set");

export default defineConfig({ ...base, webServer: undefined, testIgnore: /rate-live\.spec\.ts/, use: { ...base.use, baseURL: process.env.DIST_URL } });
