// The master plan's full pass: every primary clip (164 standard cells + 6 FLINT) opens in Explore
// from the scatter's table, plays its clip from the media host and draws its curve; the other
// arms are sampled. Network-bound (R2), so desktop-light only and on request: ALL_CLIPS=1.
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

test.skip(!process.env.ALL_CLIPS, "ALL_CLIPS=1 runs it");
test.describe.configure({ mode: "parallel" });

async function hrefs(page: Page, arms?: string) {
  await page.goto(`/scatter${arms ? `?arms=${arms}` : ""}`);
  await page.getByRole("button", { name: /show as table/i }).click();
  return page.locator(".sc-table-wrap td:first-child a").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
}

async function opens(page: Page, href: string) {
  // self-check: ALL_CLIPS_BLOCK=1 blocks the media host, and every part must then fail
  if (process.env.ALL_CLIPS_BLOCK) await page.route(/media\.studionephele\.com\/.*\.mp4/, (r) => r.abort());
  await page.goto(href);
  const a = page.getByTestId("clip-a");
  await expect(a.locator("video")).toBeAttached();
  const ok = await a.locator("video").evaluate((v: HTMLVideoElement) => new Promise<boolean>((done) => {
    if (v.readyState >= 2) return done(true);
    v.addEventListener("loadeddata", () => done(true), { once: true });
    v.addEventListener("error", () => done(false), { once: true });
    if (v.preload === "none") v.load();
    setTimeout(() => done(false), 20_000);
  }));
  expect(ok, `${href}: clip plays`).toBe(true);
  await expect(page.locator(".curve-panel svg path").first(), `${href}: curve`).toHaveAttribute("d", /^M/);
}

const CHUNKS = 10;
for (let k = 0; k < CHUNKS; k++) {
  test(`primary clips, part ${k + 1} of ${CHUNKS}`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-light", "desktop-light only");
    test.setTimeout(600_000);
    const all = await hrefs(page);
    expect(all).toHaveLength(170);
    for (const h of all.filter((_, i) => i % CHUNKS === k)) await opens(page, h);
  });
}

test("other arms, sampled", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-light", "desktop-light only");
  test.setTimeout(600_000);
  const primary = new Set(await hrefs(page));
  const more = (await hrefs(page, "ground,hazard,repeat,seedance")).filter((h) => !primary.has(h));
  expect(more.length).toBeGreaterThan(100);
  for (const h of more.filter((_, i) => i % 10 === 0)) await opens(page, h);
});
