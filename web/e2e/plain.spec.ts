// The plain-words layer (src/plainwords/; the hub's docs/plain-words.md): the invite and the switch,
// a link that opens it, the trail through the five chapters, /rate still blind with it on, and the
// page left exactly as it was until a reader asks.
import type { Page } from "@playwright/test";
import { test, expect, isPhone } from "./fixtures";
import { leaks, seedSession } from "./rateFlow";
import { CHAPTERS } from "../src/plainwords/words";

const VIEWS = ["/explore", "/explore/failures", "/scatter", "/tax", "/rate", "/about"];

async function open(page: Page, u: string) {
  await page.route((url) => url.pathname === "/api/tally", (r) => r.fulfill({ status: 200, json: { study: "x", n_sessions: 0, items: {} } }));
  await page.goto(u);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
}
const band = (page: Page) => page.locator(".pw-band");

for (const u of VIEWS) {
  test(`${u}: until asked, only the invite shows; no band and no notes`, async ({ page }) => {
    await open(page, u);
    await expect(page.locator(".pw-invite")).toContainText("New to this?");
    await expect(band(page)).toHaveCount(0);
    await expect(page.locator(".pw-note")).toHaveCount(0);
  });
}

test("the invite turns the layer on, and it stays on after a reload", async ({ page }) => {
  await open(page, "/explore");
  await page.getByRole("button", { name: "Read it in plain words" }).click();
  await expect(band(page)).toContainText(`1 of ${CHAPTERS.length}`);
  await expect(band(page).locator(".pw-title")).toHaveText(CHAPTERS[0].title);
  await expect(page.locator(".pw-note").first()).toBeVisible();
  await page.reload();
  await expect(band(page)).toContainText(`1 of ${CHAPTERS.length}`);
});

test("Not now puts the invite away for this visit; the top-bar switch brings the layer back, and Hide puts it away", async ({ page }) => {
  await open(page, "/scatter");
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(page.locator(".pw-invite, .pw-band")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".pw-invite, .pw-band")).toHaveCount(0);
  if (isPhone(page)) await page.getByRole("button", { name: "Menu" }).click();
  const sw = page.getByRole("button", { name: "Plain words" });
  await expect(sw).toHaveAttribute("aria-pressed", "false");
  await sw.click();
  await expect(band(page)).toContainText(`2 of ${CHAPTERS.length}`);
  await expect(page.locator(".pw-note")).toHaveCount(1);
  await page.getByRole("button", { name: "Hide plain words" }).click();
  await expect(page.locator(".pw-invite, .pw-band, .pw-note")).toHaveCount(0);
});

test("the next visit asks again after Not now (it is not No)", async ({ page }) => {
  await open(page, "/tax");
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(page.locator(".pw-invite")).toHaveCount(0);
  await page.evaluate(() => sessionStorage.clear()); // a new visit
  await page.reload();
  await expect(page.locator(".pw-invite")).toContainText("New to this?");
});

test("focus follows the reader: into the band when it opens or a chapter turns, to the switch that brings it back when it goes", async ({ page }) => {
  const back = () => (isPhone(page) ? page.getByRole("button", { name: "Menu" }) : page.getByRole("button", { name: "Plain words" }));
  await open(page, "/scatter");
  await page.getByRole("button", { name: "Read it in plain words" }).click();
  await expect(band(page)).toBeFocused();
  await band(page).locator(".pw-next").click();
  await expect(page).toHaveURL(/\/tax$/);
  await expect(band(page)).toBeFocused();
  await page.getByRole("button", { name: "Hide plain words" }).click();
  await expect(back()).toBeFocused();
  await page.evaluate(() => { localStorage.removeItem("sd-plain"); sessionStorage.clear(); });
  await open(page, "/rate");
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(back()).toBeFocused();
});

