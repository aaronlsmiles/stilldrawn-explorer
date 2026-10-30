import { useLayoutEffect, useRef, useState } from "react";

/** The element's content box, kept current with a ResizeObserver. */
export function useBox<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = (w: number, h: number) => setBox((b) => (b.w === Math.round(w) && b.h === Math.round(h) ? b : { w: Math.round(w), h: Math.round(h) }));
    const ro = new ResizeObserver(([e]) => set(e.contentRect.width, e.contentRect.height));
    ro.observe(el);
    const r = el.getBoundingClientRect();
    set(r.width, r.height);
    return () => ro.disconnect();
  }, []);
  return [ref, box.w, box.h] as const;
}

/** The element's content width, kept current with a ResizeObserver. */
export function useWidth<T extends HTMLElement>() {
  const [ref, w] = useBox<T>();
  return [ref, w] as const;
}

let ctx: CanvasRenderingContext2D | null | undefined;
/** A label's drawn width in the app's face (an estimate where canvas is unavailable, as in tests). */
export function textWidth(s: string, font = "600 12px 'Geist'") {
  if (ctx === undefined) {
    try { ctx = document.createElement("canvas").getContext("2d"); } catch { ctx = null; }
  }
  if (!ctx) return s.length * 7;
  ctx.font = font;
  return ctx.measureText(s).width;
}
