// The design pass's checks on every view, at every project size and theme (docs/DESIGN.md).
import { test, expect, isPhone } from "./fixtures";
import type { Page } from "@playwright/test";
import { seedSession } from "./rateFlow";

const VIEWS = ["/explore", "/explore?arm=standard", "/explore/failures", "/scatter", "/scatter?arms=repeat,hazard,ground,seedance", "/tax", "/tax?lens=band", "/tax?p=1.3", "/rate", "/about", "/about?read=object"];
const SCALE = [12, 14, 16, 24];

async function open(page: Page, u: string) {
  await page.route((url) => url.pathname === "/api/tally", (r) => r.fulfill({ status: 200, json: { study: "x", n_sessions: 0, items: {} } }));
  await page.goto(u);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

/** Every visible piece of text, with its size, where the size is off the type scale. */
const offScale = (page: Page) => page.evaluate((scale) => {
  const out = new Set<string>();
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const el = n.parentElement;
    if (!el || !n.textContent?.trim()) continue;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (!r.width || !r.height || cs.visibility === "hidden" || el.closest(".visually-hidden, .bp-sr, [hidden]")) continue;
    const px = parseFloat(cs.fontSize);
    if (!scale.includes(px)) out.add(`${px}px ${el.tagName.toLowerCase()}.${[...el.classList].join(".")} "${n.textContent.trim().slice(0, 24)}"`);
  }
  return [...out];
}, SCALE);

// each view as it ships, then again with the plain-words layer on (src/plainwords/)
for (const plain of [false, true]) for (const u of VIEWS) {
  test(`${u}${plain ? " (plain words on)" : ""}: fits the viewport, keeps to the type scale, and every chart label stays inside its chart`, async ({ page }) => {
    if (plain) await page.addInitScript(() => localStorage.setItem("sd-plain", "on"));
    await open(page, u);
    const doc = await page.evaluate(() => document.documentElement.scrollWidth);
    expect.soft(doc, "page width").toBeLessThanOrEqual(page.viewportSize()!.width);
    expect.soft(await offScale(page), "text off the 12/14/16/24 scale").toEqual([]);
    const outside = await page.locator("svg").evaluateAll((svgs) => svgs.flatMap((svg) => {
      const b = svg.getBoundingClientRect();
      return [...svg.querySelectorAll("text")].map((t) => [t.textContent, t.getBoundingClientRect()] as const)
        .filter(([, r]) => r.width && (r.left < b.left - 1 || r.right > b.right + 1 || r.top < b.top - 1 || r.bottom > b.bottom + 1))
        .map(([s, r]) => `"${s}" ${Math.round(r.left - b.left)}..${Math.round(r.right - b.left)} in ${Math.round(b.width)}`);
    }));
    expect.soft(outside, "chart labels outside their chart").toEqual([]);
    const spilled = await page.locator(".panel, .bp-screen, .bp-results").evaluateAll((els) =>
      els.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => `${e.className.split(" ").slice(0, 3).join(".")} ${e.scrollWidth}>${e.clientWidth}`));
    expect.soft(spilled, "content wider than its panel").toEqual([]);
  });
}

test("every contact-sheet row label shows the whole panel name", async ({ page }) => {
  test.skip(isPhone(page), "the phone list shows names at full width");
  await open(page, "/explore");
  const cut = await page.locator(".sl-panel").evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 0.5).map((e) => e.textContent));
  expect(cut).toEqual([]);
});

test("/rate: the kit's card shares the page's left edge, and its headings sit under the page's h1", async ({ page }) => {
  await seedSession(page, "5d1e7a2c-3b4f-4a6d-8e9f-0c1b2a3d4e5f");
  await open(page, "/rate");
  const x = await page.evaluate(() => {
    const left = (s: string) => Math.round(document.querySelector(s)!.getBoundingClientRect().left);
    const size = (s: string) => parseFloat(getComputedStyle(document.querySelector(s)!).fontSize);
    return { h1: left("main h1"), lede: left(".rate-lede"), card: left(".bp-screen"), h1Size: size("main h1"), h2Size: size(".bp-h"),
      h1Text: document.querySelector("main h1")!.textContent!, h2Text: document.querySelector(".bp-h")!.textContent! };
  });
  expect(x.h2Text.startsWith(x.h1Text), `"${x.h2Text}" repeats the page's heading`).toBe(false);
  expect(x.lede).toBe(x.h1);
  expect(x.card).toBe(x.h1);
  expect(x.h2Size).toBeLessThan(x.h1Size);
});
