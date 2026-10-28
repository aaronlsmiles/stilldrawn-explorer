import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

const order = (page: Page, scope = page.locator("body")) =>
  scope.getByTestId("board-row").evaluateAll((rs) => rs.map((r) => r.getAttribute("data-engine")));

test("price 0 gives the paper's league; past the computed crossover Gen-4.5 leads", async ({ page }) => {
  await page.goto("/tax?lens=price&p=0");
  await expect(page.getByText(/pre-registration amendment A6/i).first()).toBeVisible();
  await expect(page.getByTestId("board-row")).toHaveCount(5);
  expect(await order(page)).toEqual(["wan22", "gen4_turbo", "ltx23", "gen4.5", "h3-fal"]);
  const paper = await page.evaluate(async () => (await fetch("/data/v1/paper.json")).json());
  const last = paper.price_crossovers.value.at(-1);
  await page.goto(`/tax?lens=price&p=${(last.p_from + 0.01).toFixed(2)}`);
  await expect.poll(() => order(page).then((o) => o[0])).toBe("gen4.5");
});

test("price slider by keyboard reorders and announces", async ({ page }) => {
  await page.goto("/tax?lens=price&p=0");
  const s = page.getByRole("slider", { name: /price of motion/i });
  await s.focus();
  await page.keyboard.press("End");
  await expect(page).toHaveURL(/p=3/);
  await expect(page.getByRole("status")).toContainText(/Gen-4\.5 moves to 1st/);
});

test("crossover marks jump to each leader", async ({ page }) => {
  await page.goto("/tax");
  await page.getByRole("button", { name: /LTX-2\.3 leads/ }).click();
  await expect.poll(() => order(page).then((o) => o[0])).toBe("ltx23");
});

test("band presets reproduce the two reversals", async ({ page }) => {
  await page.goto("/tax?lens=band");
  for (const [pair, winner] of [["gen4_turbo|h3-fal", "h3-fal"], ["gen4_turbo|ltx23", "ltx23"]]) {
    await page.getByLabel(/preset/i).selectOption(pair);
    await expect(page.getByTestId("band-result")).toContainText(/reverses the league/);
    await expect(page.getByTestId("band-result")).toHaveAttribute("data-winner", winner);
  }
  await expect(page.getByTestId("paper-card")).toContainText("5 are usable");
});

test("floor marks thin engines as too few", async ({ page }) => {
  await page.goto("/tax?lens=floor&f=0.01");
  await expect(page.getByText(/too few \(n = \d\)/).first()).toBeVisible();
});

test("lens control switches lenses and keeps a deep link", async ({ page }) => {
  await page.goto("/tax");
  await page.getByRole("radio", { name: "Motion floor" }).check();
  await expect(page).toHaveURL(/lens=floor/);
  await page.getByRole("radio", { name: "Matched-motion band" }).check();
  await expect(page).toHaveURL(/lens=band/);
});

test("G4 compare layout shows the three lenses side by side", async ({ page }) => {
  await page.goto("/tax?view=compare");
  await expect(page.getByTestId("lens-panel")).toHaveCount(3);
  for (const p of await page.getByTestId("lens-panel").all()) await expect(p.getByTestId("board-row")).toHaveCount(5);
});

test("no horizontal page scroll on tax", async ({ page }) => {
  for (const u of ["/tax", "/tax?lens=band&preset=gen4_turbo%7Cltx23", "/tax?view=compare"]) {
    await page.goto(u);
    await expect(page.getByTestId("board-row").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), u).toBe(true);
  }
});
