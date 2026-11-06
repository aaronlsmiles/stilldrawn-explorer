// @vitest-environment node
// The thesis plugin: MASKED-DRIFT.md becomes `masked`, and is null while it is the placeholder.
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { thesis } from "./thesis.ts";

function load(masked: string) {
  const dir = mkdtempSync(join(tmpdir(), "thesis-"));
  writeFileSync(join(dir, "THESIS.md"), "# A\n\nOne.\n");
  writeFileSync(join(dir, "THESIS-object-first.md"), "# B\n\nTwo.\n");
  writeFileSync(join(dir, "MASKED-DRIFT.md"), masked);
  const p = thesis(dir) as unknown as { load: (this: { addWatchFile: (f: string) => void }, id: string) => string };
  const code = p.load.call({ addWatchFile() {} }, "\0virtual:thesis");
  return Object.fromEntries([...code.matchAll(/export const (\w+) = (.*);/g)].map((m) => [m[1], JSON.parse(m[2])]));
}

describe("virtual:thesis masked", () => {
  test("is null while the file is the placeholder", () => {
    expect(load("# Drift where nothing should move\n\nPlaceholder: the write-up is not written yet.\n").masked).toBeNull();
  });
  test("is the parsed blocks once words exist; the other two tellings are unchanged", () => {
    const out = load("# Drift where nothing should move\n\nExploratory words.\n");
    expect(out.masked).toEqual([
      { type: "h1", inlines: [{ t: "text", v: "Drift where nothing should move" }] },
      { type: "p", inlines: [{ t: "text", v: "Exploratory words." }] },
    ]);
    expect(Object.keys(out).sort()).toEqual(["finding", "masked", "object"]);
  });
});
