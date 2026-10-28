import { test, expect } from "./fixtures";

test("scatter draws the primary basis and quotes the paper's engine-level rho", async ({ page }) => {
  await page.goto("/scatter");
  await expect(page.locator("[data-testid=pt]")).toHaveCount(170);
  const paper = await page.evaluate(async () => (await fetch("/data/v1/paper.json")).json());
  await expect(page.getByTestId("finding")).toContainText(paper.engine_rho_motion_drift.value.rho.toFixed(2));
  await expect(page.getByTestId("finding")).toContainText(paper.engine_rho_motion_drift.value.p_exact_two_sided.toFixed(3));
});

test("the table view links each clip into Explore", async ({ page }) => {
  await page.goto("/scatter");
  await page.getByRole("button", { name: /show as table/i }).click();
  await page.getByRole("link", { name: "act-tone-2_campush_gen45" }).click();
  await expect(page).toHaveURL(/\/explore\?cell=act-tone-2_campush&e=gen4\.5/);
});

test("y metric switch updates the axis and the query", async ({ page }) => {
  await page.goto("/scatter");
  await page.getByRole("radio", { name: "Style drift" }).check();
  await expect(page).toHaveURL(/y=style/);
  await expect(page.getByTestId("y-label")).toContainText(/style/i);
});

test("choosing an engine highlights its points", async ({ page }) => {
  await page.goto("/scatter");
  await page.getByRole("radio", { name: /Gen-4\.5/ }).check();
  await expect(page).toHaveURL(/hl=gen4\.5/);
  await expect(page.locator("[data-testid=pt].is-hl")).toHaveCount(33 + 0);
});

test("arms add points", async ({ page }) => {
  await page.goto("/scatter");
  await page.getByRole("checkbox", { name: /repeat/i }).check();
  await expect(page.locator("[data-testid=pt]")).toHaveCount(170 + 98);
});
