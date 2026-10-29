import { test, expect, isPhone } from "./fixtures";

test("contact sheet shows 33 cells and the refused slot with its reason", async ({ page }) => {
  await page.goto("/explore?arm=standard");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  if (isPhone(page)) {
    await expect(page.getByTestId("panel-row")).toHaveCount(33);
  } else {
    await expect(page.getByTestId("grid-row")).toHaveCount(33);
    await expect(page.getByTestId("cell-missing")).toHaveCount(1);
  }
  await expect(page.getByTestId("missing-note")).toContainText("moderation");
});

test("arms filter switches views and back", async ({ page }) => {
  await page.goto("/explore?arm=standard");
  await page.getByRole("radio", { name: "Ground" }).check();
  await expect(page).toHaveURL(/arm=ground/);
  await page.getByRole("radio", { name: "Hazard (H3)" }).check();
  await expect(page).toHaveURL(/arm=hazard/);
  await page.getByRole("radio", { name: "Standard" }).check();
  await expect(page).toHaveURL(/arm=standard/);
});

test("the default view is the drift test pair", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.getByTestId("player")).toContainText("Gen-4.5");
  await expect(page.getByTestId("player")).toContainText("Wan 2.2");
  await expect(page.locator("[data-testid=clip-video]")).toHaveCount(2);
});

test("selecting a cell deep-links it", async ({ page }) => {
  await page.goto("/explore?arm=standard");
  if (isPhone(page)) await page.getByTestId("panel-row").filter({ hasText: "act-black-2" }).filter({ hasText: "Idle" }).getByRole("button").click();
  else await page.getByRole("button", { name: /act-black-2, Idle, H3/ }).click();
  await expect(page).toHaveURL(/cell=act-black-2_idle/);
  await expect(page.getByTestId("player")).toBeVisible();
});

test("grid is keyboard reachable and arrow keys move the selection", async ({ page }) => {
  test.skip(isPhone(page), "phones use the panel list");
  await page.goto("/explore?arm=standard");
  await expect(page.getByTestId("grid")).toBeVisible();
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    if (await page.evaluate(() => !!document.activeElement?.closest("[data-testid=grid]"))) break;
  }
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/cell=act-black-2_idle&e=gen4_turbo/);
});

test("phone: back from a cell returns to the list", async ({ page }) => {
  test.skip(!isPhone(page), "desktop shows both panes");
  await page.goto("/explore");
  await page.getByRole("button", { name: "All cells" }).click();
  await expect(page.getByTestId("panel-list")).toBeVisible();
});

test("no horizontal page scroll", async ({ page }) => {
  for (const u of ["/explore", "/explore?arm=standard", "/explore?cell=act-black-3_burst&e=h3-fal&draw=h4"]) {
    await page.goto(u);
    await page.waitForLoadState("networkidle");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), u).toBe(true);
  }
});

test("the compare finding leads with the contrast, its ratio computed from the two values it shows", async ({ page }) => {
  await page.goto("/explore");
  const f = page.locator(".detail p.finding");
  await expect(f).toContainText("On this panel, Gen-4.5 drifts");
  const m = (await f.textContent())!.match(/drifts ([\d.]+)× as far as Wan 2\.2 \(([\d.]+) against ([\d.]+) px\)/)!;
  expect(m, "contrast sentence").not.toBeNull();
  expect(Number(m[1])).toBeCloseTo(Number(m[2]) / Number(m[3]), 1);
  await expect(f).toContainText(/22nd steadiest of its 33 cells/);
  // one clip alone keeps the single-engine reading
  await page.goto("/explore?cell=act-tone-2_campush&e=gen4.5");
  await expect(page.locator(".detail p.finding")).toHaveText(/^Gen-4\.5: line drift [\d.]+ px, \d+(st|nd|rd|th) steadiest of its 33 cells; motion [\d.]+\.$/);
});
