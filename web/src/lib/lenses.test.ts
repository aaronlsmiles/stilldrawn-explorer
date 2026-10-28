import { describe, it, expect } from "vitest";
import fx from "./__fixtures__/lenses.json";
import {
  summary, priceRanking, priceCrossovers, floorRanking, bandRanking, pairwiseBands,
  type BoardRow, type BasisRow,
} from "./lenses";
import { pareto, onLowerHull } from "./pareto";

type Row = { engine: string; rank: number | null; ranked: boolean; score: number | null; drift_median_px: number | null; n: number };
const basis: BasisRow[] = fx.basis.map((r) => ({ ...r, drift: r.drift ?? NaN }));
const summ = summary(basis);
const close = (a: number | null | undefined, b: number | null | undefined) =>
  a == null || b == null ? expect(a ?? null).toBe(b ?? null) : expect(Math.abs(a - b)).toBeLessThan(1e-9);

function sameBoard(got: BoardRow[], want: Row[]) {
  expect(got.map((r) => [r.engine, r.rank, r.ranked])).toEqual(want.map((r) => [r.engine, r.rank, r.ranked]));
  got.forEach((r, i) => {
    close(r.score, want[i].score);
    close(r.drift_median_px, want[i].drift_median_px);
    expect(r.n).toBe(want[i].n);
  });
}

describe("parity with pipeline/stilldrawn_web/lenses.py", () => {
  it("summary", () => {
    expect(Object.keys(summ)).toEqual(Object.keys(fx.summary));
    for (const [e, w] of Object.entries(fx.summary)) {
      expect(summ[e].n).toBe(w.n);
      close(summ[e].motion_median_norm, w.motion_median_norm);
      close(summ[e].drift_median_px, w.drift_median_px);
      close(summ[e].motion_iqr[0], w.motion_iqr[0]);
      close(summ[e].motion_iqr[1], w.motion_iqr[1]);
    }
  });
  it("pareto front and dominated sets", () => expect(pareto(summ)).toEqual(fx.pareto));
  it("pairwise bands", () => {
    const got = pairwiseBands(basis, summ);
    expect(Object.keys(got)).toEqual(Object.keys(fx.pairwise));
    for (const [k, w] of Object.entries<Record<string, unknown>>(fx.pairwise)) {
      const g = got[k];
      close(g.lo, w.lo as number);
      close(g.hi, w.hi as number);
      expect([g.overlaps, g.usable, g.winner_in_band, g.reverses_league])
        .toEqual([w.overlaps, w.usable, w.winner_in_band, w.reverses_league]);
    }
  });
  it("price boards", () => {
    for (const [p, want] of Object.entries(fx.price)) sameBoard(priceRanking(summ, Number(p)), want as Row[]);
  });
  it("price crossovers", () => {
    const got = priceCrossovers(summ, 3);
    expect(got.map((s) => s.leader)).toEqual(fx.crossovers.map((s) => s.leader));
    got.forEach((s, i) => { close(s.p_from, fx.crossovers[i].p_from); close(s.p_to, fx.crossovers[i].p_to); });
  });
  it("floor boards", () => {
    for (const [f, want] of Object.entries(fx.floor)) sameBoard(floorRanking(basis, Number(f)), want as Row[]);
  });
  it("band boards at each pairwise preset", () => {
    const pw = fx.pairwise as Record<string, { lo: number; hi: number }>;
    for (const [k, want] of Object.entries(fx.band)) sameBoard(bandRanking(basis, pw[k].lo, pw[k].hi), want as Row[]);
  });
  it("only lower-hull engines ever lead on price", () => {
    const leaders = new Set(priceCrossovers(summ, 3).map((s) => s.leader));
    for (const e of leaders) expect(onLowerHull(summ, e)).toBe(true);
    expect(onLowerHull(summ, "gen4_turbo")).toBe(false);
    expect(leaders.has("gen4_turbo")).toBe(false);
  });
});
