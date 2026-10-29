// Accessibility and controls on every view: axe (WCAG 2.2 AA, no serious or critical violations),
// control text contrast, a keyboard walk with a visible focus ring at every stop, and every
// control clicked with the console clean (the fixture fails the test on any console error).
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { buttonContrast, runSession, seedSession, study } from "./rateFlow";

const VIEWS = ["/explore", "/explore?arm=standard", "/explore/failures", "/scatter", "/tax", "/tax?lens=band", "/rate"];

async function open(page: Page, u: string) {
  await page.route((url) => url.pathname === "/api/tally", (r) => r.fulfill({ json: { study: study.id, n_sessions: 0, items: {} } }));
  await page.goto(u);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  // self-check: A11Y_BREAK=<css> injects a defect, and these tests must then fail
  if (process.env.A11Y_BREAK) await page.addStyleTag({ content: process.env.A11Y_BREAK });
}
async function axe(page: Page, what: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const serious = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect.soft(serious.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(", ")}`), `${what}: axe`).toEqual([]);
}
const CONTROLS = "button:visible:not(:disabled), .seg-opt:visible, .seg-jump:visible, a.btn:visible";
async function contrast(page: Page, what: string) {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));
  const low = (await buttonContrast(page, CONTROLS)).filter((b) => b.ratio < 4.5);
  expect.soft(low, `${what}: control contrast under 4.5:1`).toEqual([]);
}

for (const u of VIEWS) {
  test(`${u}: axe, control contrast, and a keyboard walk with a visible focus ring at every stop`, async ({ page }) => {
    await open(page, u);
    await axe(page, u);
    await contrast(page, u);
    const stops: string[] = [], unringed: string[] = [];
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press("Tab");
      const s = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const ring = (e: Element | null) => !!e && getComputedStyle(e).outlineStyle !== "none" && parseFloat(getComputedStyle(e).outlineWidth) >= 2;
        const host = el.closest(".seg-opt, .bp-opt");
        const r = el.getBoundingClientRect();
        return { id: `${el.tagName.toLowerCase()}${el.getAttribute("aria-label") ? `[${el.getAttribute("aria-label")}]` : ""} ${(el.textContent ?? "").trim().slice(0, 20)}`, ok: ring(el) || ring(host), shown: r.width > 0 || !!host };
      });
      if (!s) break;
      stops.push(s.id);
      if (s.shown && !s.ok) unringed.push(s.id);
    }
    expect(new Set(stops).size, "distinct tab stops").toBeGreaterThan(3);
    expect.soft(unringed, "focused without a visible ring").toEqual([]);
  });

  test(`${u}: every control clicked, console clean, nothing overflows`, async ({ page }) => {
    test.setTimeout(90_000);
    await open(page, u);
    const path = new URL(page.url()).pathname;
    const sel = "main button:visible:not(:disabled), main .seg-opt:visible, main .seg-jump:visible, main label.check:visible, main label.radio-row:visible, main summary:visible";
    const n = await page.locator(sel).count();
    for (let i = 0; i < n; i++) {
      const c = page.locator(sel).nth(i);
      if (!(await c.isVisible().catch(() => false))) continue;
      await c.click({ timeout: 3000 }).catch(() => {});
      if (new URL(page.url()).pathname !== path) await page.goBack();
    }
    for (const s of await page.locator("main select:visible").all()) {
      const vals = await s.locator("option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
      if (vals.length) await s.selectOption(vals[vals.length - 1]);
    }
    const doc = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(doc).toBeLessThanOrEqual(page.viewportSize()!.width);
  });
}

test("/rate: axe and control contrast on a clip screen and on the results", async ({ page }) => {
  test.setTimeout(150_000);
  await page.route((url) => url.pathname === "/api/tally", (r) => r.fulfill({ json: { study: study.id, n_sessions: 0, items: {} } }));
  await seedSession(page, "1a2b3c4d-5e6f-4a0b-8c1d-2e3f4a5b6c7d");
  await page.goto("/rate");
  const session = page.locator('[data-bp="session"]');
  await session.getByRole("button", { name: "Start" }).click();
  const heading = session.getByRole("heading", { level: 2 });
  while (!(await heading.textContent())!.startsWith("Clip")) {
    const h = await heading.textContent();
    await session.locator("fieldset").first().getByRole("radio", { name: /^5,/ }).check();
    await session.getByRole("button", { name: "Next" }).click();
    await expect(heading).not.toHaveText(h!);
  }
  await page.locator("video").evaluate((v: HTMLVideoElement) => (v.readyState >= 2 ? null : new Promise((r) => v.addEventListener("loadeddata", r, { once: true }))));
  await axe(page, "clip screen");
  await contrast(page, "clip screen");
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await seedSession(page, "1a2b3c4d-5e6f-4a0b-8c1d-2e3f4a5b6c7e");
  await page.goto("/rate");
  await runSession(page);
  await page.getByRole("button", { name: "See where you land" }).click();
  await expect(page.getByRole("heading", { name: "Where you land" })).toBeVisible();
  await axe(page, "results");
  await contrast(page, "results");
});
