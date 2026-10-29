// Design-pass screenshots of every surface (not a test of behaviour): SHOTS_DIR=<dir> npx playwright test -c e2e/shots.config.ts
import { test, expect } from "@playwright/test";
import { runSession, seedSession } from "./rateFlow";

const out = process.env.SHOTS_DIR ?? "shots";
const settle = async (page: import("@playwright/test").Page) => {
  await page.evaluate(() => { scrollTo(0, 0); return document.fonts.ready; });
  await page.waitForTimeout(800);
};
const shot = async (page: import("@playwright/test").Page, name: string, project: string) => {
  await settle(page);
  await page.screenshot({ path: `${out}/${project}/${name}.png`, fullPage: true });
};

const views: [string, string][] = [
  ["explore", "/explore"],
  ["explore-list", "/explore?arm=standard"],
  ["gallery", "/explore/failures"],
  ["scatter", "/scatter"],
  ["tax", "/tax"],
  ["tax-band", "/tax?lens=band"],
];

for (const [name, path] of views) {
  test(name, async ({ page }, info) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await shot(page, name, info.project.name);
  });
}

const mockTally = (page: import("@playwright/test").Page) =>
  page.route((u) => u.pathname === "/api/tally", (r) => r.fulfill({ status: 200, json: { study: "x", n_sessions: 0, items: {} } }));

test("rate", async ({ page }, info) => {
  test.setTimeout(180_000);
  await mockTally(page);
  await seedSession(page, "5d1e7a2c-3b4f-4a6d-8e9f-0c1b2a3d4e5f");
  await page.goto("/rate");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Rate it yourself");
  await shot(page, "rate-intro", info.project.name);
  await runSession(page);
  await shot(page, "rate-done", info.project.name);
  await page.getByRole("button", { name: "See where you land" }).click();
  await expect(page.getByRole("heading", { name: "Where you land" })).toBeVisible();
  await shot(page, "rate-results", info.project.name);
});

test("rate-clip", async ({ page }, info) => {
  test.setTimeout(120_000);
  await mockTally(page);
  await seedSession(page, "5d1e7a2c-3b4f-4a6d-8e9f-0c1b2a3d4e5f");
  await page.goto("/rate");
  const session = page.locator('[data-bp="session"]');
  const heading = session.getByRole("heading", { level: 2 });
  await session.getByRole("button", { name: "Start" }).click();
  for (let i = 0; i < 30; i++) {
    const h = (await heading.textContent()) ?? "";
    if (h.startsWith("Clip")) break;
    if (h.startsWith("Still")) await shot(page, "rate-still", info.project.name);
    await session.locator("fieldset").first().getByRole("radio", { name: /^5,/ }).check();
    await session.getByRole("button", { name: "Next" }).click();
    await expect(heading).not.toHaveText(h);
  }
  await expect(session.locator("video")).toBeVisible();
  await shot(page, "rate-clip", info.project.name);
});
