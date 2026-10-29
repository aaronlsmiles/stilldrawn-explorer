// On /explore the source panel is the largest paint, and React only asks for it once the app has
// loaded and run. On a throttled phone that waits on the JS, so start the download with the HTML:
// an inline script works out the panel from the URL (or the default deep link) and adds a
// <link rel=preload> with the <img>'s own srcset and sizes, so the browser fetches it once.
import { readFileSync } from "node:fs";
import type { Plugin } from "vite";
import { PANEL_SIZES } from "../src/data/srcset";
import { DEFAULT } from "../src/views/Explore/defaults";

type Data = { base: string; widths: number[]; own: Record<string, number>; cell: string; sizes: typeof PANEL_SIZES };

/** Runs in the page before any module. Keep it in step with srcset() (src/data/srcset.ts). */
export function preloadScript(d: Data) {
  return `(function (d) {
  if (!/^\\/explore\\/?$/.test(location.pathname)) return;
  var q = new URLSearchParams(location.search), explicit = q.has("cell") || q.has("arm");
  var cell = q.get("cell") || (explicit ? null : d.cell);
  var id = cell && cell.split("_")[0], own = id && d.own[id];
  if (!own) return;
  var path = d.base + "panels/" + id;
  var set = d.widths.filter(function (w) { return w < own; })
    .map(function (w) { return path + "-w" + w + ".webp " + w + "w"; }).concat(path + ".webp " + own + "w").join(", ");
  var l = document.createElement("link");
  l.rel = "preload"; l.setAttribute("as", "image"); l.setAttribute("fetchpriority", "high");
  l.setAttribute("imagesrcset", set);
  l.setAttribute("imagesizes", explicit && !q.has("vs") ? d.sizes.single : d.sizes.compare);
  document.head.appendChild(l);
})(${JSON.stringify(d)});`;
}

export function panelPreload(dataDir: string): Plugin {
  let base = "";
  return {
    name: "panel-preload",
    configResolved(c) { base = c.env.VITE_MEDIA_BASE || ""; },
    transformIndexHtml() {
      const index = JSON.parse(readFileSync(`${dataDir}/index.json`, "utf8"));
      const panels: { id: string; width: number; media: { webp: string } }[] = JSON.parse(readFileSync(`${dataDir}/panels.json`, "utf8"));
      for (const p of panels) if (p.media.webp !== `panels/${p.id}.webp`) throw new Error(`panel-preload: ${p.id} is not at panels/<id>.webp`);
      const d: Data = { base: base || index.media_base, widths: index.variants.panels,
        own: Object.fromEntries(panels.map((p) => [p.id, p.width])), cell: DEFAULT.cell, sizes: PANEL_SIZES };
      // end of <head>, after <meta name="viewport">: before it, a phone lays the page out 980 px wide,
      // and the preload would pick its copy for that width, not the one the <img> picks
      return [{ tag: "script", children: preloadScript(d), injectTo: "head" }];
    },
  };
}
