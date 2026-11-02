// The plain-words layer's rules (the hub's docs/plain-words.md): every digit from the data contract,
// a rounded figure marked "about", field words only inside quotes (where a note names a label on
// screen), a reading level a 12-year-old manages, nothing on /rate that names a model, and every
// note placed in exactly one view.
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { parseBanned } from "blindpanel";
import { ALLOWED, paper } from "../test/facts";
import { ABOUT_NOTES, CHAPTERS, NOTES, SIDE_ROOMS, UI, type Chapter } from "./words";

const src = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const told = (c: Chapter) => [c.title, ...c.band];
const STORY = [...CHAPTERS.flatMap(told), ...Object.values(SIDE_ROOMS).flatMap(told), ...Object.values(NOTES).flat()];
const EVERYTHING = [...STORY, ...Object.values(UI)];
const unquoted = (s: string) => s.replace(/"[^"]*"/g, "");

describe("honest numbers", () => {
  test("every digit has a source in the data contract", () => {
    const digits = EVERYTHING.flatMap((s) => [...s.matchAll(/\d+(?:\.\d+)?/g)].map((m) => m[0]));
    expect(digits.filter((d) => !ALLOWED.has(d)), "digits with no source").toEqual([]);
  });

  const WORDS: Record<string, number> = { three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, twenty: 20, hundred: 100, thousand: 1000 };
  /** spelled-out figures: what each stands for, and whether it is rounded (and must say "about") */
  const SPELLED: Record<string, { value: number; source: string; about?: true }> = {
    five: { value: paper.engine_rho_motion_drift.n_engines, source: "the engines analysed" },
    nine: { value: Math.round(paper.gen45_motion_vs_wan22), source: "Gen-4.5's motion over Wan 2.2's, rounded", about: true },
  };
  test("every spelled-out figure is sourced, and a rounded one says \"about\"", () => {
    const bad: string[] = [];
    for (const s of STORY) {
      for (const m of s.toLowerCase().matchAll(new RegExp(`\\b(${Object.keys(WORDS).join("|")})\\b`, "g"))) {
        const w = m[1], known = SPELLED[w];
        if (!known || known.value !== WORDS[w]) bad.push(`"${w}" has no source: ${s}`);
        else if (known.about && !s.toLowerCase().slice(0, m.index).endsWith("about ")) bad.push(`"${w}" is rounded and must follow "about": ${s}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("plain words", () => {
  // Field words may appear only in quotes, naming a label on the page ("the page calls it ...").
  const JARGON = /\b(median|metrics?|benchmark|optical flow|pareto|correlat\w*|spearman|interquartile|chamfer|px|pixels?|iou|embedding|dinov2|amendment|pre-?regist\w*|variance|cosine|normali[sz]ed|significan\w*|dataset|algorithm|models?|AI|engines?|screentone|lens|leaderboard|scatter|clips?|drift measure)\b|[ρα×]/i;
  test("field words appear only inside quotes", () => {
    expect(EVERYTHING.filter((s) => JARGON.test(unquoted(s))).map((s) => `${unquoted(s).match(JARGON)![0]}: ${s}`)).toEqual([]);
  });

  /** Flesch–Kincaid grade over the story's sentences (titles aside), with the usual syllable heuristic. */
  const syllables = (w: string) => {
    const s = w.toLowerCase().replace(/[^a-z]/g, "");
    if (!s) return 0;
    if (s.length <= 3) return 1;
    const t = s.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
    return Math.max(1, (t.match(/[aeiouy]{1,2}/g) ?? []).length);
  };
  const sentences = [...CHAPTERS.flatMap((c) => c.band), ...Object.values(SIDE_ROOMS).flatMap((c) => c.band), ...Object.values(NOTES).flat()]
    .flatMap((p) => p.split(/(?<=[.!?])\s+/)).map((s) => s.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)));
  const words = sentences.flat();
  const grade = 0.39 * (words.length / sentences.length) + 11.8 * (words.reduce((n, w) => n + syllables(w), 0) / words.length) - 15.59;

  test(`reads at grade 6 or below (Flesch–Kincaid ${grade.toFixed(1)})`, () => {
    expect(grade).toBeLessThanOrEqual(6);
  });
  test("short sentences: 14 words on average, none over 25", () => {
    expect(words.length / sentences.length).toBeLessThanOrEqual(14);
    expect(sentences.filter((s) => s.length > 25).map((s) => s.join(" "))).toEqual([]);
  });
  test("no draft notes", () => {
    expect(EVERYTHING.join("\n")).not.toMatch(/Draft|TODO|TBD/);
  });
});

test("/rate's chapter and note name no model, vendor or tool (the blinding list)", () => {
  const banned = parseBanned(src("../../vendor/stilldrawn-banned-terms.txt"));
  const rate = [...told(CHAPTERS.find((c) => c.path === "/rate")!), ...NOTES["rate.blind"], ...Object.values(UI)].join("\n");
  expect(banned.filter((b) => (typeof b === "string" ? rate.toLowerCase().includes(b.toLowerCase()) : b.test(rate))).map(String)).toEqual([]);
});

describe("placement", () => {
  const views = (dir: string): string[] => readdirSync(new URL(dir, import.meta.url), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? views(`${dir}${e.name}/`) : e.name.endsWith(".tsx") && !e.name.includes(".test.") ? [src(`${dir}${e.name}`)] : []));
  const code = views("../views/").join("\n");

  test("every note is placed in exactly one view (/about's three go before its sections)", () => {
    const counts = Object.keys(NOTES).map((id) => [id, ABOUT_NOTES.includes(id as never) ? 1 : code.split(`<PlainNote id="${id}"`).length - 1]);
    expect(counts.filter(([, n]) => n !== 1)).toEqual([]);
    expect(src("../views/About/About.tsx")).toContain("ABOUT_NOTES[");
  });
  test("every chapter and side room is a real route", () => {
    const app = src("../App.tsx");
    expect([...CHAPTERS, ...Object.values(SIDE_ROOMS)].map((c) => c.path).filter((p) => !app.includes(`path === "${p}"`))).toEqual([]);
    expect(Object.values(SIDE_ROOMS).filter((s) => !CHAPTERS.some((c) => c.path === s.next))).toEqual([]);
  });
});
