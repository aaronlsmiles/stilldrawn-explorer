import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import { ENGINE_IN_URL, seedSession } from "./rateFlow";
import { loadFixture, withMasked } from "./maskedFixtures";
import { pairVerdict } from "../src/test/pairVerdict";

const px = (v: number) => `${v.toFixed(2).replace("-", "−")} px`;
const rowCells = (page: Page) =>
  page.getByTestId("league-row").evaluateAll((rs) => rs.map((r) => [r.getAttribute("data-engine"), ...[...r.querySelectorAll("td.num")].map((c) => c.textContent)]));

test("values equal the contract", async ({ page }) => {
  await withMasked(page);
  const fx = loadFixture("pending");
  await page.goto("/tax/masked");
  const c = fx.test2.conditions.all.aaron.m32;
  await expect(page.getByTestId("league-row")).toHaveCount(5);
  const got = await rowCells(page);
  expect(got.map((r) => r[0])).toEqual(fx.engine_order);
  for (const [engine, , whole, masked] of got) {
    expect(whole).toBe(px(c.D_whole_px[engine as string]));
    expect(masked).toBe(px(c.D_masked_px[engine as string]));
  }
  await expect(page.getByTestId("headline")).toHaveText([fx.test2.headline_md.aaron, fx.test2.headline_md.agent]);   // A9.4: one per mask set
  await expect(page.getByTestId("headline-label")).toHaveText(["Aaron's set", "Blind set"]);
  await expect(page.getByTestId("sensitivity")).toHaveCount(0);
  for (const h of await page.locator(".panel-head").all()) await expect(h.locator(".chip")).toHaveText("Exploratory, post-hoc · A9");   // verdict and slopegraph panels too
});

test("switching announces and changes the URL, not the verdict", async ({ page }) => {
  await withMasked(page);
  const fx = loadFixture("pending");
  await page.goto("/tax/masked");
  await expect(page.getByTestId("verdict")).toBeVisible();
  const verdict = await page.getByTestId("verdict").textContent();
  await page.getByRole("radio", { name: "Blind set" }).click();
  await page.getByRole("radio", { name: "64 px" }).click();
  await expect(page).toHaveURL(/masks=agent&margin=64|margin=64&masks=agent/);
  const c = fx.test2.conditions.all.agent.m64;
  await expect(page.getByTestId("headline")).toHaveCount(1);        // off the registered condition: the chosen condition's own headline
  await expect(page.getByTestId("headline-label")).toHaveText("Blind set, 64 px, all cells");
  await expect(page.getByTestId("headline")).toContainText(`from ${c.ratio_whole.toFixed(1)}× to ${c.ratio_masked.toFixed(1)}×`);
  await expect(page.getByTestId("sensitivity")).toContainText(/registered view is 32 px on all cells/);
  await expect(page.getByRole("status")).toContainText(/Blind set, 64 px: Gen-4\.5\/Wan/);
  expect(await page.getByTestId("verdict").textContent()).toBe(verdict);
  await expect(page.getByTestId("sensitivity")).toBeVisible();
});

test("deep links restore and survive a reload", async ({ page }) => {
  await withMasked(page);
  await page.goto("/tax/masked?masks=agent&margin=16&split=burst&row=act-black-2_idle&table=1");
  const check = async () => {
    await expect(page.getByRole("radio", { name: "Blind set" })).toBeChecked();
    await expect(page.getByRole("radio", { name: "16 px" })).toBeChecked();
    await expect(page.getByRole("radio", { name: "Burst only" })).toBeChecked();
    await expect(page.getByRole("region", { name: /act-black-2 idle, by engine/ })).toBeVisible();
    await expect(page.getByRole("table", { name: /All six conditions/ })).toBeVisible();
  };
  await check();
  await page.reload();
  await check();
});

test("Test 1 in all four states, Test 2 in all five verdicts", async ({ page }) => {
  await withMasked(page, "pending");
  await page.goto("/tax/masked");
  const t1 = page.locator(".mk-test1");
  await expect(t1).toContainText("provisional (AARON only)");
  await expect(t1).toContainText("No verdict until the second rater");
  await expect(page.getByTestId("test1-verdict")).toHaveCount(0);
  await expect(t1).not.toContainText(/Supported|Not supported/);

  for (const [state, want] of [["fallback", /Not tested by two raters/], ["fallback-late", /Not tested by two raters/], ["two-rater", /Verdict: (Supported|Not supported)/]] as const) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await withMasked(page, state);
    await page.goto("/tax/masked");
    await expect(page.locator(".mk-test1")).toContainText(want);
  }
  const lines: Record<string, RegExp> = {
    "not testable": /^Not testable/, supported: /^Supported/, "mask-dependent": /^Mask-dependent/, killed: /^Killed/, "not supported": /^Not supported/,
  };
  for (const [v, re] of Object.entries(lines)) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await withMasked(page, "pending", (j) => { pairVerdict(j, v as Parameters<typeof pairVerdict>[1]); });   // numbers that agree with the word
    await page.goto("/tax/masked");
    await expect(page.locator(".verdict-line")).toHaveText(re);
  }
});

