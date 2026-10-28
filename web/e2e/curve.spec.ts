import { test, expect } from "./fixtures";
const URL = "/explore?cell=act-tone-2_campush&e=gen4.5";

test("curve slider seeks the video by keyboard", async ({ page }) => {
  await page.goto(URL);
  const s = page.getByRole("slider", { name: /drift curve/i });
  await s.focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("PageUp");
  await expect(s).toHaveAttribute("aria-valuenow", "10");
  await expect(page.getByTestId("frame-readout")).toHaveText(/^Frame 10\b/);
});

test("series selector offers tone only when the clip has a tone series", async ({ page }) => {
  await page.goto(URL);
  const hasTone = await page.evaluate(async () => {
    const s = await (await fetch("/data/v1/series/gen4.5.json")).json();
    return s["act-tone-2_campush_gen45"].tone != null;
  });
  await expect(page.getByRole("radio", { name: "Screentone" })).toHaveCount(hasTone ? 1 : 0);
  await page.getByRole("radio", { name: "Style drift" }).check();
  await expect(page).toHaveURL(/series=style/);
});

test("readouts show basis rank and provenance from the contract", async ({ page }) => {
  await page.goto(URL);
  const clip = await page.evaluate(async () =>
    (await (await fetch("/data/v1/clips.json")).json()).find((c: { id: string }) => c.id === "act-tone-2_campush_gen45"));
  await expect(page.getByTestId("readouts")).toContainText(/lowest of 33/);
  await expect(page.getByTestId("provenance").first()).toContainText(clip.sha256);
  await expect(page.getByTestId("provenance").first()).toContainText("stilldrawn-clips-gen4.5-v1.0.0.zip");
  await expect(page.getByTestId("notice-badge").first()).toBeAttached();
});

test("a local engine's clip carries no provider notice", async ({ page }) => {
  await page.goto("/explore?cell=act-black-1_campush&e=wan22");
  await expect(page.getByTestId("provenance")).toBeAttached();
  // act-black-1 is a hosted-generated panel, so the panel notice still applies
  await expect(page.getByTestId("notice-badge")).toContainText("panel");
});
