import { test, expect, isPhone } from "./fixtures";

test("default compare pair steps in sync", async ({ page }) => {
  await page.goto("/explore?cell=act-tone-2_campush&e=gen4.5&vs=wan22");
  const vids = page.locator("[data-testid=clip-video]");
  await expect(vids).toHaveCount(2);
  if (!isPhone(page)) // phones hold clips over 10 MB until Play
    await vids.first().evaluate((el: HTMLVideoElement) => new Promise((r) => (el.readyState >= 2 ? r(0) : el.addEventListener("loadeddata", () => r(0), { once: true }))));
  await page.getByRole("button", { name: "Next frame" }).click();
  for (let i = 0; i < 5; i++) await page.keyboard.press(".");
  const t = await vids.evaluateAll((els) => els.map((e) => (e as HTMLVideoElement).currentTime));
  expect(Math.abs(t[0] - t[1])).toBeLessThan(1 / 24 + 1e-3);
  await expect(page.getByTestId("compare-table")).toContainText("Wan 2.2");
});

test("compare can be cleared and re-pinned", async ({ page }) => {
  await page.goto("/explore?cell=act-tone-2_campush&e=gen4.5&vs=wan22");
  await page.getByLabel("Compare with").selectOption("");
  await expect(page.locator("[data-testid=clip-video]")).toHaveCount(1);
  await page.getByLabel("Compare with").selectOption("ltx23");
  await expect(page).toHaveURL(/vs=ltx23/);
});

test("failure gallery lists the taxonomy's exemplars", async ({ page }) => {
  await page.goto("/explore/failures");
  const tax = await page.evaluate(async () => (await fetch("/data/v1/taxonomy.json")).json());
  const n = Object.values<{ clips: string[] }>(tax).reduce((s, m) => s + m.clips.length, 0);
  await expect(page.getByTestId("exemplar")).toHaveCount(n);
  await expect(page.getByText(/candidate/i).first()).toBeVisible();
  await page.getByTestId("exemplar").first().click();
  await expect(page).toHaveURL(/\/explore\?/);
});
