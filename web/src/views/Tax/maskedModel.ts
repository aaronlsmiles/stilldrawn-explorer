// Every decision the masked-drift page makes, as a pure function (P46 sub-plan D, Task 5).
// EXPLORATORY and post-hoc (amendment A9). Wording rules, all binding: the Gen-4.5/Wan gap is a ratio of
// medians in "x", one decimal; no logs, no doublings, never set beside the league's own figure; rows in
// league order with no rank; a masked median only beside the whole-frame median on the same cells.
import type {
  MarginKey, Masked, MaskedCondition, MaskedRow, MaskedTest1, MaskedVerdict, MaskedSplit, MaskSet, RaterPrimary,
} from "../../data/types";
import { fixed, norm, px, ratio } from "../../lib/format";
import { spreadLabels } from "../Scatter/scatterModel";

// ------------------------------------------------------------------ state
export const MARGINS = [16, 32, 64] as const;
export type Margin = (typeof MARGINS)[number];
export const SPLITS: MaskedSplit[] = ["all", "idle", "burst"];
export const MASK_SETS: MaskSet[] = ["aaron", "agent"];
export type MaskedState = { masks: MaskSet; margin: Margin; split: MaskedSplit; row: string | null; table: boolean };
export const DEFAULT_STATE: MaskedState = { masks: "aaron", margin: 32, split: "all", row: null, table: false };

export const MASK_LABEL: Record<MaskSet, string> = { aaron: "Aaron's set", agent: "Blind set" };
export const SPLIT_LABEL: Record<MaskedSplit, string> = { all: "All cells", idle: "Idle only", burst: "Burst only" };

export function parseState(q: URLSearchParams): MaskedState {
  const masks = q.get("masks"), split = q.get("split"), margin = Number(q.get("margin"));
  return {
    masks: MASK_SETS.find((m) => m === masks) ?? DEFAULT_STATE.masks,
    margin: MARGINS.find((m) => m === margin) ?? DEFAULT_STATE.margin,
    split: SPLITS.find((s) => s === split) ?? DEFAULT_STATE.split,
    row: q.get("row") || null,
    table: q.get("table") === "1",
  };
}

/** Only the non-default entries, so a default link stays bare. */
export function stateToQuery(s: MaskedState): Record<string, string> {
  const out: Record<string, string> = {};
  if (s.masks !== DEFAULT_STATE.masks) out.masks = s.masks;
  if (s.margin !== DEFAULT_STATE.margin) out.margin = String(s.margin);
  if (s.split !== DEFAULT_STATE.split) out.split = s.split;
  if (s.row) out.row = s.row;
  if (s.table) out.table = "1";
  return out;
}
/** The same, with every key present, so a setter can clear the keys that went back to their default. */
export const queryPatch = (s: MaskedState): Record<string, string | null> =>
  ({ masks: null, margin: null, split: null, row: null, table: null, ...stateToQuery(s) });

export const marginKey = (m: Margin): MarginKey => `m${m}`;
export const condOf = (m: Masked, s: Pick<MaskedState, "masks" | "margin" | "split">): MaskedCondition =>
  m.test2.conditions[s.split][s.masks][marginKey(s.margin)];

/** Pixels as the house formats them, except that a tiny non-zero value keeps two significant figures (never "0.00 px") and nothing goes to exponent notation. */
export function pxr(v: number): string {
  if (v !== 0 && Math.abs(v) < 0.005) return `${norm(v)} px`;
  if (Math.abs(v) >= 1e15) return `${BigInt(Math.round(v)).toString()} px`;
  return px(v);
}

// ------------------------------------------------------------------ league
export type LeagueRow = { engine: string; name: string; n: number; whole: number | null; masked: number | null; note: string | null };

/** Engines in the frozen league order (engine_order); no rank, and both medians come from the same cells. */
export function leagueRows(m: Masked, cond: MaskedCondition, name: (engine: string) => string): LeagueRow[] {
  return m.engine_order.map((engine) => {
    const whole = cond.D_whole_px[engine] ?? null, masked = cond.D_masked_px[engine] ?? null;
    return { engine, name: name(engine), n: cond.n_clips[engine] ?? 0, whole, masked, note: whole === null || masked === null ? "no value" : null };
  });
}

