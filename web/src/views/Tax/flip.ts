// FLIP for the leaderboard: remember each row's offset, let React reorder, then animate from
// the old offset to the new one with WAAPI. Reduced motion swaps instantly.
export const offsets = (el: HTMLElement) =>
  new Map([...el.querySelectorAll<HTMLElement>("[data-flip]")].map((r) => [r.dataset.flip!, r.offsetTop]));

export function flip(el: HTMLElement, before: Map<string, number>, ms = 240, easing = "cubic-bezier(.2,.7,.2,1)") {
  if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (const r of el.querySelectorAll<HTMLElement>("[data-flip]")) {
    const was = before.get(r.dataset.flip!);
    if (was == null || typeof r.animate !== "function") continue;
    // a reorder can land while rows still move: start from where the row is on screen
    // (its old slot plus the running animation's translateY), not from its old slot
    const dy = was + translateY(getComputedStyle(r).transform) - r.offsetTop;
    // drop the old move even when the row needs no new one: left running, it would now be
    // measured from the new slot and the row would jump by it
    r.getAnimations().filter((a) => a.id === "flip").forEach((a) => a.cancel());
    if (Math.abs(dy) < 0.5) continue;
    r.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { id: "flip", duration: ms, easing });
  }
}

/** The y translation of a computed transform ("none", matrix() or matrix3d()). */
function translateY(t: string) {
  const m = /^matrix(3d)?\(([^)]+)\)$/.exec(t);
  if (!m) return 0;
  const v = m[2].split(",").map(Number);
  return (m[1] ? v[13] : v[5]) || 0;
}
