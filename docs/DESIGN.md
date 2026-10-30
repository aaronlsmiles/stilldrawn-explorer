# StillDrawn Explorer: design direction

Set 28 Oct 2026 with `design-taste-frontend` (app-screens run, style **achromatic-ledger**, seed 318980532, palette and type kept from the studio site concept) and `dataviz` (palette validation).

## The idea

**On this screen, the contact sheet's grease-pencil keeper circle becomes the selection.** The 33 × 5 posters are frames on a contact sheet; whatever the reader picks (a cell, an engine on the scatter, the leader under a lens, the playhead) is circled or filled in the one gold. Everything else is ink on paper, because the subject is ink on paper.

- **Face (achromatic-ledger, option 1):** the ground is the subject's own paper, not a kit grey. Ink for data, grey for context, gold for the selection. Square corners everywhere, like frames on a sheet.
- **Signature element:** the contact sheet itself, with each poster at frame 96 (four seconds in), so drift is visible across a row before anything is clicked. Second to it: the difference view, the clip minus its own first frame.

## Why the engines carry no colour

The plan asked `dataviz` for an engine palette. Validated on 28 Oct:
- The reference palette minus yellow (it sits on the gold) and violet (house rule): every 5-hue subset **fails** `--pairs all` in both modes. The best set (blue, aqua, magenta, green, red on `#ecece8`) has a normal-vision ΔE of 13.2 (red↔magenta; the hard floor is 15) and a deutan ΔE of 6.1.
- A random search of 60,000 custom OKLCH sets (gold's hue ±28° and violet excluded, L and C across the validator's bands) found **no** passing set. The skill's palette notes say the same: past three slots, all-pairs separation cannot hold.
- The scatter and the Pareto chart are all-pairs forms. So **engines are identified by name, never by colour**: direct labels on every engine mark, engine names on every row and column, and a table view everywhere. That is also the style's move (colour on the main data element only).

## Tokens

| Role | Light | Dark | Notes |
|---|---|---|---|
| `--ground` | `#e2e2de` paper | `#1c1915` ink | page and shell |
| `--surface` | `#ecebe7` | `#23201c` | panels, one tone step off the ground |
| `--raised` | `#d3d3ce` | `#2c2924` | wells, hover, the empty frame |
| `--border` | `#cfcec7` | `#37332d` | panel edges |
| `--rule` | `#dcdbd5` | `#2e2a25` | row rules |
| `--control` | `#8a857c` | `#6e675d` | control borders (3.1:1 light) |
| `--text` | `#1c1915` | `#ecebe6` | 14.7:1 / 13.1:1 on surface |
| `--muted` | `#574e44` | `#b3aa9e` | 6.8:1 / 6.8:1 |
| `--faint` | `#6b6359` | `#9c9488` | meta, axis ticks; 4.95:1 / 5.2:1 |
| `--context` | `#8a857c` | `#7d766b` | unselected data marks (scatter points, other series) |
| `--gold` | `#c4922a` | `#d6a43c` | fills under ink text only in light (ink on gold 6.25:1) |
| `--gold-line` | `#9a6a12` | `#d6a43c` | strokes, rings, playhead, selected points, focus ring (4.0:1 / 6.9:1) |
| `--on-gold` | `#1c1915` | `#1c1915` | text on a gold fill |
| `--neg-bg` / `--neg-ink` | `#f1dcd6` / `#7d1f1a` | `#3a1f1b` / `#f0a69b` | the `departed` pill only |

Gold is never text on paper (2.2:1). In light mode, a gold mark that must be seen on its own uses `--gold-line`.

