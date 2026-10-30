// The model that made a source panel, in the wording of the release's NOTICE-PROVIDERS.md.
// Clips credit their engine everywhere; panels are generated too, so Provenance names theirs.
import type { Panel } from "./types";

const SOURCES: Record<string, string> = {
  hosted: "Google Gemini 2.5 Flash Image, via the Runway API",
  local: "Illustrious-XL v0.1, run locally",
  "private-production-chain": "The author's private production chain",
};

export function panelSource(panel: Panel, byId: (id: string) => Panel | undefined): string {
  if (panel.source_engine === "derived") {
    const parent = panel.derived_from ? byId(panel.derived_from) : undefined;
    if (!parent) throw new Error(`panel ${panel.id} is derived from an unknown panel`);
    return `A variant of ${parent.id} (${panelSource(parent, byId)})`;
  }
  const s = SOURCES[panel.source_engine];
  if (!s) throw new Error(`panel ${panel.id}: unknown source ${panel.source_engine}`);
  return s;
}
