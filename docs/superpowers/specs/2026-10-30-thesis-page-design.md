# The thesis page (`/about`): design and plan

30 Oct 2026, Phase 7. Approved by Aaron in the session: both narratives ship, A by default, static figures that link to the live views. Option 2 (the live scatter and Tax board embedded in the text) is recorded in the hub's `docs/phase7-publish-calls.md` for later.

## What it is

`/about`, in the top bar's fifth slot (reserved for About in Phase 5). The h1 is the thesis title, "Stability ranks stillness". Under it, a `Segmented` switch, "Read it", with two options: **Finding first** (default) and **Object first** (`?read=object`). Both tellings carry the same facts, figures and limits; only the order of the argument differs.

## Source of truth

- `THESIS.md` (repo root): telling A, the canonical ~800 words. It seeds P25's first essay. Its foot links to the other telling.
- `THESIS-object-first.md` (repo root): telling B.
- Both are plain Markdown that GitHub renders: headings, paragraphs, `**bold**`, `*em*`, links, images, captions (a paragraph that starts `*Figure`), and `- ` lists. Nothing else.
- Images live in `web/public/thesis/` and the Markdown names them by that path, so they render on GitHub. The page maps `web/public/` to `/`. Links to the explorer are absolute (`https://stilldrawn.studionephele.com/...`), so they work on GitHub; the page turns them into in-app links.

## Rendering

- `web/src/views/About/thesisMd.ts`: a pure parser from that Markdown subset to blocks (`h1`, `h2`, `p`, `ul`, `figure`) with inline runs (text, strong, em, link). Anything outside the subset throws, so a new construct can't render wrong silently.
- `web/vite/thesis.ts`: a Vite plugin that reads both files at build time and serves `virtual:thesis` (`{ finding, object }`, parsed blocks). It reads with `fs`, so the files can sit outside `web/`, and it watches them in dev.
- `web/src/views/About/About.tsx` renders blocks to React elements (no `innerHTML`). Each figure ships a light and a dark export; CSS shows the one that matches the theme (system, or the reader's pick).

## Figures

Exported from the app by a Playwright script (`web/e2e/thesis-figures.spec.ts`, its own config, never part of the normal run), at 2× device pixels, light and dark:
1. `scatter-{light,dark}.png`: the Motion vs drift chart panel, line drift, no engine selected.
2. `tax-{light,dark}.png`: the Stillness Tax board and chart at `?lens=price&p=2` (Gen-4.5 leading).

Each caption ends with a link to the same view at the same setting: `/scatter` and `/tax?lens=price&p=2`.

## Checks

- **Facts test** (`thesisFacts.test.ts`): every number in either file must be in an allowed list, each entry computed from the data contract (`paper.json`, `clips.json`, the series) or named with its source (the 24 reviewed clips, TAXONOMY.md). Both files must quote the same headline figures. A number that is in neither fails.
- **Parser tests:** the subset, and a throw on anything else.
- **e2e** (`about.spec.ts`): the nav link, A by default, the switch changes the text and the URL (`?read=object`) and back, a deep link opens B, keyboard (arrow keys move the radio), both figures load and their links open the right view, the light/dark figure swap, no horizontal scroll at 390, console clean, axe serious 0; 1440 and 390, light and dark.
- `NotFound` names About too.

## Plan

1. Parser and its tests (test first).
2. Facts test over the two files (test first; it fails until the files exist).
3. Write `THESIS.md` and `THESIS-object-first.md` from the plain-checked drafts (hub `docs/thesis-drafts/`), with the final figure paths and links.
4. Vite plugin and `virtual:thesis` typing.
5. About view, route, nav, NotFound line; `about.css` (reading measure 36em, as the findings use).
6. Figure export script; export; commit the PNGs.
7. e2e `about.spec.ts` (test first, against the route stub), then make it pass.
8. Full unit and e2e runs; inspect and impeccable detect on `/about`; then the commit.