- **Type:** Geist 400/600/800, with Geist Mono 400 for hashes and terminal text (Aaron's house faces from 29 Oct 2026, replacing Schibsted Grotesk; both OFL and self-hosted, `tools/font/build_font.py`). Scale 12 / 14 / 16 / 24 (wordmark 16/800, h1 24/600, card titles 16/600, body and cells 14/400, meta and ticks 12). Tabular figures on every number (`font-variant-numeric: tabular-nums`; checked in the browser on the first build). No figure over 32 px.
- **Radius:** 0 on panels, media and controls (square, decided once).
- **Space:** 4 px base; one gutter of 16 px between blocks; panel padding 16; page margin 24 at 1440 and 16 at 390; control height 32 (44 touch targets on phones).
- **Motion:** feedback only, no entrances. `--ease: cubic-bezier(.2,.7,.2,1)`; 160 ms for press and hover, 240 ms for the leaderboard reorder. `prefers-reduced-motion` makes every change instant.
- **Focus:** 3 px `--gold-line` outline, 2 px offset.

## Shell

**No sidebar** (redrawn from the sheet's open plane: the product has three destinations now and five at most, and the contact sheet and player need the width; app-screens §3.1 names this shell for "viewers and products with few destinations"). A 48 px top bar on the ground: the mark and wordmark "StillDrawn Explorer" on the left; Explore · Motion vs drift · Stillness Tax as plain links, the current one in ink with a 2 px ink underline, the others in `--muted`; on the right the dataset DOI link and a theme toggle. On phones the links fold into a menu sheet.

The mark: a 16 px square frame with a gold grease-pencil loop around it, drawn in SVG.

## Screens

### Explore: "What does this engine do to this panel, frame by frame?"
- **1440:** list-detail. Left pane (about 37%): the contact sheet, a row label column (panel thumbnail and motion class) and five poster columns under sticky engine names. Right pane (the rest, sticky): the breadcrumb h1 (`act-tone-2 · camera push · Gen-4.5`), source | clip at equal width, the player toolbar, the drift curve (about 200 px), then readouts and provenance side by side. Compare puts A and B side by side under the source.
- **Default:** `act-tone-2` camera push, Gen-4.5 against Wan 2.2: the screen opens on the finding.
- **Finding line** under the h1: the clip's line drift and its rank among the engine's 33 cells, for example "Line drift 4.79 px, 17th steadiest of Gen-4.5's 33".
- **390:** one region at a time. The detail first when a cell is in the URL, with "All cells" back to the panel list; the list is a row per cell, and engine tabs under the open row.

### Motion vs drift: "Do the engines that move more drift more?"
- **Finding line:** the engine-level ρ and its exact p from `paper.json`.
- **1440:** the scatter at about two-thirds width (log motion on x, the chosen headline on y). All points in `--context`; the five engine medians as ink crosses (IQR whiskers), each labelled with the engine's name. To the right, the engine table (n, median motion, median drift, within-engine ρ from the paper): choosing a row puts that engine's points and cross in gold. One control row above: the y metric (segmented), the arms (checkboxes), "Show as table".
- **390:** the chart full width at about 320 px tall, the table under it.

### Stillness Tax: "Who leads once motion is priced?"
- **Title row:** h1 "Stillness Tax", then a grey chip "Exploratory (pre-registration amendment A6)" from `paper.status_motion`.
- **Finding line:** the current leader and the range over which it leads, computed.
- **Control row:** the lens (segmented: Price of motion, the default · Matched-motion band) and that lens's controls, with its one-sentence explanation above them. The motion floor was cut at G4 (28 Oct).
- **1440:** the leaderboard (about 520 px) beside the Pareto chart. The leader's rank cell is a gold fill with an ink numeral. Under the price lens the chart draws the iso-score line in `--gold-line`.
- The three-lens `?view=compare` layout served gate G4 and is archived (tag `g4-three-lenses`); old links land on the default lens.

## Checks this direction must pass
- `inspect.mjs --app` 0 FAIL at 1440, 768, 390; colour share under 3%.
- Contrast of every text token at 4.5:1 or more on the surface it sits on; non-text marks at 3:1.
- Engines readable with colour removed (they are: names everywhere).
