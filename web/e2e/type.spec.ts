import { test, expect } from "./fixtures";

// The house face is Geist (from 29 Oct 2026), self-hosted. Schibsted Grotesk, before it, gave . , : % × a
// digit's width under tnum ("0 . 78"); tools/font/build_font.py still keeps tnum to the digits, as a guard.
test("tabular figures keep punctuation at its own width, in the self-hosted face", async ({ page }) => {
  const fonts: string[] = [];
  page.on("request", (r) => { if (/font|woff/.test(r.url())) fonts.push(r.url().replace(/^https?:\/\/[^/]+/, "")); });
  await page.goto("/tax");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const w = await page.evaluate(async () => {
    await document.fonts.load("400 14px 'Geist'");
    const s = document.createElement("span");
    document.body.append(s); // absolutely placed, so no layout stretches it
    const width = (text: string, tnum: boolean) => {
      s.style.cssText = `position: absolute; white-space: pre; font: 400 14px var(--font); font-variant-numeric: ${tnum ? "tabular-nums" : "normal"}`;
      s.textContent = text;
      return s.getBoundingClientRect().width;
    };
    const r = { punct: {} as Record<string, number>, digits: [width("1111", true), width("0000", true)], loaded: document.fonts.check("400 14px 'Geist'") };
    for (const ch of [".", ",", ":", "%", "×"]) r.punct[ch] = width(ch.repeat(10), true) - width(ch.repeat(10), false);
    s.remove();
    return r;
  });
  for (const [ch, d] of Object.entries(w.punct)) expect(Math.abs(d), `"${ch}" is wider under tabular-nums`).toBeLessThan(0.5);
  expect(w.loaded).toBe(true);
  expect(Math.abs(w.digits[0] - w.digits[1]), "digits are tabular").toBeLessThan(0.5);
  expect(fonts.some((u) => u === "/fonts/geist-latin.woff2")).toBe(true);
  expect(fonts.filter((u) => /googleapis|gstatic/.test(u))).toEqual([]);
});

test("hashes are set in Geist Mono, the house mono", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const code = page.locator(".provenance code").first();
  await expect(code).toBeAttached();
  const family = await code.evaluate(async (el) => { await document.fonts.load("400 12px 'Geist Mono'"); return getComputedStyle(el).fontFamily; });
  expect(family.split(",")[0].replace(/"/g, "").trim()).toBe("Geist Mono");
  expect(await page.evaluate(() => document.fonts.check("400 12px 'Geist Mono'"))).toBe(true);
});
