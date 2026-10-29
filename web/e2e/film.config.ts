// Film capture against a production build that streams media from the media host:
//   VITE_MEDIA_BASE= npm run build && npx vite preview --port 5320 &
//   FILM_URL=http://localhost:5320 npx playwright test -c e2e/film.config.ts [-g p01] [--project film-phone]
// One worker, so the screenshot loop and the videos have the machine to themselves.
import { defineConfig } from "@playwright/test";

if (!process.env.FILM_URL) throw new Error("FILM_URL must be set");

export default defineConfig({
  testDir: ".",
  testMatch: /film\.spec\.ts/,
  timeout: 900_000,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: process.env.FILM_URL, colorScheme: "light" },
  projects: [
    { name: "film-desktop", use: { viewport: { width: 1440, height: 810 }, deviceScaleFactor: 4 / 3 } },
    { name: "film-phone", use: { viewport: { width: 390, height: 563 }, deviceScaleFactor: 1080 / 390, hasTouch: true, isMobile: true } },
  ],
});
