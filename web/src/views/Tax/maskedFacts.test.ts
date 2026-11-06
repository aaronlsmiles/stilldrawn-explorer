// @vitest-environment node
// The write-up's rules (MASKED-DRIFT.md): every figure from masked.json or the thesis list, exploratory and
// post-hoc in the first breath, the thesis Markdown subset, Test 1 told in its current state, 700 to 900 words.
// While the file is the placeholder it may not be live (index.masked false) and nothing else is checked.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { ALLOWED } from "../../test/facts";
import { maskedAllowed, maskedAllowedFrom, MASKED_JSON } from "../../test/maskedFacts";
import { fixture } from "../../test/maskedKit";
import { parseThesis } from "../About/thesisMd";
import type { Masked } from "../../data/types";

export const SENTINEL = "Placeholder: the write-up is not written yet.";
// path strings for node:fs
const path = (rel: string) => fileURLToPath(new URL(rel, import.meta.url).href);
const WRITEUP = path("../../../../MASKED-DRIFT.md");
const INDEX = path("../../../public/data/v1/index.json");

/** digit runs in the prose: engine names, the amendment, test labels, rater ids and link targets removed first */
function numbers(md: string) {
  const prose = md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\]\([^)]*\)/g, "]")
    .replace(/Gen-4\.5|Gen-4 Turbo|LTX-2\.3|Wan 2\.2|MiniMax H3|\bH3\b|\bA[69]\b|\bR7\b|\bTest [12]\b|\bGen-4\b/g, "");
  return [...prose.matchAll(/−?\d+(?:\.\d+)?/g)].map((m) => m[0]);
}
const words = (md: string) => md.split(/\s+/).filter(Boolean).length;

