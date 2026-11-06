// @vitest-environment node
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const DATA = new URL("../../public/data/v1/", import.meta.url);
const FIXTURE = new URL("../views/Tax/__fixtures__/masked-pending.json", import.meta.url);

let urls: string[];
let failMasked = false;
function stubFetch() {
  urls = [];
  vi.stubGlobal("fetch", async (u: string) => {
    urls.push(u);
    const name = u.replace("/data/v1/", "");
    if (name === "masked.json" && failMasked) return { ok: false, status: 404, json: async () => ({}) };
    const body = name === "masked.json" ? readFileSync(FIXTURE, "utf8")
      : name === "index.json" ? readFileSync(new URL("index.json", DATA), "utf8")
      : /^(engines|panels|clips|basis)\.json$/.test(name) ? "[]" : "{}";
    return { ok: true, status: 200, json: async () => JSON.parse(body) };
  });
}

beforeEach(() => { vi.resetModules(); failMasked = false; stubFetch(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("the masked contract is its own request", () => {
  it("loadCore never asks for masked.json or any A9 file", async () => {
    const { loadCore } = await import("./load");
    await loadCore();
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.filter((u) => /masked|a9|adherence/i.test(u))).toEqual([]);
  });

  it("loadMasked requests only /data/v1/masked.json, once", async () => {
    const { loadMasked } = await import("./load");
    const a = loadMasked(), b = loadMasked();
    expect(a).toBe(b);
    const m = await a;
    expect(urls).toEqual(["/data/v1/masked.json"]);
    expect(m.schema).toBe("stilldrawn-explorer-masked/1");
    expect(m.provenance.synthetic).toBe(true);
  });

  it("keeps a failure cached instead of refetching in a loop", async () => {
    failMasked = true;
    const { loadMasked } = await import("./load");
    await expect(loadMasked()).rejects.toThrow("masked.json: 404");
    await expect(loadMasked()).rejects.toThrow("masked.json: 404");
    expect(urls).toEqual(["/data/v1/masked.json"]);
  });

  it("index.json names no engine except the one refused-cell note that was already there", () => {
    const idx = JSON.parse(readFileSync(new URL("index.json", DATA), "utf8"));
    expect(typeof idx.masked).toBe("boolean");
    const { missing_cells, ...rest } = idx;       // missing_cells is the pre-existing cu-tone-3_idle_gen4t note
    expect(missing_cells).toEqual([{ cell: "cu-tone-3_idle_gen4t", reason: expect.any(String) }]);
    expect(JSON.stringify(rest)).not.toMatch(/gen4|wan22|ltx23|h3-fal/);
  });
});