test("fallback with R7's late files: both raters author-rated, kappa shown, no verdict, a past-tense declaration", async ({ page }) => {
  await withMasked(page, "fallback-late");
  await page.goto("/tax/masked");
  const t1 = page.locator(".mk-test1");
  await expect(t1).toContainText("Not tested by two raters");
  await expect(t1.locator(".mk-rater")).toHaveCount(2);
  await expect(t1.locator('[data-rater="R7"] .chip')).toHaveText("author-rated");
  await expect(t1).toContainText(/Agreement between the raters.*burst 1\.00.*push 1\.00/);
  await expect(page.getByTestId("test1-verdict")).toHaveCount(0);
  await expect(page.getByTestId("r7-note")).toHaveText("R7 declared not having seen the explorer, the release or these clips before rating.");
  await expect(t1).not.toContainText(/Verdict:/);
});

test("pending: the R7 declaration is not in the past tense", async ({ page }) => {
  await withMasked(page, "pending");
  await page.goto("/tax/masked");
  await expect(page.getByTestId("r7-note")).toHaveText("R7 has declared not having seen the explorer, the release or these clips.");
});

test("the portrait tank panel's margin is drawn on its own grid (about 91 px for 32, not 51)", async ({ page }) => {
  await withMasked(page);
  await page.goto("/tax/masked");
  const w = await page.locator('[data-testid="mk-tile"][data-row="cip-act-tank-1_idle"] mask path').getAttribute("stroke-width");
  expect(Number(w)).toBeGreaterThan(90);
  expect(Number(w)).toBeLessThan(92);
});

test("no wording the rules forbid", async ({ page }) => {
  await withMasked(page);
  await page.goto("/tax/masked");
  await expect(page.getByTestId("headline").first()).toBeVisible();
  expect(await page.locator("main").innerText()).not.toMatch(/doubling|log2|rank/i);
  await expect(page.locator(".league-table thead")).not.toContainText(/rank|#/i);
  await expect(page.locator(".chip", { hasText: "Exploratory, post-hoc · A9" }).first()).toBeVisible();
});

test("gallery: 22 rows, marks, posters, Open in Explore", async ({ page }) => {
  await withMasked(page);
  await page.goto("/tax/masked");
  const tiles = page.getByTestId("mk-tile");
  await expect(tiles).toHaveCount(22);
  await expect(page.locator('[data-testid="mk-tile"][data-eligible="false"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="mk-tile"][data-eligible="false"]')).toContainText(/Left out/);
  await expect(page.locator('[data-testid="mk-tile"][data-row="chain-est-cosmic-1_burst"]')).toContainText(/Nothing may move/);

  await page.locator('[data-testid="mk-tile"][data-row="act-black-2_idle"]').click();
  const engines = page.getByTestId("mk-engine");
  await expect(engines).toHaveCount(5);
  await expect(engines.locator("img")).toHaveCount(5);
  for (const e of await engines.all()) await expect(e.locator("dd")).toHaveCount(2);

  await page.locator('[data-testid="mk-tile"][data-row="cu-tone-3_idle"]').click();
  await expect(page.getByTestId("mk-engine").locator("img")).toHaveCount(4);
  await expect(page.locator(".is-missing")).toContainText("Not generated");

  await page.locator('[data-testid="mk-tile"][data-row="act-black-2_idle"]').click();
  await page.locator('[data-testid="mk-engine"][data-engine="gen4.5"] a', { hasText: "Open in Explore" }).click();
  await expect(page).toHaveURL(/\/explore\?cell=act-black-2_idle&e=gen4\.5/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("main")).toContainText(/act-black-2/);
});

test("unpublished: says so, requests nothing, no link from /tax", async ({ page }) => {
  const asked: string[] = [];
  page.on("request", (r) => { if (/masked\.json/.test(r.url())) asked.push(r.url()); });
  // the committed index now carries masked: true (real A9 data); force the unpublished state here
  await page.route("**/data/v1/index.json", async (r) => {
    const res = await r.fetch();
    await r.fulfill({ response: res, json: { ...(await res.json()), masked: false } });
  });
  await page.goto("/tax/masked");
  await expect(page.getByText(/not published yet/)).toBeVisible();
  await page.goto("/tax");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(page.locator('a[href="/tax/masked"]')).toHaveCount(0);
  expect(asked).toEqual([]);
});

test("/rate never requests masked.json, even with the flag on", async ({ page }) => {
  await withMasked(page);
  await seedSession(page, "0b6f3c2e-9a41-4d7e-b5c8-2f1e6a9d4c37");
  const urls: string[] = [];
  page.on("request", (r) => urls.push(r.url()));
  await page.goto("/rate");
  await expect(page.locator('[data-bp="session"]')).toBeVisible();
  expect(urls.filter((u) => /masked/i.test(u))).toEqual([]);
  expect(urls.filter((u) => ENGINE_IN_URL.test(new URL(u).pathname))).toEqual([]);

  for (const path of ["/explore", "/scatter", "/tax"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  }
  expect(urls.filter((u) => /masked/i.test(u))).toEqual([]);

  // via the app's own navigation, rather than a fresh load
  urls.length = 0;
  await page.goto("/tax");
  await page.evaluate(() => { history.pushState(null, "", "/rate"); dispatchEvent(new PopStateEvent("popstate")); });
  await expect(page.locator('[data-bp="session"]')).toBeVisible();
  expect(urls.filter((u) => /masked/i.test(u))).toEqual([]);
});