/** Everything the write-up must satisfy. Empty means it does. `masked` is the contract it is told against. */
export function writeupProblems(md: string, masked: Masked | null, indexMasked: boolean, allowed: Map<string, string>): string[] {
  const out: string[] = [];
  if (md.includes(SENTINEL)) {
    if (indexMasked) out.push("a placeholder write-up with index.masked true: the view would be live without its words");
    return out;
  }
  if (!masked) return ["a written write-up with no masked.json to check it against"];
  const unknown = [...new Set(numbers(md))].filter((n) => !allowed.has(n) && !ALLOWED.has(n));
  if (unknown.length) out.push(`figures with no source: ${unknown.join(", ")}`);
  for (const w of ["exploratory", "post-hoc", "A9"]) if (!md.toLowerCase().includes(w.toLowerCase())) out.push(`lacks "${w}"`);
  if (/doubling|log2|log₂|GWM|arxiv|nephele/i.test(md)) out.push("uses a banned word (doubling, log2, GWM, arXiv, Nephele)");
  if (/###|`|<[a-z/]|^\s*\|.*\|/m.test(md)) out.push("uses markup outside the thesis subset (###, backticks, HTML, tables)");
  try { parseThesis(md); } catch (e) { out.push(`outside the thesis Markdown subset: ${(e as Error).message}`); }
  const t = masked.test1;
  if (t.state === "pending" && !/second rater/i.test(md)) out.push('pending Test 1 must say "second rater"');
  if (t.state === "fallback" && !/not tested by two raters/i.test(md)) out.push('fallback Test 1 must say "not tested by two raters"');
  if (t.state === "two-rater" && !new RegExp(String(t.verdict), "i").test(md)) out.push(`two-rater Test 1 must state the verdict (${t.verdict})`);
  const n = words(md);
  if (n < 700 || n > 900) out.push(`${n} words; the thesis is 700 to 900`);
  return out;
}

const fx = fixture("pending");
const fxAllowed = maskedAllowedFrom(fx);
/** a write-up that satisfies every rule against the pending fixture */
function goodText(extra = "") {
  const filler = Array.from({ length: 80 }, (_, i) => `Sentence ${i % 2 ? "about" : "on"} the drawing and its allowed region stays plain.`.replace(/\d+/g, "")).join(" ");
  return `# Drift where nothing should move\n\nThis is exploratory and post-hoc work under A9. The second rater has not rated yet. ${filler} ${extra}`.trim();
}

describe("MASKED-DRIFT.md", () => {
  const md = readFileSync(WRITEUP, "utf8");
  const indexMasked = JSON.parse(readFileSync(INDEX, "utf8")).masked === true;
  const masked = existsSync(MASKED_JSON) ? (JSON.parse(readFileSync(MASKED_JSON, "utf8")) as Masked) : null;
  test("it meets every rule (a placeholder may never be live)", () => {
    expect(writeupProblems(md, masked, indexMasked, maskedAllowed())).toEqual([]);
  });
  test("it parses in the thesis Markdown subset", () => {
    expect(() => parseThesis(md)).not.toThrow();
  });
});

describe("the rules can fail", () => {
  const ok = goodText();
  test("the placeholder passes while the view is dark, and fails when it is live", () => {
    expect(writeupProblems(`# T\n\n${SENTINEL}`, fx, false, fxAllowed)).toEqual([]);
    expect(writeupProblems(`# T\n\n${SENTINEL}`, fx, true, fxAllowed)).not.toEqual([]);
  });
  test("a good text passes", () => {
    expect(words(ok)).toBeGreaterThanOrEqual(700);
    expect(writeupProblems(ok, fx, true, fxAllowed)).toEqual([]);
  });
  test("a figure from the contract passes and a stray one fails", () => {
    expect(writeupProblems(goodText("The ratio falls from 8.0 to 2.0."), fx, true, fxAllowed)).toEqual([]);
    expect(writeupProblems(goodText("The ratio falls from 8.7 to 2.0."), fx, true, fxAllowed)[0]).toMatch(/8\.7/);
  });
  test("each other rule fails on its own bad text", () => {
    const bad = (extra: string, re: RegExp) => expect(writeupProblems(goodText(extra), fx, true, fxAllowed).join("|")).toMatch(re);
    bad("A doubling happened.", /banned/);
    bad("### A heading", /markup/);
    bad("See `code`.", /markup/);
    bad("This is arXiv news.", /banned/);
    expect(writeupProblems(ok.replace("exploratory", "tentative"), fx, true, fxAllowed).join("|")).toMatch(/exploratory/);
    expect(writeupProblems(ok.replace("second rater", "partner"), fx, true, fxAllowed).join("|")).toMatch(/second rater/);
    expect(writeupProblems(ok.split(" ").slice(0, 300).join(" "), fx, true, fxAllowed).join("|")).toMatch(/words/);
    expect(writeupProblems(ok, null, true, fxAllowed)[0]).toMatch(/no masked\.json/);
  });
  test("each Test 1 state asks for its own words", () => {
    const two = fixture("two-rater"), fb = fixture("fallback");
    expect(writeupProblems(ok, fb, true, maskedAllowedFrom(fb)).join("|")).toMatch(/not tested by two raters/);
    expect(writeupProblems(ok, two, true, maskedAllowedFrom(two)).join("|")).toMatch(/verdict/);
    expect(writeupProblems(goodText("Not tested by two raters."), fb, true, maskedAllowedFrom(fb))).toEqual([]);
    expect(writeupProblems(goodText("Both raters: supported."), two, true, maskedAllowedFrom(two))).toEqual([]);
  });
});

describe("maskedAllowed", () => {
  test("is empty when masked.json is absent", () => {
    expect(maskedAllowed("/nonexistent/masked.json").size).toBe(0);
  });
  test("carries every figure family from the contract, formatted as the view formats it", () => {
    const a = maskedAllowedFrom(fx);
    const c = fx.test2.conditions.all.aaron.m32;
    expect(a.get(c.ratio_whole!.toFixed(1))).toMatch(/ratio_whole/);
    expect(a.has(c.ratio_masked!.toFixed(1))).toBe(true);
    expect(a.has(c.s!.toFixed(2))).toBe(true);
    expect(a.has(String(fx.test2.n_eligible_rows))).toBe(true);
    expect(a.has(String(Object.values(c.n_clips).reduce((x, y) => x + y, 0)))).toBe(true);
    expect(a.has("−1.00")).toBe(true);                                 // AARON's rho, with the typographic minus
    expect(a.has("0.008")).toBe(true);                                 // AARON's exact p
    const tw = fixture("two-rater");
    const k = Object.values(tw.test1.kappa ?? {}).find((v) => typeof v === "number")!;
    expect(maskedAllowedFrom(tw).has(k.toFixed(2).replace("-", "−"))).toBe(true);
  });
});
