// Drives one blindpanel session on /rate, shared by the local and the live specs.
// The script: a fixed session id, every still rated 5, every clip answered with the six
// raters' rounded mean (read from reveal.json on the test side only, never by the page).
import { expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parseBanned } from "blindpanel";

const dir = new URL("../public/data/blindpanel/stilldrawn/", import.meta.url);
const read = (f: string) => JSON.parse(readFileSync(new URL(f, dir), "utf8"));
export const study = read("study.json");
const reveal = read("reveal.json");
export const STORAGE_KEY = `blindpanel:${study.id}:${study.instrument}`;
export const banned = parseBanned(readFileSync(new URL("../vendor/stilldrawn-banned-terms.txt", import.meta.url), "utf8"));
export const ENGINE_IN_URL = /reveal\.json|gen4|wan22|ltx23|h3-fal|_campush_|_idle_|_burst_/;

const codes: string[] = study.parts.clips.items.map((i: { code: string }) => i.code);
const clipByVideo = new Map<string, string>(study.parts.clips.items.map((i: { code: string; video: string }) => [i.video, i.code]));
export function panelMean(q: "register" | "sameness", code: string) {
  const j = codes.indexOf(code);
  const v = (reveal.reference.ratings[q] as (number | null)[][]).map((r) => r[j]).filter((x): x is number => x !== null);
  return Math.round(v.reduce((a, b) => a + b, 0) / v.length);
}

/** A fresh, fixed session in localStorage before the page loads (seconds seeds the measured duration). */
export async function seedSession(page: Page, session: string, seconds = 0) {
  await page.addInitScript(([key, s, sec]) => {
    if (!localStorage.getItem(key as string))
      localStorage.setItem(key as string, JSON.stringify({ session: s, step: 0, blocks: 1, answers: { baseline: {}, clips: {} }, seconds: sec, keyboardUsed: false, shortcuts: true, completed: false }));
  }, [STORAGE_KEY, session, seconds] as const);
}

export const leaks = (html: string) => banned.filter((b) => (typeof b === "string" ? html.toLowerCase().includes(b.toLowerCase()) : b.test(html))).map(String);

/** From the intro to the "Done" screen, by mouse or by keyboard only. */
export async function runSession(page: Page, { keyboard = false } = {}) {
  const session = page.locator('[data-bp="session"]');
  const heading = session.getByRole("heading", { level: 2 });
  await expect(heading).toHaveText(study.title);
  const start = session.getByRole("button", { name: "Start" });
  if (keyboard) {
    for (let i = 0; i < 25 && !(await start.evaluate((b) => b === document.activeElement)); i++) await page.keyboard.press("Tab");
    await expect(start).toBeFocused();
    await page.keyboard.press("Enter");
  } else {
    await start.click();
  }
  for (;;) {
    await expect(heading).not.toHaveText(study.title);
    const h = (await heading.textContent()) ?? "";
    if (h.startsWith("Done")) break;
    let keys: number[];
    if (h.startsWith("Still")) {
      await expect(session.locator(".bp-still img")).toHaveJSProperty("complete", true);
      keys = [5];
    } else {
      const code = clipByVideo.get((await session.locator("video").getAttribute("src")) ?? "")!;
      keys = [panelMean("register", code), panelMean("sameness", code)];
    }
    const sets = session.locator("fieldset");
    for (const [i, k] of keys.entries()) {
      if (keyboard) await page.keyboard.press(String(k));
      else await sets.nth(i).getByRole("radio", { name: new RegExp(`^${k},`) }).check();
    }
    if (keyboard) await page.keyboard.press("Enter");
    else await session.getByRole("button", { name: "Next" }).click();
    await expect(heading).not.toHaveText(h);
  }
}

/** The page must never be wider than the configured viewport (innerWidth can grow to fit overflow). */
export async function expectNoOverflow(page: Page) {
  const view = page.viewportSize()!.width;
  const doc = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(doc, `page is ${doc}px wide in a ${view}px viewport`).toBeLessThanOrEqual(view);
}
