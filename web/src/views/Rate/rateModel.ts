import type { Reveal } from "blindpanel";

/** The explorer's public origin; the study's reveal links point here. */
export const SITE_ORIGIN = "https://stilldrawn.studionephele.com";
export const STUDY_URL = "/data/blindpanel/stilldrawn/study.json";

/** Links into this site become in-app paths, so they work on any preview origin and route without a reload. */
export function localiseReveal(r: Reveal): Reveal {
  const items = Object.fromEntries(Object.entries(r.items).map(([code, it]) => {
    const link = it.link?.startsWith(SITE_ORIGIN + "/") ? it.link.slice(SITE_ORIGIN.length) : it.link;
    return [code, link === it.link ? it : { ...it, link }];
  }));
  return { ...r, items };
}

/** Resolves a study endpoint ("reveal.json" or "/api/submit") against the study's own URL. */
export function studyRelative(studyUrl: string, p: string) {
  return /^(https?:)?\//.test(p) ? p : studyUrl.replace(/[^/]*$/, "") + p;
}
