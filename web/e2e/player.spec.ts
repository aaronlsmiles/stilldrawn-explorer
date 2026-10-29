import { test, expect } from "./fixtures";
const URL = "/explore?cell=act-tone-2_campush&e=wan22";

const ready = (page: import("@playwright/test").Page) =>
  page.getByTestId("clip-video").first().evaluate((el: HTMLVideoElement) =>
    new Promise((r) => (el.readyState >= 2 ? r(0) : el.addEventListener("loadeddata", () => r(0), { once: true }))));
const frameNo = async (page: import("@playwright/test").Page) =>
  Number((await page.getByTestId("frame-readout").innerText()).match(/Frame (\d+)/)![1]);

test("frame stepping with , and . from the keyboard", async ({ page }) => {
  await page.goto(URL);
  await ready(page);
  await page.getByRole("button", { name: "Next frame" }).click(); // pauses
  const f0 = await frameNo(page);
  await page.keyboard.press(".");
  await page.keyboard.press(".");
  await expect(page.getByTestId("frame-readout")).toHaveText(new RegExp(`^Frame ${(f0 + 2) % 121}\\b`));
  await page.keyboard.press(",");
  await expect(page.getByTestId("frame-readout")).toHaveText(new RegExp(`^Frame ${(f0 + 1) % 121}\\b`));
});

test("k toggles play and pause", async ({ page }) => {
  await page.goto(URL);
  await ready(page);
  await page.getByRole("button", { name: "Next frame" }).focus();
  const before = await page.getByTestId("clip-video").evaluate((v: HTMLVideoElement) => v.paused);
  await page.keyboard.press("k");
  await expect.poll(() => page.getByTestId("clip-video").evaluate((v: HTMLVideoElement) => v.paused)).toBe(!before);
});

test("speed control sets playbackRate", async ({ page }) => {
  await page.goto(URL);
  await page.getByRole("radio", { name: "0.25×" }).check();
  expect(await page.getByTestId("clip-video").evaluate((el: HTMLVideoElement) => el.playbackRate)).toBe(0.25);
});

test("difference at frame 0 is near-black", async ({ page }) => {
  // reads pixels from a canvas, so it needs same-origin media: the dev server's /media/ (byte-identical
  // to the media host); against a build that streams from the media host the canvas is tainted
  test.skip(!!process.env.DIST_URL, "needs same-origin media");
  await page.goto(URL + "&diff=1");
  await ready(page);
  const mean = await page.evaluate(async () => {
    const v = document.querySelector<HTMLVideoElement>("[data-testid=clip-video]")!;
    const img = document.querySelector<HTMLImageElement>("[data-testid=frame0]")!;
    v.pause();
    v.currentTime = 1 / 48;
    await new Promise((r) => v.addEventListener("seeked", r, { once: true }));
    await img.decode();
    const c = new OffscreenCanvas(v.videoWidth, v.videoHeight), g = c.getContext("2d")!;
    g.drawImage(img, 0, 0);
    const a = g.getImageData(0, 0, c.width, c.height).data;
    g.drawImage(v, 0, 0);
    const b = g.getImageData(0, 0, c.width, c.height).data;
    let s = 0;
    for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    return s / (a.length / 4) / 3;
  });
  expect(mean).toBeLessThan(2);
});

test("a draw switch changes the clip", async ({ page }) => {
  await page.goto("/explore?cell=act-black-3_burst&e=h3-fal");
  await page.getByRole("radio", { name: "H4" }).check();
  await expect(page).toHaveURL(/draw=h4/);
  await expect(page.getByTestId("clip-video")).toHaveAttribute("src", /act-black-3_burst_h3-h4\.mp4$/);
});
