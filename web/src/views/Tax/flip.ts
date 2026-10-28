// FLIP for the leaderboard: remember each row's offset, let React reorder, then animate from
// the old offset to the new one with WAAPI. Reduced motion swaps instantly.
export const offsets = (el: HTMLElement) =>
  new Map([...el.querySelectorAll<HTMLElement>("[data-flip]")].map((r) => [r.dataset.flip!, r.offsetTop]));

export function flip(el: HTMLElement, before: Map<string, number>, ms = 240, easing = "cubic-bezier(.2,.7,.2,1)") {
  if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (const r of el.querySelectorAll<HTMLElement>("[data-flip]")) {
    const was = before.get(r.dataset.flip!);
    if (was == null || typeof r.animate !== "function") continue;
    const dy = was - r.offsetTop;
    if (Math.abs(dy) < 0.5) continue;
    r.getAnimations().forEach((a) => a.cancel());
    r.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: ms, easing });
  }
}