test("the band's chapter title is a heading, the page keeps its one h1, and Skip to content lands on the band", async ({ page }) => {
  await open(page, "/tax?plain=1");
  await expect(band(page).getByRole("heading", { level: 2 })).toHaveText(CHAPTERS[2].title);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("a.skip")).toHaveAttribute("href", "#plain-words");
  await open(page, "/tax?plain=0");
  await expect(page.locator("a.skip")).toHaveAttribute("href", "#main");
});

test("a link with ?plain=1 opens straight into the layer, and ?plain=0 closes it", async ({ page }) => {
  await open(page, "/tax?plain=1");
  await expect(band(page)).toContainText(`3 of ${CHAPTERS.length}`);
  await expect(page.locator('[data-note="tax.slider"]')).toBeVisible();
  await open(page, "/tax?plain=0");
  await expect(page.locator(".pw-invite, .pw-band, .pw-note")).toHaveCount(0);
});

test("a reader's own click settles it: Hide drops ?plain=1 from the address, so a reload stays off", async ({ page }) => {
  await open(page, "/tax?plain=1&lens=price");
  await page.getByRole("button", { name: "Hide plain words" }).click();
  await expect(page).toHaveURL(/\/tax\?lens=price$/);
  await page.reload();
  await expect(page.locator(".pw-invite, .pw-band, .pw-note")).toHaveCount(0);
});

test("Next walks the whole trail, one h1 on every page, and the last chapter leads back to the start", async ({ page }) => {
  await open(page, "/explore?plain=1");
  for (let i = 0; i < CHAPTERS.length; i++) {
    await expect(page).toHaveURL(new RegExp(`${CHAPTERS[i].path}(\\?|$)`));
    await expect(band(page)).toContainText(`${i + 1} of ${CHAPTERS.length}`);
    await expect(band(page).locator(".pw-title")).toHaveText(CHAPTERS[i].title);
    await expect(page.locator("h1")).toHaveCount(1);
    const next = band(page).locator(".pw-next");
    await expect(next).toContainText(i + 1 < CHAPTERS.length ? CHAPTERS[i + 1].title : "Back to the start");
    if (i + 1 < CHAPTERS.length) await next.click();
  }
  await band(page).locator(".pw-next").click();
  await expect(page).toHaveURL(/\/explore$/);
  await expect(band(page)).toContainText(`1 of ${CHAPTERS.length}`);
});

test("the side room has an unnumbered band and leads back onto the trail", async ({ page }) => {
  await open(page, "/explore/failures?plain=1");
  await expect(band(page)).toContainText("a side room");
  await band(page).locator(".pw-next").click();
  await expect(page).toHaveURL(/\/scatter$/);
  await expect(band(page)).toContainText(`2 of ${CHAPTERS.length}`);
});

test("/about: a note before each of the thesis's three sections, in both tellings", async ({ page }) => {
  for (const u of ["/about?plain=1", "/about?read=object"]) {
    await open(page, u);
    const order = await page.locator("article.thesis").evaluate((a) =>
      [...a.querySelectorAll(".pw-note, h2")].map((e) => (e.tagName === "H2" ? "h2" : "note")));
    expect(order).toEqual(["note", "h2", "note", "h2", "note", "h2"]);
  }
});

test("/rate with the layer on still names no model", async ({ page }) => {
  await seedSession(page, "5d1e7a2c-3b4f-4a6d-8e9f-0c1b2a3d4e5f");
  await open(page, "/rate?plain=1");
  await expect(band(page)).toContainText(`4 of ${CHAPTERS.length}`);
  await expect(page.locator('[data-note="rate.blind"]')).toBeVisible();
  expect(leaks(await page.content())).toEqual([]);
});

test("reflows at 320 px (a 1280 px screen at 400% zoom) with the layer on, on every view", async ({ page }) => {
  test.skip(!isPhone(page), "one narrow width is enough");
  await page.setViewportSize({ width: 320, height: 720 });
  await page.addInitScript(() => localStorage.setItem("sd-plain", "on"));
  for (const u of VIEWS) {
    await open(page, u);
    await expect(band(page)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth), u).toBeLessThanOrEqual(320);
  }
});
