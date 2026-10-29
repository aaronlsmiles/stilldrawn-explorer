// The motion rules from /review-animations (29 Oct): only a hovering pointer eases a colour in,
// and a state change made by key, tap or click on an unhovered control changes at once.
import type { Page } from "@playwright/test";
import { test, expect, isPhone } from "./fixtures";
import { seedSession } from "./rateFlow";

/** Selectors of :hover rules that are not under (hover: hover): a tap would leave them on. */
const ungatedHovers = (page: Page) => page.evaluate(() => {
  const out: string[] = [];
  const walk = (rules: CSSRuleList, gated: boolean) => {
    for (const r of rules) {
      if (r instanceof CSSMediaRule) { walk(r.cssRules, gated || /\(hover:\s*hover\)/.test(r.conditionText)); continue; }
      if (r instanceof CSSStyleRule && r.selectorText.includes(":hover") && !gated) out.push(r.selectorText);
      if ("cssRules" in r) walk((r as CSSGroupingRule).cssRules, gated);
    }
  };
  for (const s of document.styleSheets) walk(s.cssRules, false);
  return out;
});

/** Controls that ease anything but transform or opacity while nothing hovers them. */
const easingAtRest = (page: Page) => page.evaluate(() => {
  const sel = ".btn, .seg-opt, .seg-jump, .bar-nav nav a, .bar-end a, .bp-btn, .bp-opt";
  return [...document.querySelectorAll<HTMLElement>(sel)].flatMap((e) => {
    const cs = getComputedStyle(e);
    const props = cs.transitionProperty.split(", "), durs = cs.transitionDuration.split(", ");
    return props.filter((p, i) => parseFloat(durs[i % durs.length]) > 0 && p !== "transform" && p !== "opacity")
      .map((p) => `${e.className.split(" ")[0] || e.tagName} ${p}`);
  });
});

const VIEWS = ["/explore?cell=act-tone-2_campush&e=gen4.5", "/explore/failures", "/scatter", "/tax"];

test("every hover waits for a hovering pointer, and no control eases a colour at rest", async ({ page }) => {
  for (const u of VIEWS) {
    await page.goto(u);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await page.mouse.move(0, 0);
    expect(await ungatedHovers(page), `${u}: ungated :hover`).toEqual([]);
    expect(await easingAtRest(page), `${u}: easing at rest`).toEqual([]);
  }
  await seedSession(page, "0f0e0d0c-0b0a-4908-8706-050403020102");
  await page.goto("/rate");
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.locator(".bp-opt").first()).toBeVisible();
  await page.mouse.move(0, 0);
  expect(await ungatedHovers(page), "/rate: ungated :hover").toEqual([]);
  expect(await easingAtRest(page), "/rate: easing at rest").toEqual([]);
});

test("D turns the difference on at once, without a fade", async ({ page }) => {
  test.skip(isPhone(page), "a keyboard shortcut");
  await page.goto("/explore?cell=act-tone-2_campush&e=gen4.5");
  const diff = page.getByRole("button", { name: "Difference" });
  await diff.focus();
  await page.mouse.move(0, 0);
  await page.keyboard.press("d");
  await expect(diff).toHaveAttribute("aria-pressed", "true");
  expect(await diff.evaluate((b) => b.getAnimations().length)).toBe(0);
});
