// Draws the pointer into the page for the films (headless Chromium paints none): an arrow that follows the
// mouse on desktop, a ring for each touch on phones. Driven by the real input events; the app is untouched.
import type { Page } from "@playwright/test";

export async function addPointer(page: Page, touch: boolean) {
  await page.addInitScript((touch: boolean) => {
    const install = () => {
      const p = document.createElement("div");
      p.setAttribute("aria-hidden", "true");
      p.style.cssText = "position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;will-change:transform;transform:translate(-200px,-200px)";
      if (touch) {
        p.style.cssText += ";width:44px;height:44px;margin:-22px 0 0 -22px;border:3px solid #9a6a12;background:rgba(196,146,42,.28);border-radius:50%;opacity:0;transition:opacity 120ms";
      } else {
        p.innerHTML = '<svg width="26" height="30" viewBox="0 0 26 30"><path d="M2 2 L2 24 L8 18.5 L12.5 28 L16.5 26.2 L12.2 17 L20 17 Z" fill="#1c1915" stroke="#ecebe7" stroke-width="2" stroke-linejoin="round"/></svg>';
      }
      document.body.append(p);
      // a 1 px tick in the corner that repaints every frame, so the compositor always has a fresh frame for the
      // capture loop (it otherwise waits for the page to change: half as often while clips run at half speed)
      const tick = document.createElement("div");
      tick.setAttribute("aria-hidden", "true");
      tick.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;z-index:2147483647;pointer-events:none";
      document.body.append(tick);
      let odd = false;
      const beat = () => { odd = !odd; tick.style.background = odd ? "rgba(0,0,0,.01)" : "rgba(0,0,0,.02)"; requestAnimationFrame(beat); };
      requestAnimationFrame(beat);
      const at = (x: number, y: number) => (p.style.transform = `translate(${x}px,${y}px)`);
      const opt = { capture: true, passive: true };
      addEventListener("mousemove", (e) => at(e.clientX, e.clientY), opt);
      addEventListener("pointermove", (e) => at(e.clientX, e.clientY), opt);
      if (touch) {
        addEventListener("touchstart", (e) => { const t = e.touches[0]; at(t.clientX, t.clientY); p.style.opacity = "1"; }, opt);
        addEventListener("touchmove", (e) => { const t = e.touches[0]; at(t.clientX, t.clientY); }, opt);
        addEventListener("touchend", () => (p.style.opacity = "0"), opt);
      }
    };
    if (document.body) install(); else addEventListener("DOMContentLoaded", install);
  }, touch);
}

/** A touch drag through CDP (Playwright has a tap, not a touch drag); `path` in CSS px, `ms` total. */
export async function touchDrag(page: Page, path: [number, number][], ms: number) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type: string, pt?: [number, number]) =>
    cdp.send("Input.dispatchTouchEvent", { type: type as "touchStart", touchPoints: pt ? [{ x: pt[0], y: pt[1] }] : [] });
  await send("touchStart", path[0]);
  for (const pt of path.slice(1)) { await page.waitForTimeout(ms / path.length); await send("touchMove", pt); }
  await send("touchEnd");
  await cdp.detach();
}
