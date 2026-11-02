// The numbers the site's prose may quote, each with its source in the data contract. Shared by the
// thesis's facts test (views/About/thesisFacts.test.ts) and the plain-words test (plainwords/words.test.ts);
// the film's captions have the same rule (film/build/facts.py).
import { readFileSync } from "node:fs";

export const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
export const json = (rel: string) => JSON.parse(read(`../../public/data/v1/${rel}`));
export const paper = Object.fromEntries(Object.entries(json("paper.json")).map(([k, v]) => [k, (v as { value: unknown }).value])) as Record<string, any>;
export const clips: { c2pa: boolean; arm: string }[] = json("clips.json");
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
export const ALLOWED = new Map<string, string>([
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
