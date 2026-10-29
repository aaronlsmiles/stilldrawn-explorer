import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import { ENGINE_IN_URL, expectNoOverflow, leaks, runSession, seedSession, STORAGE_KEY, study } from "./rateFlow";

const SESSION = "5d1e7a2c-3b4f-4a6d-8e9f-0c1b2a3d4e5f";

// The local dev server has no API: mock it, and record what the page sends.
async function mockApi(page: Page) {
  const posts: unknown[] = [];
  await page.route("**/api/submit", async (r) => {
    posts.push(r.request().postDataJSON());
    await r.fulfill({ status: 200, json: { ok: true } });
  });
  await page.route("**/api/tally", (r) => r.fulfill({ status: 200, json: { study: study.id, n_sessions: 0, items: {} } }));
  return posts;
}

async function toResults(page: Page, keyboard = false) {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await seedSession(page, SESSION);
  await page.goto("/rate");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Rate it yourself");
  await expectNoOverflow(page);
  await runSession(page, { keyboard });
  await expectNoOverflow(page);
  // blinding: nothing on the page or in any request so far names a model or a cell
  expect(leaks(await page.content())).toEqual([]);
  expect(requests.filter((u) => ENGINE_IN_URL.test(u))).toEqual([]);
  if (keyboard) {
    const see = page.getByRole("button", { name: "See where you land" });
    for (let i = 0; i < 10 && !(await see.evaluate((b) => b === document.activeElement)); i++) await page.keyboard.press("Tab");
    await expect(see).toBeFocused();
    await page.keyboard.press("Enter");
  } else {
    await page.getByRole("button", { name: "See where you land" }).click();
  }
  await expect(page.getByRole("heading", { name: "Where you land" })).toBeVisible();
  await expectNoOverflow(page);
}

test("the leak check itself catches model names", () => {
  expect(leaks("<p>Gen-4.5 and Wan 2.2</p>")).not.toEqual([]);
  expect(leaks("<h3>Clip 1 of 8</h3>")).toEqual([]);
});

test("blinded session, then results whose reveal links open the clip in Explore without a reload", async ({ page }) => {
  test.setTimeout(120_000);
  await mockApi(page);
  await toResults(page);
  const open = page.locator(".bp-reveal a", { hasText: "Open" });
  await expect(open).toHaveCount(8);
  for (const href of await open.evaluateAll((as) => as.map((a) => a.getAttribute("href")))) expect(href).toMatch(/^\/explore\?cell=/);
  const href = (await open.first().getAttribute("href"))!;
  await page.evaluate(() => ((window as unknown as { marker: number }).marker = 1));
  await open.first().click();
  await expect(page).toHaveURL(href);
  expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(1);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(new URL(href, "http://x").searchParams.get("cell")!.split("_")[0]);
});

test("opt-in sends exactly one submission, with this session's id", async ({ page }) => {
  test.setTimeout(120_000);
  const posts = await mockApi(page);
  await toResults(page);
  const add = page.getByRole("button", { name: "Add my ratings to the public tally" });
  await add.click();
  await expect(page.getByRole("status").filter({ hasText: "Added. Thank you." })).toBeVisible();
  await expect(add).toBeDisabled();
  await page.waitForTimeout(300);
  expect(posts).toHaveLength(1);
  expect(posts[0]).toMatchObject({ study: study.id, session: SESSION });
});

test("a whole session by keyboard only", async ({ page }) => {
  test.setTimeout(120_000);
  await mockApi(page);
  await toResults(page, true);
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), STORAGE_KEY);
  expect(saved.keyboardUsed).toBe(true);
});

test("the kit is themed by the explorer's own tokens, in either theme", async ({ page }) => {
  await mockApi(page);
  await page.goto("/rate");
  const pairs = await page.locator('[data-bp="session"]').evaluate((el) => {
    const bp = getComputedStyle(el), root = getComputedStyle(document.documentElement);
    return [["--bp-paper", "--surface"], ["--bp-ink", "--text"], ["--bp-accent-line", "--gold-line"], ["--bp-font", "--font"]]
      .map(([b, r]) => [bp.getPropertyValue(b).trim(), root.getPropertyValue(r).trim()]);
  });
  for (const [b, r] of pairs) expect(b).toBe(r);
});

test("Rate it yourself is in the nav and marked current", async ({ page }) => {
  await mockApi(page);
  await page.goto("/rate");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Rate it yourself");
  const menu = page.getByRole("button", { name: "Menu" });
  if (await menu.isVisible()) await menu.click();
  await expect(page.getByRole("navigation", { name: "Views" }).getByRole("link", { name: "Rate it yourself" })).toHaveAttribute("aria-current", "page");
});
