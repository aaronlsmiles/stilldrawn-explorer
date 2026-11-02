// Every number in either telling of the thesis must come from the data contract, or from a source
// named here. The film's captions have the same rule (film/build/facts.py).
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { ALLOWED } from "../../test/facts";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

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
