// Points for the motion-vs-drift scatter. The primary standard cells take line drift and motion
// from basis.json (full precision, so the engine medians equal the lens summary); every other
// value comes from clips.json, which rounds to 4 significant figures.
import type { Arm, Clip, Metric } from "../../data/types";
import type { BasisRow } from "../../lib/lenses";
import { median, percentile } from "../../lib/stats";

export type Pt = { id: string; engine: string; arm: Arm; x: number; y: number; flint: boolean; clip: Clip };

export function points(clips: Clip[], basis: BasisRow[], metric: Metric, arms: Set<string>): Pt[] {
  const full = new Map(basis.map((b) => [b.id, b]));
  const out: Pt[] = [];
  for (const c of clips) {
    const shown = arms.has(c.arm) || (c.arm === "flint" && arms.has("primary"));
    if (!shown) continue;
    const b = c.arm === "primary" ? full.get(c.id) : undefined;
    const x = b ? b.motion : c.motion.median_norm;
    const y = b && metric === "line" ? b.drift : c.h[metric];
    if (y == null || !(y > 0) || !(x > 0)) continue;
    out.push({ id: c.id, engine: c.engine, arm: c.arm, x, y, flint: c.arm === "flint", clip: c });
  }
  return out;
}

/** Median and IQR of an engine's primary standard points (the basis): FLINT and other arms excluded. */
export function medianCross(pts: Pt[], engine: string) {
  const own = pts.filter((p) => p.engine === engine && p.arm === "primary");
  if (!own.length) return null;
  const xs = own.map((p) => p.x), ys = own.map((p) => p.y);
  return {
    engine, n: own.length,
    x: median(xs), x25: percentile(xs, 25), x75: percentile(xs, 75),
    y: median(ys), y25: percentile(ys, 25), y75: percentile(ys, 75),
  };
}
export type Cross = NonNullable<ReturnType<typeof medianCross>>;

/** Nudge label y positions apart so none overlap (minimum gap in px), keeping their order. */
export function spreadLabels(ys: number[], gap: number, lo: number, hi: number): number[] {
  const idx = ys.map((y, i) => [y, i] as const).sort((a, b) => a[0] - b[0]);
  const out = idx.map(([y]) => y);
  for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i], out[i - 1] + gap);
  const over = out[out.length - 1] - hi;
  if (over > 0) for (let i = out.length - 1; i >= 0; i--) out[i] = Math.min(out[i], (i === out.length - 1 ? hi : out[i + 1] - gap));
  out[0] = Math.max(out[0], lo);
  const res = new Array<number>(ys.length);
  idx.forEach(([, i], k) => (res[i] = out[k]));
  return res;
}
