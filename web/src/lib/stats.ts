// Ports of the numpy calls in pipeline/stilldrawn_web/lenses.py.
// Percentile is numpy's default 'linear'; parity is tested against the pipeline's fixtures.

const asc = (xs: number[]) => [...xs].sort((a, b) => a - b);

// numpy._lerp: interpolate from the nearer end, as numpy does
function lerp(a: number, b: number, t: number) {
  const d = b - a;
  return t >= 0.5 ? b - d * (1 - t) : a + d * t;
}

export function percentile(xs: number[], q: number): number {
  const s = asc(xs);
  if (!s.length) return NaN;
  const h = (s.length - 1) * (q / 100);
  const lo = Math.floor(h);
  return lo + 1 < s.length ? lerp(s[lo], s[lo + 1], h - lo) : s[lo];
}

export function median(xs: number[]): number {
  const s = asc(xs);
  const n = s.length;
  if (!n) return NaN;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

export const nanmedian = (xs: number[]) => median(xs.filter((x) => Number.isFinite(x)));

/** Ranks from 1, ties averaged (scipy's rankdata 'average'). */
export function rank(xs: number[]): number[] {
  const idx = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b] || a - b);
  const r = new Array<number>(xs.length);
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && xs[idx[j + 1]] === xs[idx[i]]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k]] = avg;
    i = j + 1;
  }
  return r;
}

export function pearson(x: number[], y: number[]): number {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  return sxy / Math.sqrt(sxx * syy);
}

export const spearman = (x: number[], y: number[]) => pearson(rank(x), rank(y));

function* permutations<T>(a: T[]): Generator<T[]> {
  if (a.length <= 1) {
    yield a.slice();
    return;
  }
  for (let i = 0; i < a.length; i++) {
    const rest = [...a.slice(0, i), ...a.slice(i + 1)];
    for (const p of permutations(rest)) yield [a[i], ...p];
  }
}

/** Spearman rho with an exact two-sided permutation p (small n only). */
export function spearmanExact(x: number[], y: number[]): [number, number] {
  const rx = rank(x), ry = rank(y), rho = pearson(rx, ry);
  let hits = 0, total = 0;
  for (const p of permutations(ry)) {
    if (Math.abs(pearson(rx, p)) >= Math.abs(rho) - 1e-12) hits++;
    total++;
  }
  return [rho, hits / total];
}
