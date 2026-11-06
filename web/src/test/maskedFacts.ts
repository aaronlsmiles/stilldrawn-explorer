// Every figure the masked-drift write-up (MASKED-DRIFT.md) may quote, each with its source in
// public/data/v1/masked.json. Empty while that file is absent (it is dark until the real A9 outputs exist).
// Formatted with the view's own formatters, so prose and page show a figure the same way.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, URL as NodeURL } from "node:url";
import type { Masked } from "../data/types";
import { fixed, pval, ratio, rho } from "../lib/format";

// a path string for node:fs
export const MASKED_JSON = fileURLToPath(new NodeURL("../../public/data/v1/masked.json", import.meta.url).href);
/** The ratio helper adds the multiplication sign; the prose digit-run is the number alone. */
const r1 = (v: number) => ratio(v).replace("×", "");
const p3 = (v: number) => (v < 0.001 ? "0.001" : pval(v));

/** Figures from one contract object. */
export function maskedAllowedFrom(m: Masked): Map<string, string> {
  const out = new Map<string, string>();
  const add = (v: number | null | undefined, text: (v: number) => string, why: string) => { if (typeof v === "number" && Number.isFinite(v)) out.set(text(v), why); };
  const int = (v: number | null | undefined, why: string) => add(v, String, why);

  // the eligible rows and the registered grid
  int(m.test2.n_eligible_rows, "test2.n_eligible_rows");
  int(m.rows.length, "rows: the number of rows");
  int(m.rows.filter((r) => !r.eligible).length, "rows: the number left out");
  int(m.test2.min_f0_line_px_in_R, "test2.min_f0_line_px_in_R");
  int(m.test2.bootstrap.B, "test2.bootstrap.B");
  for (const mg of [16, 32, 64]) int(mg, "the margin grid");

  for (const [split, sets] of Object.entries(m.test2.conditions)) {
    for (const [set, margins] of Object.entries(sets)) {
      for (const [mk, c] of Object.entries(margins)) {
        const at = `test2.conditions.${split}.${set}.${mk}`;
        int(Object.values(c.n_clips).reduce((a, b) => a + b, 0), `${at}: N cells`);
        for (const [e, n] of Object.entries(c.n_clips)) int(n, `${at}.n_clips.${e}`);
        add(c.ratio_whole, r1, `${at}.ratio_whole`);
        add(c.ratio_masked, r1, `${at}.ratio_masked`);
        add(c.s, (v) => fixed(v, 2), `${at}.s`);
        add(c.s_ci95?.[0], (v) => fixed(v, 2), `${at}.s_ci95 lower`);
        add(c.s_ci95?.[1], (v) => fixed(v, 2), `${at}.s_ci95 upper`);
        add(c.kendall_tau_b, (v) => fixed(v, 2), `${at}.kendall_tau_b`);
      }
    }
  }

  // Test 1
  const t = m.test1;
  for (const [id, r] of Object.entries(t.raters)) {
    if (!r) continue;
    const blocks = [["primary", r.primary], ["sensitivity", (r as Record<string, unknown>).sensitivity_miss_le_3 as Masked["test1"]["raters"]["AARON"]["primary"] | undefined]] as const;
    for (const [name, b] of blocks) {
      if (!b) continue;
      const at = `test1.raters.${id}.${name}`;
      add(b.rho, rho, `${at}.rho`);
      add(b.p_one_sided, (v) => p3(v), `${at}.p_one_sided`);
      for (const [e, x] of Object.entries(b.per_engine)) {
        int(x.n, `${at}.${e}.n`); int(x.misses, `${at}.${e}.misses`);
        add(x.miss_rate, (v) => fixed(v, 2), `${at}.${e}.miss_rate`);
        add(x.wilson95[0], (v) => fixed(v, 2), `${at}.${e}.wilson95 lower`);
        add(x.wilson95[1], (v) => fixed(v, 2), `${at}.${e}.wilson95 upper`);
      }
    }
  }
  for (const [study, k] of Object.entries(t.kappa ?? {})) add(k, (v) => fixed(v, 2), `test1.kappa.${study}`);
  return out;
}

/** The figures of the file at `file` (the shipped contract by default); empty when it is absent. */
export function maskedAllowed(file: string = MASKED_JSON): Map<string, string> {
  return existsSync(file) ? maskedAllowedFrom(JSON.parse(readFileSync(file, "utf8")) as Masked) : new Map();
}
