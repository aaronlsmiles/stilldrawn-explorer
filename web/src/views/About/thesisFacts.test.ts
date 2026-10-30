// Every number in either telling of the thesis must come from the data contract, or from a source
// named here. The film's captions have the same rule (film/build/facts.py).
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const json = (rel: string) => JSON.parse(read(`../../../public/data/v1/${rel}`));
const paper = Object.fromEntries(Object.entries(json("paper.json")).map(([k, v]) => [k, (v as { value: unknown }).value])) as Record<string, any>;
const clips: { c2pa: boolean; arm: string }[] = json("clips.json");
const series = (engine: string, id: string): number[] => {
  const s = json(`series/${engine}.json`);
  const find = (o: any): any => (o && typeof o === "object" ? (id in o ? o[id] : Object.values(o).map(find).find((x) => x !== undefined)) : undefined);
  const x = find(s);
  return (Array.isArray(x) ? x : (x.chamfer ?? x.line ?? Object.values(x)[0])).filter((v: number | null) => v !== null);
};

const f = (x: number, dp: number) => x.toFixed(dp).replace("-", "−");
const within = Object.entries(paper.within_engine_rho).filter(([e]) => e !== "wan22").map(([, v]: any) => v.line.rho);
const wanIdle = series("wan22", "act-tone-2_campush_wan22");
const genIdle = series("gen4.5", "act-tone-2_campush_gen45");

/** number as written -> where it comes from */
const ALLOWED = new Map<string, string>([
  [String(paper.n_clips), "paper.n_clips"],
  [String(clips.filter((c) => c.c2pa).length), "clips.json: clips with C2PA credentials"],
  [String(paper.n_clips_by_arm.primary), "paper.n_clips_by_arm.primary"],
  ...Object.entries(paper.league_drift_median_px).map(([e, v]) => [f(v as number, 2), `league median line drift, ${e}`] as [string, string]),
  [f(paper.gen45_motion_vs_wan22, 1), "Gen-4.5 motion / Wan 2.2"],
  [f(paper.gen45_motion_vs_gen4_turbo, 1), "Gen-4.5 motion / Gen-4 Turbo"],
  [f(paper.engine_rho_motion_drift.rho, 2), "engine-level ρ"],
  [f(paper.engine_rho_motion_drift.p_exact_two_sided, 3), "engine-level exact p"],
  [f(Math.min(...within), 2), "lowest within-engine line ρ (Wan 2.2 aside)"],
  [f(Math.max(...within), 2), "highest within-engine line ρ"],
  [f(paper.within_engine_rho.wan22.line.rho, 3), "Wan 2.2's within-engine line ρ"],
  [f(paper.price_crossovers[0].p_to, 2), "price crossover: Wan 2.2 to LTX-2.3"],
  [f(paper.price_crossovers[1].p_to, 2), "price crossover: LTX-2.3 to Gen-4.5"],
  [f(paper.alpha_ordinal.register, 2), "register α"],
  ["24", "the clips reviewed frame by frame for the failure tags (release docs/TAXONOMY.md)"],
  [f(wanIdle[wanIdle.length - 1], 2), "Wan 2.2's last line-drift value on act-tone-2, camera push"],
  ["0", "the price lens at zero"],
]);
if (genIdle.slice(-12).some((v) => v > 8)) ALLOWED.set("8", "Gen-4.5's line drift passes 8 px late in act-tone-2, camera push");

const HEADLINE = ["373", "288", "0.78", "2.64", "2.80", "4.79", "5.38", "9.2", "3.8", "0.90", "0.083", "1.23", "1.27", "0.21", "24"];

/** numbers in the prose: names, figure numbers, the amendment, links, image paths and the data line removed first */
function numbers(md: string) {
  const prose = md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\]\([^)]*\)/g, "]")
    .replace(/^Data:.*$/m, "")
    .replace(/Gen-4\.5|Gen-4 Turbo|LTX-2\.3|Wan 2\.2|MiniMax H3|\bH3\b|\bA6\b|Figure \d/g, "");
  return [...prose.matchAll(/−?\d+(?:\.\d+)?/g)].map((m) => m[0]);
}

describe.each([["THESIS.md"], ["THESIS-object-first.md"]])("%s", (file) => {
  const md = read(`../../../../${file}`);
  test("every number has a source", () => {
    const unknown = [...new Set(numbers(md))].filter((n) => !ALLOWED.has(n));
    expect(unknown, `numbers with no source in ${file}`).toEqual([]);
  });
  test("it quotes every headline figure", () => {
    const have = new Set(numbers(md));
    expect(HEADLINE.filter((n) => !have.has(n))).toEqual([]);
  });
  test("no arXiv ID, and no draft notes", () => {
    expect(md).not.toMatch(/arxiv|\b2[0-9]{3}\.[0-9]{4,5}\b/i);
    expect(md).not.toMatch(/Draft|TODO|TBD/);
  });
});

test("the allowed list itself matches the paper's rounded values", () => {
  expect([...ALLOWED.keys()]).toEqual(expect.arrayContaining(["0.78", "2.64", "2.80", "4.79", "5.38", "9.2", "3.8", "0.90", "0.083", "0.38", "0.58", "−0.007", "1.23", "1.27", "0.21", "373", "288", "164", "1.35", "8"]));
});
