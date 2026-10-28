import type { Summary } from "./lenses";

/** Python's default str ordering (code points). localeCompare disagrees: it sorts "_" before ".". */
export const byCodePoint = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Maximise motion, minimise drift, on engine medians (lenses.pareto). */
export function pareto(summ: Summary) {
  const es = Object.keys(summ).sort(byCodePoint);
  const dominated_by: Record<string, string[]> = {};
  for (const e of es) {
    const me = summ[e].motion_median_norm, de = summ[e].drift_median_px;
    dominated_by[e] = es.filter((o) => {
      const mo = summ[o].motion_median_norm, d = summ[o].drift_median_px;
      return o !== e && mo >= me && d <= de && (mo > me || d < de);
    });
  }
  return { frontier: es.filter((e) => !dominated_by[e].length), dominated_by };
}

/** Score lines of the price lens: score(p) = drift − p · doublings over the reference. */
export function priceLines(summ: Summary, ref: string) {
  const m0 = summ[ref].motion_median_norm;
  return Object.fromEntries(
    Object.entries(summ).map(([e, v]) => [e, { drift: v.drift_median_px, x: Math.log2(v.motion_median_norm / m0) }]),
  );
}

/** Prices p > 0 at which two engines' score lines cross. */
export function crossingPrices(summ: Summary, ref: string): number[] {
  const L = priceLines(summ, ref), es = Object.keys(L);
  const out: number[] = [];
  for (let i = 0; i < es.length; i++)
    for (let j = i + 1; j < es.length; j++) {
      const a = L[es[i]], b = L[es[j]];
      if (a.x !== b.x) {
        const p = (a.drift - b.drift) / (a.x - b.x);
        if (p > 0) out.push(p);
      }
    }
  return out.sort((a, b) => a - b);
}

/**
 * True if some price p ≥ 0 puts this engine first: it lies on the lower convex hull
 * of (log2 motion, drift) facing the price lens. Checked on every interval between
 * crossings, so it agrees with the leader function by construction.
 */
export function onLowerHull(summ: Summary, engine: string, ref = "wan22"): boolean {
  const L = priceLines(summ, ref), es = Object.keys(L).sort(byCodePoint);
  const cuts = [0, ...crossingPrices(summ, ref)];
  const probes = cuts.map((c, i) => (i + 1 < cuts.length ? (c + cuts[i + 1]) / 2 : c + 1));
  probes.unshift(0);
  return probes.some((p) => {
    const score = (e: string) => L[e].drift - p * L[e].x;
    const leader = es.reduce((best, e) => (score(e) < score(best) ? e : best));
    return leader === engine;
  });
}
