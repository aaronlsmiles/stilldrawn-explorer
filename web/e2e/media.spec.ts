// Responsive images (29 Oct): every panel and poster arrives sharp for its slot but no larger than
// the next step up, and Explore's source panel is fetched once (the HTML's preload and the <img> agree).
import type { Locator } from "@playwright/test";
import { test, expect, isPhone } from "./fixtures";

/** Wait for the image, then compare what arrived with what its slot needs on this screen. */
async function fit(img: Locator) {
  await img.scrollIntoViewIfNeeded();
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  return img.evaluate((i: HTMLImageElement) => ({ src: i.currentSrc, natural: i.naturalWidth, need: Math.ceil(i.clientWidth * devicePixelRatio) }));
}

test("Explore's source panel is fetched once, with the HTML, at the size its slot needs", async ({ page }) => {
  await page.goto("/explore");
  expect(await page.locator("link[rel=preload][as=image]").count()).toBe(2);   // phone and wider: only the matching one fetches
  const r = await fit(page.locator(".frame-media img").first());
  expect(r.natural).toBeGreaterThanOrEqual(r.need);
  expect(r.natural, "no larger than the next step up").toBeLessThanOrEqual(Math.max(320, r.need * 2));
  const fetched = await page.evaluate(() => performance.getEntriesByType("resource").map((e) => e.name).filter((n) => /\/panels\/act-tone-2[-.]/.test(n)));
  expect(fetched).toEqual([r.src]);
});

test.describe("on Lighthouse's phone (a real mobile viewport: 412 px at 1.75x, laid out at 980 until the viewport tag)", () => {
  test.use({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true });
  test("the preload and the <img> still agree, so the panel is fetched once", async ({ page }) => {
    await page.goto("/explore");
    const r = await fit(page.locator(".frame-media img").first());
    const fetched = await page.evaluate(() => performance.getEntriesByType("resource").map((e) => e.name).filter((n) => /\/panels\/act-tone-2[-.]/.test(n)));
    expect(fetched).toEqual([r.src]);
  });
});

test.describe("on a 3x phone (390 px, the default compare view)", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  test("phones stop at the 960 px copy (2.5x), fetched once, not the 1,344 px original", async ({ page }) => {
    await page.goto("/explore");
    const r = await fit(page.locator(".frame-media img").first());
    expect(r.src).toMatch(/act-tone-2-w960\.webp$/);
    const fetched = await page.evaluate(() => performance.getEntriesByType("resource").map((e) => e.name).filter((n) => /\/panels\/act-tone-2[-.]/.test(n)));
    expect(fetched).toEqual([r.src]);
  });
});

test("a deep link without a second engine sizes the panel for the wider single slot", async ({ page }) => {
  await page.goto("/explore?cell=cip-act-tank-1_burst&e=gen4.5");
  const r = await fit(page.locator(".frame-media img").first());
  expect(r.natural).toBeGreaterThanOrEqual(r.need);
  const fetched = await page.evaluate(() => performance.getEntriesByType("resource").map((e) => e.name).filter((n) => n.includes("/panels/cip-act-tank-1")));
  expect(fetched).toEqual([r.src]);
});

test("contact-sheet frames, list thumbnails and gallery posters use the small copies", async ({ page }) => {
  await page.goto("/explore?arm=standard");
  const r = await fit(page.locator(isPhone(page) ? ".plist-btn img" : ".frame-btn img").first());
  expect(r.src).toMatch(/-w320\.webp$/);
  expect(r.natural).toBeGreaterThanOrEqual(r.need);
  await page.goto("/explore/failures");
  const g = await fit(page.locator(".g-clip img").first());
  expect(g.src).toMatch(/-w320\.webp$/);
  expect(g.natural).toBeGreaterThanOrEqual(g.need);
});
