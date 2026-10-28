import { test as base, expect, type Page } from "@playwright/test";

/** Every test fails on a console error, an uncaught page error or a failed same-origin request. */
export const test = base.extend<{ clean: void }>({
  clean: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("requestfailed", (r) => {
      const f = r.failure()?.errorText ?? "";
      if (r.url().startsWith("http://localhost") && !f.includes("ERR_ABORTED")) errors.push(`failed ${r.url()} ${f}`);
    });
    await use();
    expect(errors).toEqual([]);
  }, { auto: true }],
});
export { expect };

export const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 760;
