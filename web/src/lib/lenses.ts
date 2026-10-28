// The Stillness Tax lenses: a port of pipeline/stilldrawn_web/lenses.py, same names and tie-breaks.
// EXPLORATORY: the motion analysis is post-hoc (pre-registration amendment A6).
// Basis: primary standard cells; drift = line headline (px); motion = median normalised optical flow.
import { median, nanmedian, percentile } from "./stats";
import { byCodePoint, priceLines } from "./pareto";

export const MIN_N = 5;          // the paper's usability rule for a within-band comparison
export const REF_ENGINE = "wan22";

export type BasisRow = { id: string; engine: string; motion: number; drift: number };
export type EngineSummary = { n: number; motion_median_norm: number; motion_iqr: [number, number]; drift_median_px: number };
export type Summary = Record<string, EngineSummary>;
export type BoardRow = {
  engine: string;
  n: number;
  drift_median_px: number | null;
  score: number | null;
  ranked: boolean;
  rank: number | null;
  doublings?: number;
  reason?: string;
};
export type PairBand = {
  lo: number; hi: number; overlaps: boolean;
  usable?: boolean; winner_in_band?: string; reverses_league?: boolean;
  [engine: string]: unknown;
};
export type Segment = { p_from: number; p_to: number; leader: string };

type Arrays = Record<string, { motion: number[]; drift: number[] }>;

function arrays(basis: BasisRow[]): Arrays {
  const per: Arrays = {};
  for (const r of basis) {
    per[r.engine] ??= { motion: [], drift: [] };
    per[r.engine].motion.push(r.motion);
    per[r.engine].drift.push(r.drift);
  }
  return per;
}

const sortedEntries = <T,>(o: Record<string, T>) => Object.entries(o).sort(([a], [b]) => byCodePoint(a, b));

/** Per engine: n, motion median and IQR, drift median (Q1 of motion_confound.py). */
export function summary(basis: BasisRow[]): Summary {
  const out: Summary = {};
  for (const [e, d] of sortedEntries(arrays(basis)))
    out[e] = {
      n: d.motion.length,
      motion_median_norm: median(d.motion),
      motion_iqr: [percentile(d.motion, 25), percentile(d.motion, 75)],
      drift_median_px: nanmedian(d.drift),
    };
  return out;
}

type Scored = Omit<BoardRow, "engine" | "ranked" | "rank">;

function board(scored: Record<string, Scored>, unranked: Record<string, Scored>): BoardRow[] {
  const rows: BoardRow[] = [
    ...Object.entries(scored)
      .sort(([a, x], [b, y]) => x.score! - y.score! || byCodePoint(a, b))
      .map(([engine, v]) => ({ engine, ...v, ranked: true, rank: null })),
    ...sortedEntries(unranked).map(([engine, v]) => ({ engine, ...v, ranked: false, rank: null })),
  ];
  rows.forEach((r, i) => (r.rank = r.ranked ? i + 1 : null));
  return rows;
}

/**
 * score = drift median − p · log2(motion median / reference motion median).
 * p is the pixels of line drift a reader would accept for a doubling of motion; p = 0 is the paper's league.
 */
export function priceRanking(summ: Summary, p: number, ref = REF_ENGINE): BoardRow[] {
  const L = priceLines(summ, ref);
  const scored: Record<string, Scored> = {};
  for (const [e, v] of Object.entries(summ))
    scored[e] = { score: v.drift_median_px - p * L[e].x, doublings: L[e].x, drift_median_px: v.drift_median_px, n: v.n };
  return board(scored, {});
}

/** The leader as a piecewise function of p on [0, pMax]. */
export function priceCrossovers(summ: Summary, pMax = 3, ref = REF_ENGINE): Segment[] {
  const L = priceLines(summ, ref);
  const es = Object.keys(L).sort(byCodePoint);
  const cuts = new Set([0, pMax]);
  for (let i = 0; i < es.length; i++)
    for (let j = i + 1; j < es.length; j++) {
      const a = L[es[i]], b = L[es[j]];
      if (a.x !== b.x) {
        const p = (a.drift - b.drift) / (a.x - b.x);
        if (p > 0 && p < pMax) cuts.add(p);
      }
    }
  const cs = [...cuts].sort((a, b) => a - b);
  const segs: Segment[] = [];
  for (let k = 0; k + 1 < cs.length; k++) {
    const mid = (cs[k] + cs[k + 1]) / 2;
    const score = (e: string) => L[e].drift - mid * L[e].x;
    // min by (score, engine), as Python's min(key=(score, e))
    const leader = es.reduce((best, e) => (score(e) < score(best) ? e : best));
    const last = segs[segs.length - 1];
    if (last && last.leader === leader) last.p_to = cs[k + 1];
    else segs.push({ p_from: cs[k], p_to: cs[k + 1], leader });
  }
  return segs;
}

function subsetBoard(basis: BasisRow[], keep: (motion: number, drift: number) => boolean): BoardRow[] {
  const scored: Record<string, Scored> = {}, unranked: Record<string, Scored> = {};
  for (const [e, d] of sortedEntries(arrays(basis))) {
    const sel = d.drift.filter((x, i) => keep(d.motion[i], x));
    const n = sel.length;
    const drift_median_px = n ? median(sel) : null;
    if (n >= MIN_N) scored[e] = { n, drift_median_px, score: drift_median_px };
    else unranked[e] = { n, drift_median_px, score: null, reason: `too few clips (n = ${n})` };
  }
  return board(scored, unranked);
}

/** Only clips that move at least f count. */
export const floorRanking = (basis: BasisRow[], f: number) =>
  subsetBoard(basis, (m, d) => m >= f && Number.isFinite(d));

/** Only clips whose motion lies in [lo, hi] count. */
export const bandRanking = (basis: BasisRow[], lo: number, hi: number) =>
  subsetBoard(basis, (m, d) => m >= lo && m <= hi && Number.isFinite(d));

/** Each pair compared inside the overlap of their motion IQRs (Q5a). */
export function pairwiseBands(basis: BasisRow[], summ: Summary): Record<string, PairBand> {
  const arr = arrays(basis), es = Object.keys(summ).sort(byCodePoint);
  const out: Record<string, PairBand> = {};
  for (let i = 0; i < es.length; i++)
    for (let j = i + 1; j < es.length; j++) {
      const a = es[i], b = es[j];
      const lo = Math.max(summ[a].motion_iqr[0], summ[b].motion_iqr[0]);
      const hi = Math.min(summ[a].motion_iqr[1], summ[b].motion_iqr[1]);
      const rec: PairBand = { lo, hi, overlaps: lo < hi };
      if (rec.overlaps) {
        const inBand: Record<string, { n: number; drift_median: number | null }> = {};
        for (const e of [a, b]) {
          const sel = arr[e].drift.filter((d, k) => arr[e].motion[k] >= lo && arr[e].motion[k] <= hi && Number.isFinite(d));
          inBand[e] = { n: sel.length, drift_median: sel.length ? median(sel) : null };
          rec[e] = inBand[e];
        }
        rec.usable = inBand[a].n >= MIN_N && inBand[b].n >= MIN_N;
        if (rec.usable) {
          rec.winner_in_band = inBand[a].drift_median! < inBand[b].drift_median! ? a : b;
          const league = summ[a].drift_median_px < summ[b].drift_median_px ? a : b;
          rec.reverses_league = rec.winner_in_band !== league;
        }
      }
      out[`${a}|${b}`] = rec;
    }
  return out;
}
