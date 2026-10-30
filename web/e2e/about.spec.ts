// /about: the thesis in two tellings, finding first by default and object first behind a switch.
import { readFileSync } from "node:fs";
import { test, expect, isPhone } from "./fixtures";

const md = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const firstLine = (f: string) => md(f).split("\n\n")[1].trim(); // the paragraph after the h1
const A = firstLine("THESIS.md");
const B = firstLine("THESIS-object-first.md");

test("the nav reaches /about; it opens on the finding-first telling", async ({ page }) => {
  await page.goto("/explore");
  if (isPhone(page)) await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("navigation", { name: "Views" }).getByRole("link", { name: "About" }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Stability ranks stillness");
  await expect(page.getByRole("radio", { name: "Finding first" })).toBeChecked();
  await expect(page.locator("article")).toContainText(A);
  await expect(page.locator("article")).not.toContainText(B);
});

test("the switch changes the telling and the URL, and a deep link opens the other telling", async ({ page }) => {
  await page.goto("/about");
  await page.getByRole("radio", { name: "Object first" }).check();
  await expect(page).toHaveURL(/\/about\?read=object$/);
  await expect(page.locator("article")).toContainText(B);
  await page.getByRole("radio", { name: "Finding first" }).check();
  await expect(page).toHaveURL(/\/about$/);
  await page.goto("/about?read=object");
  await expect(page.getByRole("radio", { name: "Object first" })).toBeChecked();
  await expect(page.locator("article")).toContainText(B);
});

test("arrow keys move the switch", async ({ page }) => {
  await page.goto("/about");
  await page.getByRole("radio", { name: "Finding first" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: "Object first" })).toBeChecked();
  await expect(page).toHaveURL(/read=object/);
});

test("both figures load in the current theme, with a link to the live view", async ({ page }, info) => {
  const dark = info.project.name.endsWith("dark");
  for (const u of ["/about", "/about?read=object"]) {
    await page.goto(u);
    const figs = page.locator("article figure");
    await expect(figs).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      const shown = figs.nth(i).locator("img:visible");
      await expect(shown).toHaveCount(1);
      await shown.scrollIntoViewIfNeeded(); // lazy: it loads once near the viewport
      await expect(shown).toHaveAttribute("src", dark ? /-dark\.png$/ : /-light\.png$/);
      await expect.poll(() => shown.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
      // phones get the app's own phone layout; wider screens the desktop export
      const current = await shown.evaluate((img: HTMLImageElement) => img.currentSrc);
      expect(current).toMatch(isPhone(page) ? /-phone-(light|dark)\.png$/ : /\/(scatter|tax)-(light|dark)\.png$/);
    }
    await expect(figs.nth(0).getByRole("link", { name: "Open it in the explorer" })).toHaveAttribute("href", "/scatter");
    await expect(figs.nth(1).getByRole("link", { name: "Move the slider yourself" })).toHaveAttribute("href", "/tax?lens=price&p=2");
  }
  await page.getByRole("link", { name: "Move the slider yourself" }).click();
  await expect(page).toHaveURL(/\/tax\?lens=price&p=2$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Stillness Tax");
});

test("the figure follows the reader's theme pick, not only the system", async ({ page }) => {
  await page.goto("/about");
  if (isPhone(page)) await page.getByRole("button", { name: "Menu" }).click();
  const before = await page.locator("article figure").first().locator("img:visible").getAttribute("src");
  await page.getByRole("button", { name: /theme$/ }).click();
  const after = await page.locator("article figure").first().locator("img:visible").getAttribute("src");
  expect(after).not.toBe(before);
});

test("in-text links: the explorer link stays in the app; the other telling opens through the switch's URL", async ({ page }) => {
  await page.goto("/about");
  await expect(page.locator("article").getByRole("link", { name: "StillDrawn Explorer" })).toHaveAttribute("href", "/explore");
  await expect(page.locator("article").getByRole("link", { name: "THESIS-object-first.md" })).toHaveAttribute("href", "/about?read=object");
  await expect(page.locator("article").getByRole("link", { name: /doi:10\.5281/ })).toHaveAttribute("href", "https://doi.org/10.5281/zenodo.23072784");
});

test("no horizontal page scroll", async ({ page }) => {
  for (const u of ["/about", "/about?read=object"]) {
    await page.goto(u);
    await expect(page.locator("article figure img:visible").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), u).toBe(true);
  }
});
