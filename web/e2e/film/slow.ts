// Time dilation for the film capture: the screenshot loop manages 15–20 frames a second at 1080p while clips
// decode, so the page runs at 1/SLOW speed (clips, CSS and WAAPI animations, and every scripted wait) and
// film/build/edit.py divides the recorded times by SLOW. The cut plays at real speed with SLOW× the frames.
// The app is untouched: media elements report the rate the app set; only the element's real rate is scaled.
import type { Page } from "@playwright/test";

export const SLOW = Number(process.env.FILM_SLOW ?? 2);

export async function slowMedia(page: Page) {
  await page.addInitScript((slow: number) => {
    const d = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "playbackRate")!;
    Object.defineProperty(HTMLMediaElement.prototype, "playbackRate", {
      configurable: true,
      get() { return d.get!.call(this) * slow; },
      set(v: number) { d.set!.call(this, v / slow); },
    });
    // loading a source resets the real rate to defaultPlaybackRate (1): slow it again (media events don't
    // bubble, but a capture listener on the window sees them)
    addEventListener("loadedmetadata", (e) => {
      const m = e.target;
      if (m instanceof HTMLMediaElement && d.get!.call(m) === m.defaultPlaybackRate) d.set!.call(m, m.defaultPlaybackRate / slow);
    }, true);
  }, SLOW);
}

/** CSS transitions and animations and WAAPI run at 1/SLOW; call after each navigation. */
export async function slowAnimations(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Animation.enable");
  await cdp.send("Animation.setPlaybackRate", { playbackRate: 1 / SLOW });
}

export const wait = (page: Page, ms: number) => page.waitForTimeout(ms * SLOW);

/** Scrolls the window (or an element) to `top` over `ms` of film time, eased, from the test side. */
export async function scrollGlide(page: Page, top: number, ms: number, selector?: string) {
  const from = await page.evaluate((s) => (s ? document.querySelector(s)!.scrollTop : scrollY), selector);
  const n = Math.max(2, Math.round(ms / 16));
  for (let i = 1; i <= n; i++) {
    const u = i / n, e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
    await page.evaluate(([s, y]) => (s ? document.querySelector(s as string)!.scrollTo(0, y as number) : scrollTo(0, y as number)), [selector, from + (top - from) * e] as const);
    await page.waitForTimeout((ms * SLOW) / n);
  }
}
