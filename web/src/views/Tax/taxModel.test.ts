import { it, expect } from "vitest";
import fx from "../../lib/__fixtures__/lenses.json";
import { LENSES, boardFor, parseState, stateToQuery, motionScale, announce, type LensData } from "./taxModel";
import type { BasisRow } from "../../lib/lenses";

const data: LensData = { basis: fx.basis.map((r) => ({ ...r, drift: r.drift ?? NaN })) as BasisRow[] };
const order = (s: Parameters<typeof boardFor>[1]) => boardFor(data, s).map((r) => r.engine);

it("price 0 is the paper's league", () => {
  expect(order({ lens: "price", p: 0 })).toEqual(["wan22", "gen4_turbo", "ltx23", "gen4.5", "h3-fal"]);
});
it("just past the last crossover Gen-4.5 leads", () => {
  const last = fx.crossovers[fx.crossovers.length - 1];
  expect(order({ lens: "price", p: last.p_from + 0.01 })[0]).toBe("gen4.5");
});
it("each reversal preset puts the pair's band winner first within the pair", () => {
  const pw = fx.pairwise as unknown as Record<string, { lo: number; hi: number; winner_in_band: string }>;
  for (const k of ["gen4_turbo|h3-fal", "gen4_turbo|ltx23"]) {
    const [a, b] = k.split("|");
    const pair = order({ lens: "band", lo: pw[k].lo, hi: pw[k].hi, preset: k }).filter((e) => e === a || e === b);
    expect(pair[0]).toBe(pw[k].winner_in_band);
  }
});
it("G4: price of motion is the default and the band the one alternate", () => {
  expect(LENSES.map((l) => l.id)).toEqual(["price", "band"]);
});
it("the motion scale is monotone and spans the basis", () => {
  const s = motionScale(data.basis);
  const ms = data.basis.map((r) => r.motion);
  expect(s.toValue(0)).toBe(Math.min(...ms));
  expect(s.toValue(1000)).toBe(Math.max(...ms));
  expect(data.basis.filter((r) => r.motion >= s.min && r.motion <= s.max).length).toBe(164);
  expect(s.toValue(501)).toBeGreaterThan(s.toValue(500));
  expect(s.toStep(s.toValue(250))).toBe(250);
});
it("query parsing defaults to price at 0 and clamps", () => {
  expect(parseState(new URLSearchParams())).toEqual({ lens: "price", p: 0 });
  expect(parseState(new URLSearchParams("lens=price&p=9"))).toEqual({ lens: "price", p: 3 });
  // the motion floor was cut at G4; old links land on the default lens
  expect(parseState(new URLSearchParams("lens=floor&f=0.002"))).toEqual({ lens: "price", p: 0 });
  expect(parseState(new URLSearchParams("lens=band&lo=0.003&hi=0.001"))).toEqual({ lens: "band", lo: 0.001, hi: 0.003, preset: null });
});
it("band edges round-trip exactly", () => {
  const lo = 0.0005133123456789123, hi = 0.0031234567890123456;
  const q = Object.entries(stateToQuery({ lens: "band", lo, hi, preset: null })).filter(([, v]) => v != null) as [string, string][];
  expect(parseState(new URLSearchParams(q))).toEqual({ lens: "band", lo, hi, preset: null });
});
it("announces order changes only, in the new order", () => {
  const b = (es: string[], unr: string[] = []) => [
    ...es.map((engine, i) => ({ engine, rank: i + 1, ranked: true })),
    ...unr.map((engine) => ({ engine, rank: null, ranked: false })),
  ];
  const n = (e: string) => ({ wan22: "Wan 2.2", "gen4.5": "Gen-4.5", ltx23: "LTX-2.3" } as Record<string, string>)[e];
  expect(announce(b(["wan22", "gen4.5"]), b(["wan22", "gen4.5"]), n)).toBe("");
  expect(announce(b(["wan22", "gen4.5"]), b(["gen4.5", "wan22"]), n)).toBe("Gen-4.5 moves to 1st. Wan 2.2 moves to 2nd.");
  expect(announce(b(["wan22", "ltx23"]), b(["wan22"], ["ltx23"]), n)).toBe("LTX-2.3 drops out: too few clips.");
});
