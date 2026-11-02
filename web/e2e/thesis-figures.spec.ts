// The thesis's two figures, exported from the app itself into public/thesis/: desktop at 2x and
// the phone layout at 3x, light and dark. THESIS.md and THESIS-object-first.md name the desktop
// light files; /about swaps in the dark ones and, under 761 px, the phone ones.
import { test, expect, type Page } from "@playwright/test";

// the figures show the page itself, without the plain-words invite or notes
test.beforeEach(({ page }) => page.addInitScript(() => localStorage.setItem("sd-plain", "off")));

const out = (name: string, scheme: string) => `public/thesis/${name}-${scheme}.png`;
const settle = async (page: Page) => {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
};

test("figure 1: motion against line drift", async ({ page }, info) => {
  await page.goto("/scatter");
  await expect(page.locator("[data-testid=pt]")).toHaveCount(170);
  // the app's note says "click a point", which a static figure can't do; the thesis caption explains the marks
  await page.addStyleTag({ content: ".sc-note { display: none !important; }" });
  await settle(page);
  await page.locator(".sc-plot").screenshot({ path: out("scatter", info.project.name) });
});

test("figure 2: the Stillness Tax past the last crossover", async ({ page }, info) => {
  await page.goto("/tax?lens=price&p=2");
  await expect(page.locator(".board-panel tbody tr").first()).toContainText("Gen-4.5");
  await settle(page);
  const top = await page.locator(".seg-jump").first().boundingBox();
  const body = await page.locator(".lens-body").boundingBox();
  if (!top || !body) throw new Error("tax layout not found");
  const pad = 8;
  const x = Math.max(0, body.x - pad);
  await page.screenshot({
    path: out("tax", info.project.name),
    fullPage: true,
    clip: { x, y: top.y - pad, width: Math.min(body.width + 2 * pad, page.viewportSize()!.width - x), height: body.y + body.height - top.y + 2 * pad },
  });
});

test("link preview: public/og.png, 1200x630", async ({ page }, info) => {
  test.skip(info.project.name !== "light", "one preview image, light");
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.goto("/tax?lens=price&p=2");
  await expect(page.locator(".board-panel tbody tr").first()).toContainText("Gen-4.5");
  await settle(page);
  await page.screenshot({ path: "public/og.png", scale: "css" });
});
