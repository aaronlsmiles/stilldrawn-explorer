// State and boards for the Stillness Tax lenses. EXPLORATORY (pre-registration amendment A6).
import { bandRanking, floorRanking, priceRanking, summary, type BasisRow, type BoardRow } from "../../lib/lenses";
import { ordinal } from "../../lib/format";

export const P_MAX = 3;
export type LensId = "price" | "floor" | "band";
export type LensState =
  | { lens: "price"; p: number }
  | { lens: "floor"; f: number }
  | { lens: "band"; lo: number; hi: number; preset: string | null };
export type LensData = { basis: BasisRow[] };

export const LENSES: { id: LensId; name: string; sentence: string }[] = [
  { id: "price", name: "Price of motion",
    sentence: "How many pixels of drift would you accept for twice the motion? Each engine's score is its median drift minus that price for every doubling of motion over Wan 2.2." },
  { id: "floor", name: "Motion floor",
    sentence: "Count only the clips that move at least this much, then rank the engines by median drift." },
  { id: "band", name: "Matched-motion band",
    sentence: "Compare the engines only on clips whose motion falls inside the same band." },
];

export function boardFor(data: LensData, s: LensState): BoardRow[] {
  if (s.lens === "price") return priceRanking(summary(data.basis), s.p);
  if (s.lens === "floor") return floorRanking(data.basis, s.f);
  return bandRanking(data.basis, s.lo, s.hi);
}

const num = (q: URLSearchParams, k: string) => {
  const v = Number(q.get(k));
  return q.has(k) && Number.isFinite(v) ? v : null;
};

export function parseState(q: URLSearchParams): LensState {
  const lens = q.get("lens");
  if (lens === "floor") return { lens, f: Math.max(0, num(q, "f") ?? 0) };
  if (lens === "band") {
    const a = num(q, "lo") ?? 0, b = num(q, "hi") ?? 1;
    return { lens, lo: Math.min(a, b), hi: Math.max(a, b), preset: q.get("preset") };
  }
  return { lens: "price", p: Math.max(0, Math.min(P_MAX, num(q, "p") ?? 0)) };
}

export function stateToQuery(s: LensState): Record<string, string | null> {
  const clear = { p: null, f: null, lo: null, hi: null, preset: null };
  if (s.lens === "price") return { ...clear, lens: null, p: s.p ? String(+s.p.toFixed(2)) : null };
  // Exact values (shortest round-trip form): a rounded edge can drop the clip that sits on it.
  if (s.lens === "floor") return { ...clear, lens: "floor", f: String(s.f) };
  if (s.preset) return { ...clear, lens: "band", preset: s.preset };   // edges come from the pair itself
  return { ...clear, lens: "band", lo: String(s.lo), hi: String(s.hi) };
}

const STEPS = 1000;
/** A log scale over the basis' motion range, mapped to integer slider steps. */
export function motionScale(basis: BasisRow[]) {
  const ms = basis.map((r) => r.motion);
  const min = Math.min(...ms), max = Math.max(...ms);   // exact: exp(log(x)) can miss x by an ulp
  const lo = Math.log(min), hi = Math.log(max);
  return {
    steps: STEPS, min, max,
    toValue: (step: number) => (step <= 0 ? min : step >= STEPS ? max : Math.exp(lo + ((hi - lo) * step) / STEPS)),
    toStep: (v: number) => Math.round(((Math.log(Math.max(v, min)) - lo) / (hi - lo)) * STEPS),
  };
}

type Ranked = Pick<BoardRow, "engine" | "rank" | "ranked">;
/** One sentence for the live region: only engines whose place changed, in the new order. */
export function announce(prev: Ranked[], next: Ranked[], name: (e: string) => string): string {
  const was = new Map(prev.map((r) => [r.engine, r]));
  const out: string[] = [];
  for (const r of next) {
    const w = was.get(r.engine);
    if (!w) continue;
    if (r.ranked && (!w.ranked || w.rank !== r.rank)) out.push(`${name(r.engine)} moves to ${ordinal(r.rank!)}.`);
    else if (!r.ranked && w.ranked) out.push(`${name(r.engine)} drops out: too few clips.`);
  }
  return out.join(" ");
}
