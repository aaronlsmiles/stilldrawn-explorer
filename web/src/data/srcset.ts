// Display widths for responsive images. The contract (index.json "variants") declares them:
// "{stem}-w{w}.webp, for each w below the item's own width"; the full display copy tops the set.
// vite/panel-preload.ts rebuilds the source panel's set in an inline script; its test holds the two together.
import type { Index } from "./types";

export type Variants = Index["variants"];

export const variant = (path: string, w: number) => path.replace(/\.(\w+)$/, `-w${w}.$1`);

export function srcset(url: (p: string) => string, path: string, own: number, widths: number[]) {
  return [...widths.filter((w) => w < own).map((w) => `${url(variant(path, w))} ${w}w`), `${url(path)} ${own}w`].join(", ");
}

/** The source panel's slot (explore.css): beside the clip, two up under 761 px, stacked to 1100,
 *  list-detail above; in compare it is one of three, or alone across the top on phones. */
export const PANEL_SIZES = {
  single: "(max-width: 760px) calc(50vw - 24px), (max-width: 1100px) 47vw, 30vw",
  compare: "(max-width: 640px) calc(100vw - 32px), (max-width: 760px) calc(100vw - 48px), (max-width: 1100px) 31vw, 19vw",
};
