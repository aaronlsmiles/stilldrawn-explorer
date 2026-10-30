// Serves the thesis's two tellings as parsed blocks: import { finding, object } from "virtual:thesis".
// The Markdown lives at the repo root (THESIS.md, THESIS-object-first.md), outside Vite's root, so it
// is read with fs and watched in dev. Parsing at build time means a construct outside the subset
// fails the build, not the page.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { parseThesis, type Block } from "../src/views/About/thesisMd.ts";

/** width and height from a PNG's IHDR, so the page can reserve each figure's space */
function pngSize(file: string) {
  if (!existsSync(file)) return undefined;
  const b = readFileSync(file);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

const ID = "virtual:thesis";
const RESOLVED = "\0" + ID;

export function thesis(repoRoot: string): Plugin {
  const files = { finding: resolve(repoRoot, "THESIS.md"), object: resolve(repoRoot, "THESIS-object-first.md") };
  return {
    name: "sd-thesis",
    resolveId: (id) => (id === ID ? RESOLVED : undefined),
    load(id) {
      if (id !== RESOLVED) return;
      const out: Record<string, unknown> = {};
      for (const [k, f] of Object.entries(files)) {
        this.addWatchFile(f);
        out[k] = parseThesis(readFileSync(f, "utf8")).map((b: Block) =>
          b.type === "figure"
            ? { ...b, size: pngSize(resolve(repoRoot, b.src)), phone: pngSize(resolve(repoRoot, b.src.replace(/-light\.png$/, "-phone-light.png"))) }
            : b,
        );
      }
      return Object.entries(out).map(([k, v]) => `export const ${k} = ${JSON.stringify(v)};`).join("\n");
    },
    handleHotUpdate({ file, server }) {
      if (!Object.values(files).includes(file)) return;
      const m = server.moduleGraph.getModuleById(RESOLVED);
      if (m) server.moduleGraph.invalidateModule(m);
      server.ws.send({ type: "full-reload" });
    },
  };
}
