import { test, expect } from "./fixtures";

// Schibsted Grotesk's upstream tnum also gives . , : % × a digit's width ("0 . 78");
// the self-hosted copy (tools/font/build_font.py) swaps digits only.
test("tabular figures keep punctuation at its own width, in the self-hosted face", async ({ page }) => {
  const fonts: string[] = [];
  page.on("request", (r) => { if (/font|woff/.test(r.url())) fonts.push(r.url().replace(/^https?:\/\/[^/]+/, "")); });
  await page.goto("/tax");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const w = await page.evaluate(async () => {
    await document.fonts.load("400 14px 'Schibsted Grotesk'");
    const s = document.createElement("span");
    document.body.append(s); // absolutely placed, so no layout stretches it
    const width = (text: string, tnum: boolean) => {
      s.style.cssText = `position: absolute; white-space: pre; font: 400 14px var(--font); font-variant-numeric: ${tnum ? "tabular-nums" : "normal"}`;
      s.textContent = text;
      return s.getBoundingClientRect().width;
    };
    const r = { punct: {} as Record<string, number>, digits: [width("1111", true), width("0000", true)], loaded: document.fonts.check("400 14px 'Schibsted Grotesk'") };
    for (const ch of [".", ",", ":", "%", "×"]) r.punct[ch] = width(ch.repeat(10), true) - width(ch.repeat(10), false);
    s.remove();
    return r;
  });
  for (const [ch, d] of Object.entries(w.punct)) expect(Math.abs(d), `"${ch}" is wider under tabular-nums`).toBeLessThan(0.5);
  expect(w.loaded).toBe(true);
  expect(Math.abs(w.digits[0] - w.digits[1]), "digits are tabular").toBeLessThan(0.5);
  expect(fonts.some((u) => u === "/fonts/schibsted-grotesk-latin.woff2")).toBe(true);
  expect(fonts.filter((u) => /googleapis|gstatic/.test(u))).toEqual([]);
});
