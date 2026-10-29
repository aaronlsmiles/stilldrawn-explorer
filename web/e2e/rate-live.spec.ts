// The real thing: the preview's /rate, its /api/submit and /api/tally, the live database.
// Only desktop-light opts in, so one run adds exactly one row. Its session id is written to
// test-results/live-session.txt for the psql check.
import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { ENGINE_IN_URL, expectNoOverflow, leaks, runSession, seedSession } from "./rateFlow";

// the bypass cookie is set by an API request that shares the context's cookies, so the
// secret never appears in the page's URL or reaches the media host
async function bypass(page: Page) {
  const r = await page.request.head(`/?x-vercel-protection-bypass=${encodeURIComponent(process.env.VERCEL_BYPASS!)}&x-vercel-set-bypass-cookie=true`);
  expect(r.status()).toBe(200);
}

async function toResults(page: Page, session: string, keyboard: boolean) {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await bypass(page);
  // a realistic duration (the scripted run takes seconds; the server flags anything under 20 s)
  await seedSession(page, session, 300);
  await page.goto("/rate");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Rate it yourself");
  await runSession(page, { keyboard });
  expect(leaks(await page.content())).toEqual([]);
  expect(requests.filter((u) => ENGINE_IN_URL.test(u))).toEqual([]);
  await page.getByRole("button", { name: "See where you land" }).click();
  await expect(page.getByRole("heading", { name: "Where you land" })).toBeVisible();
  await expectNoOverflow(page);
}

test("live: rate, see where you land, and (desktop-light only) opt in once", async ({ page }, info) => {
  const session = crypto.randomUUID();
  await toResults(page, session, false);
  await expect(page.getByRole("heading", { name: "Other visitors" })).toBeVisible();
  mkdirSync("test-results/screens", { recursive: true });
  await page.screenshot({ path: `test-results/screens/live-${info.project.name}-results.png`, fullPage: true });
  if (info.project.name !== "desktop-light") return;
  const add = page.getByRole("button", { name: "Add my ratings to the public tally" });
  const sent = page.waitForResponse((r) => r.url().endsWith("/api/submit") && r.request().method() === "POST");
  await add.click();
  expect((await sent).status()).toBe(200);
  await expect(page.getByRole("status").filter({ hasText: "Added. Thank you." })).toBeVisible();
  await expect(add).toBeDisabled();
  writeFileSync("test-results/live-session.txt", session + "\n");
});

test("live: a whole session by keyboard only (no opt-in)", async ({ page }) => {
  await toResults(page, crypto.randomUUID(), true);
});