// ------------------------------------------------------------------ headline (A9.4 template, generated)
const f = (v: number | null, dp: number) => (v === null ? "n/a" : fixed(v, dp));
export function headline(c: MaskedCondition): string {
  const n = Object.values(c.n_clips).reduce((a, b) => a + b, 0);
  const rw = c.ratio_whole, rm = c.ratio_masked;
  if (rw === null || rm === null) return `Post-hoc (A9): on ${n} cells the Gen-4.5/Wan ratio is undefined under these masks.`;
  const verb = rm < rw ? "falls" : rm > rw ? "rises" : "stays";
  const ci = c.s_ci95 ? `95% CI ${f(c.s_ci95[0], 2)} to ${f(c.s_ci95[1], 2)}` : "no CI";
  return `Post-hoc (A9): on ${n} cells, Gen-4.5/Wan ${verb} from ${ratio(rw)} to ${ratio(rm)} outside the region the prompt allows to move `
    + `(s = ${f(c.s, 2)}, ${ci}). The frozen league is unchanged; this qualifies how its gap is read.`;
}

export type HeadlineView = { key: MaskSet; label: string; text: string; registered: boolean };
/** A9.4 registers one headline per mask set at 32 px over all eligible rows: both are shown on that view, whichever set is
 *  selected. Any other margin or split shows the chosen condition's own headline, labelled with its condition. */
export function headlineViews(m: Masked, s: Pick<MaskedState, "masks" | "margin" | "split">): HeadlineView[] {
  if (viewStatus(s).registered) return MASK_SETS.map((key) => ({ key, label: MASK_LABEL[key], text: headline(condOf(m, { masks: key, margin: 32, split: "all" })), registered: true }));
  return [{ key: s.masks, label: `${MASK_LABEL[s.masks]}, ${s.margin} px, ${SPLIT_LABEL[s.split].toLowerCase()}`, text: headline(condOf(m, s)), registered: false }];
}

/** The sentence for the live region after a control changes. */
export const announcement = (s: Pick<MaskedState, "masks" | "margin">, c: MaskedCondition) =>
  c.ratio_whole === null || c.ratio_masked === null
    ? `${MASK_LABEL[s.masks]}, ${s.margin} px: the Gen-4.5/Wan ratio is undefined.`
    : `${MASK_LABEL[s.masks]}, ${s.margin} px: Gen-4.5/Wan ${c.ratio_masked < c.ratio_whole ? "falls" : c.ratio_masked > c.ratio_whole ? "rises" : "stays"} from ${ratio(c.ratio_whole)} to ${ratio(c.ratio_masked)}`;

// ------------------------------------------------------------------ verdict (Test 2)
export const VERDICT_LINES: Record<MaskedVerdict, string> = {
  "not testable": "Not testable: on these cells the whole-frame gap is under 2× or undefined.",
  "supported": "Supported: under both mask sets the gap shrinks by at least half, and Aaron's interval stays above zero.",
  "mask-dependent": "Mask-dependent: the gap shrinks by at least half under one mask set only.",
  "killed": "Killed: the engines keep the same order with similar gaps under both mask sets.",
  "not supported": "Not supported: any other outcome.",
};
/** The verdict always reads the registered cell (all cells, 32 px, both sets), whatever view the reader has chosen. */
export function verdictFor(m: Masked): { verdict: MaskedVerdict; sentence: string } {
  const v = m.test2.verdict;
  if (!Object.hasOwn(VERDICT_LINES, v)) throw new Error(`unknown verdict: ${String(v)}`);
  if (v === "supported") {       // A9.4: s of 0.5 or more under both sets, and Aaron's interval above zero
    const at = (set: MaskSet) => m.test2.conditions.all[set].m32;
    const ok = (s: number | null) => s !== null && s >= 0.5;
    const lo = at("aaron").s_ci95?.[0];
    if (!ok(at("aaron").s) || !ok(at("agent").s) || lo === undefined || !(lo > 0)) throw new Error("verdict supported disagrees with s under the registered cells");
  }
  return { verdict: v, sentence: VERDICT_LINES[v] };
}
/** Only the registered cell carries a verdict; every other margin or split is a sensitivity view. */
export const viewStatus = (s: Partial<MaskedState>) => ({ registered: s.margin === 32 && s.split === "all" });

// ------------------------------------------------------------------ Test 1
export type EngineRate = { engine: string; n: number; misses: number; rate: number; lo: number; hi: number; steadiness: number | null };
export type RaterView = {
  id: "AARON" | "R7"; tag: string | null; rho: number | null; p: number | null; passes: boolean; engines: EngineRate[];
  more: {
    sensitivity: { miss: string; rho: number | null; p: number | null; engines: EngineRate[] } | null;
    withinRow: { nRows: number; nRowsDefined: number; meanRho: number | null; p: number | null } | null;
    auc: { study: string; nMiss: number; nNonmiss: number; auc: number | null; reading: string }[];
  };
};
export type Test1View = {
  state: MaskedTest1["state"]; chip: string; miss: string; verdict: "Supported" | "Not supported" | null; rule: string; reading: string | null;
  raters: RaterView[]; kappa: { study: string; value: number | null }[] | null; attainable: string; deadline: string;
  r7Note: string | null; partialNote: string | null; basis: string;
};

/** What R7 declared about prior exposure. Present perfect until R7 has rated; null (undeclared) says nothing; nobody is gendered. */
export function r7Note(state: MaskedTest1["state"], blind: boolean | null): string | null {
  if (blind === null) return null;
  if (!blind) return state === "pending" ? "R7 has declared prior exposure (see the amendment)." : "R7 declared prior exposure (see the amendment).";
  return state === "pending" ? "R7 has declared not having seen the explorer, the release or these clips."
    : "R7 declared not having seen the explorer, the release or these clips before rating.";
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

const rec = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const numOrNull = (v: unknown) => (typeof v === "number" ? v : null);
const ge = (s: string) => s.replace("<=", "\u2264");

function rates(prim: RaterPrimary, order: string[], steady: Record<string, number>): EngineRate[] {
  return order.filter((e) => e in prim.per_engine).map((e) => {
    const x = prim.per_engine[e];
    return { engine: e, n: x.n, misses: x.misses, rate: x.miss_rate, lo: x.wilson95[0], hi: x.wilson95[1], steadiness: steady[e] ?? null };
  });
}

function raterView(id: "AARON" | "R7", r: NonNullable<MaskedTest1["raters"]["AARON"]>, tag: string | null, order: string[], steady: Record<string, number>): RaterView {
  const prim: RaterPrimary = r.primary;
  const sens = rec(r.sensitivity_miss_le_3) as (RaterPrimary & { miss?: string }) | null;
  const within = rec(r.within_row), auc = rec(r.motion_auc);
  return {
    id, tag, rho: prim.rho, p: prim.p_one_sided, passes: prim.p_le_0_05, engines: rates(prim, order, steady),
    more: {
      sensitivity: sens ? { miss: ge(sens.miss ?? "sensitivity"), rho: sens.rho, p: sens.p_one_sided, engines: rates(sens, order, steady) } : null,
      withinRow: within ? { nRows: Number(within.n_rows), nRowsDefined: Number(within.n_rows_defined), meanRho: numOrNull(within.mean_rho), p: numOrNull(within.p_one_sided) } : null,
      auc: auc ? Object.entries(auc).flatMap(([study, v]) => {
        const x = rec(v);
        return x ? [{ study, nMiss: Number(x.n_miss), nNonmiss: Number(x.n_nonmiss), auc: numOrNull(x.auc), reading: String(x.reading ?? "") }] : [];
      }) : [],
    },
  };
}

export function test1View(t: MaskedTest1, engineOrder?: string[]): Test1View {
  const order = engineOrder ?? Object.keys(t.raters.AARON.primary.per_engine);
  const miss = ge((t.raters.AARON.primary as RaterPrimary & { miss?: string }).miss ?? "");
  const rule = "Registered rule: both raters' exact one-sided p of 0.05 or lower.";
  const common = { state: t.state, miss, rule, deadline: t.r7_deadline, r7Note: r7Note(t.state, t.r7_blind_to_engine_styles), partialNote: t.partial_note, basis: t.basis };
  // five engines: only the most extreme correlations can reach p of 0.05 (attainable_p_no_ties lists them all)
  const reach = t.attainable_p_no_ties.filter(([, p]) => p <= 0.05).map(([r]) => r);
  const attainable = `With ${WORDS[order.length] ?? order.length} engines, without ties, only rho of ${fixed(Math.max(...reach), 1)} or lower can reach p of 0.05.`;
  const aaron = (tag: string | null) => raterView("AARON", t.raters.AARON, tag, order, t.steadiness_px);
  if (t.state === "pending") {
    return { ...common, chip: cap(t.label), verdict: null, reading: null, kappa: null, attainable,
      raters: [aaron(t.raters.AARON.provisional ?? "provisional (AARON only)")] };
  }
  if (t.state === "fallback") {
    // R7's files may have arrived late: the writer keeps R7's ratings and kappa, labelled author-rated, with no verdict
    return { ...common, chip: cap(t.label), verdict: null, reading: cap(t.h1_reading ?? "not tested by two raters"), attainable,
      kappa: t.raters.R7 && t.kappa ? Object.entries(t.kappa).map(([study, value]) => ({ study, value })) : null,
      raters: [aaron("author-rated"), ...(t.raters.R7 ? [raterView("R7", t.raters.R7, "author-rated", order, t.steadiness_px)] : [])] };
  }
  if (!t.raters.R7) throw new Error("two-rater state without R7's ratings");
  const both = t.raters.AARON.primary.p_le_0_05 && t.raters.R7.primary.p_le_0_05;
  if (t.verdict !== "supported" && t.verdict !== "not supported") throw new Error(`two-rater state without a verdict: ${String(t.verdict)}`);
  if ((t.verdict === "supported") !== both) throw new Error(`verdict ${t.verdict} disagrees with the raters' p values`);
  return { ...common, chip: cap(t.label), verdict: cap(t.verdict) as "Supported" | "Not supported",
    reading: null,
    kappa: t.kappa ? Object.entries(t.kappa).map(([study, value]) => ({ study, value })) : null, attainable,
    raters: [aaron(null), raterView("R7", t.raters.R7, null, order, t.steadiness_px)] };
}

// ------------------------------------------------------------------ geometry (A9.4 "Mapping a mask onto a clip")
export type Pt = [number, number];
export type Mapping = "stretch" | "centre-crop";
/** Python's round(): half to even, so the crop matches metrics/masked.py crop_geometry() to the pixel. */
function roundHalfEven(x: number): number {
  const fl = Math.floor(x), d = x - fl;
  return d < 0.5 ? fl : d > 0.5 ? fl + 1 : fl % 2 === 0 ? fl : fl + 1;
}
/** [scaled_w, scaled_h, left, top]: the panel is scaled to scaled_w x scaled_h and the clip grid is the window at (left, top). */
export function cropGeometry(panelPx: Pt, frameWH: Pt, mapping: Mapping): [number, number, number, number] {
  const [pw, ph] = panelPx, [W, H] = frameWH;
  if (mapping === "stretch") return [W, H, 0, 0];
  const s = Math.max(H / ph, W / pw);
  const sh = Math.max(H, roundHalfEven(ph * s)), sw = Math.max(W, roundHalfEven(pw * s));
  return [sw, sh, Math.floor((sw - W) / 2), Math.floor((sh - H) / 2)];
}
export type Mapper = (p: Pt) => Pt;
export const panelMapper = (panelPx: Pt): Mapper => ([x, y]) => [x * panelPx[0], y * panelPx[1]];
export function frameMapper(panelPx: Pt, frameWH: Pt, mapping: Mapping): Mapper {
  const [sw, sh, left, top] = cropGeometry(panelPx, frameWH, mapping);
  return ([x, y]) => [x * sw - left, y * sh - top];
}
export const frameMask = (polygon: Pt[], panelPx: Pt, frameWH: Pt, mapping: Mapping): Pt[] =>
  polygon.map(frameMapper(panelPx, frameWH, mapping));
/** Stroke width, in frame pixels, whose half is the dilation by a disk of radius m (round joins). */
export const marginStroke = (m: number) => 2 * m;
/** The eligibility grid a panel is scored on: 1280x720, or 720x1280 for the portrait panel. */
export const gridFor = (W: number, H: number): Pt => (H > W ? [720, 1280] : [1280, 720]);
/** The margin m as a stroke width in the gallery's panel pixels: 2m times the panel-to-grid ratio, on that panel's own grid. */
export function galleryStroke(m: number, W: number, H: number): number {
  const [gw, gh] = gridFor(W, H);
  return marginStroke(m) * Math.max(W / gw, H / gh);
}
const r1 = (v: number) => String(Math.round(v * 10) / 10);
/** SVG path data for rings given in panel fractions, drawn through `map`. */
export const regionPath = (polys: Pt[][], map: Mapper): string =>
  polys.filter((p) => p.length).map((ring) => ring.map(map).map(([x, y], i) => `${i ? "L" : "M"}${r1(x)} ${r1(y)}`).join("") + "Z").join("");

// ------------------------------------------------------------------ slopegraph
export type SlopeRow = { engine: string; name: string; line: boolean; yl: number; yr: number | null; ly: number; ry: number | null };
const LABEL_GAP = 13, PAD = 8;
/** Left (whole frame) and right (masked) y per engine on one shared linear scale; label ys keep 13 px apart. */
export function slope(rows: LeagueRow[], h: number): SlopeRow[] {
  const vals = rows.flatMap((r) => [r.whole, r.masked]).filter((v): v is number => v !== null && Number.isFinite(v));
  const top = vals.length ? Math.max(...vals) : 1;
  const y = (v: number) => h - PAD - (v / (top || 1)) * (h - 2 * PAD);
  const spread = (ys: (number | null)[]) => {
    const idx = ys.flatMap((v, i) => (v === null ? [] : [i]));
    const out = spreadLabels(idx.map((i) => ys[i] as number), LABEL_GAP, PAD, h - PAD);
    const res: (number | null)[] = ys.map(() => null);
    idx.forEach((i, k) => (res[i] = out[k]));
    return res;
  };
  const yl = rows.map((r) => (r.whole === null ? null : y(r.whole))), yr = rows.map((r) => (r.masked === null ? null : y(r.masked)));
  const ly = spread(yl), ry = spread(yr);
  return rows.map((r, i) => ({ engine: r.engine, name: r.name, line: yl[i] !== null && yr[i] !== null, yl: yl[i] ?? NaN, yr: yr[i], ly: ly[i] ?? NaN, ry: ry[i] }));
}

/** A chart label cut to `maxPx`: the name loses its end (with an ellipsis), the figure after it never does. `full` is for a tooltip. */
export function fitLabel(name: string, suffix: string, maxPx: number, width: (s: string) => number): { text: string; full: string; cut: boolean } {
  const full = name + suffix;
  if (width(full) <= maxPx) return { text: full, full, cut: false };
  let n = name.length;
  while (n > 0 && width(name.slice(0, n).trimEnd() + "\u2026" + suffix) > maxPx) n--;
  return { text: name.slice(0, n).trimEnd() + "\u2026" + suffix, full, cut: true };
}

// ------------------------------------------------------------------ gallery
const ringArea = (r: Pt[]) => Math.abs(r.reduce((a, [x, y], i) => a + (x * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * y), 0)) / 2;
/** What the mask does to a row: leaves a region to measure, leaves nothing to move, or covers the whole panel. */
export function regionState(row: MaskedRow, set: MaskSet): "region" | "nothing-allowed" | "whole-panel" {
  if (row.status[set] === "nothing-allowed" || row.polygons[set].every((r) => r.length === 0)) return "nothing-allowed";
  return row.polygons[set].some((r) => ringArea(r) >= 0.999) ? "whole-panel" : "region";
}
