# Phase 6 films: design (P01 + P10)

Approved by Aaron on 29 Oct 2026 (the beat sheets as drafted; silence; a separate phone capture for 9:16; the P10 terminal starts at `npm run setup`). Master plan: "Phase 6: films".

## Outputs

| File (under `film/out/`, gitignored) | What |
|---|---|
| `p01-16x9.mp4`, `p01-9x16.mp4` | StillDrawn Explorer, about 80 s |
| `p10-16x9.mp4`, `p10-9x16.mp4` | blindpanel, 45 s |
| `<film>.srt` | captions sidecar (the same text is burned in) |
| `<film>-poster.jpg` | 1280×720 poster |
| `<film>-loop.mp4` | 6–10 s silent loop for a portfolio card |
| `contact-<film>-<aspect>.jpg` | one frame per beat, for review |

- H.264 High, yuv420p, 30 fps CFR, CRF 18, `+faststart`. 1920×1080 and 1080×1920.
- **No audio stream** (Aaron, 29 Oct: silence now; he may add music he makes and owns later). The clips' own AAC never enters the cut: capture is screenshots.
- Uploaded to R2 under `films/` only after Aaron has watched the cuts and said yes.

## Look

- Paper (light theme) throughout, the explorer's tokens: ground `#e2e2de`, surface `#ecebe7`, ink `#1c1915`, muted `#574e44`, one gold (`#c4922a` fill, `#9a6a12` line). Square corners.
- Schibsted Grotesk from the explorer's own self-hosted file (`web/public/fonts/`), for captions, titles and cards alike. One family, as in the app.
- Captions: a band at the bottom of the frame, ink on surface, 34 px (16:9) or 44 px (9:16), at most two lines. In 9:16 the band sits below the app's frame, so it covers no UI.
- Model credit: a chip in the top-right corner of the frame ("Clips: Runway Gen-4.5 · Wan 2.2") whenever a generated clip is on screen. Gate G0 asks for Runway; every engine is credited the same way.

## Capture

- **Target:** the production build that streams from R2 (`VITE_MEDIA_BASE= npm run build`, `npx vite preview --port 5320`). It has the same pixels as the preview and holds no secret.
- **Method:** a Playwright spec in `web/e2e/film.spec.ts` (own config, like `shots`). A recorder takes JPEG q95 screenshots in a loop at device pixels and stores each frame's wall-clock time.
  - The probe (29 Oct) ruled out Playwright's built-in video, whose VP9 smears the screentone. It also ruled out the CDP screencast, which ignores the device scale factor in headless mode.
  - The loop runs at about 28 fps. The edit resamples it to 30 fps CFR from the recorded times, so the pace is real.
- **Frames:**
  - 16:9: a 1440×810 viewport at scale 4/3, giving 1920×1080. That is the 1440 layout Phase 5 verified.
  - 9:16: a 390×563 viewport at scale 1080/390, with touch and `isMobile`, giving 1080×1559. That is the 390 layout. The caption band fills the rest of the 1920 height.
- **Pointer:** the spec injects its own cursor arrow (desktop) and tap ring (phone), driven by the real pointer events. The app's code is unchanged.
- **Safety:** every `/api/*` request is routed by the spec. `tally` gets an empty mock, as in `shots.spec`. `submit` is aborted and fails the test, so a capture can never opt in. The vite preview has no API anyway.
- **Events:** the recorder also logs timed marks (`events.json`: which clip or cell is on screen, when a drag starts and ends), so chips and captions sit on what was actually shown.
- **Segments:** one recording per beat, `film/capture/<film>/<aspect>/<beat>/` (gitignored). Re-running the spec after a UI change remakes the cut.

## P01, about 80 s

| Beat | s | Capture | Caption |
|---|---|---|---|
| 1 Hook | 0–6 | `/explore` default: act-tone-2 camera push, Gen-4.5 and Wan 2.2 looping | "Same panel, same camera push. Wan 2.2 drifts {wan} px from its first frame; Gen-4.5 drifts {g45} px." → "Wan 2.2 barely moved: {wan_flow} px of median flow against {g45_flow}." |
| 2 Question | 6–13 | Title card | "Is the stability score measuring stability, or stillness?" |
| 3 Interaction | 13–50 | Click a cell on the contact sheet; the clip plays with its curve; drag along the curve (the clip seeks); press D for the difference view; then `/scatter` | What line drift measures; what the difference view shows; "Across the {n_engines} engines, more motion goes with more drift: ρ {rho}, exact p {p}." |
| 4 Turn | 50–68 | `/tax` at price 0; drag the slider through the crossovers | "At price 0, the paper's order: Wan 2.2 leads." → "LTX-2.3 leads only from {x1} to {x2} px; from {x2} px per doubling of motion, Gen-4.5 leads." The A6 chip stays in frame. |
| 5 Suggests | 68–80 | Card, then end card | "Price the motion in, and the ranking becomes a choice you can see: a case for motion-priced evaluation of world models." End card: "StillDrawn Explorer", `stilldrawn.studionephele.com` (text only until G5), the credited models, "Data CC BY 4.0, Aaron Smiles 2026", the DOI. |

## P10, 45 s

| Beat | s | Capture | Caption |
|---|---|---|---|
| 1 Hook | 0–4 | `/rate`, a clip screen mid-session | "{n_raters} raters scored {n_clips} generated clips, blind to the model. Your turn." |
| 2 Session | 4–24 | The stills and eight clips, sped up (a "×N" badge on screen), answered by a scripted visitor | "Rate each clip against its still: register, then sameness." |
| 3 Where you land | 24–34 | "See where you land" and the results | "Your agreement with the panel, beside each rater's. The panel's own: α {a_reg} (register), {a_same} (sameness)." → "Nothing is sent unless you opt in." |
| 4 Setup | 34–43 | A terminal page replaying a real `npm run setup` from a fresh clone, sped up, ending when the server prints its address | "One study file, one command: the page, the checks, a server." |
| 5 End | 43–45 | End card | "blindpanel · MIT", "github.com/aaronlsmiles/blindpanel" (text only until G5), "Demo: stilldrawn.studionephele.com/rate" |

- **The scripted visitor:** each clip gets the panel's rounded mean plus a fixed offset from a seeded sequence, clamped to 1–5. Its results look like a person's rather than a perfect rater's. The caption says "a scripted run".
- **The P10 film shows Runway clips, so each one is credited while on screen** (G0; the brief's rule beats the page's blinding, which is for raters, not film viewers). The chip reads "Clip: Runway Gen-4.5 · hidden from raters on the page". The capture logs which clip is on screen and when (`events.json`, mapped to engines through `reveal.json` on the test side, as `rateFlow.ts` does), and the chips follow that log. The end card lists every model.

## Numbers

`film/build/facts.py` reads the data contract (`paper.json`, `clips.json`, `engines.json`, the blindpanel study) and writes `facts.json`. Captions are templates filled from it, and a test fails if a caption carries a digit that isn't in `facts.json`. No figure is typed by hand.

## Edit

`film/build/edit.py` (Python standard library plus ffmpeg) works in four steps:
1. Turns each segment's frames and times into a 30 fps clip.
2. Trims or speeds it as `film/build/films.json` says (the edit decision list).
3. Overlays the caption, chip and card PNGs rendered by `film/build/render-overlays.mjs` (Playwright, the explorer's font). Then it concatenates the segments.
4. Exports both aspects, the SRT, poster, loop and contact sheets, and prints duration, resolution and audio (none) from `ffprobe`.

## Verification

- `facts` tests: every figure matches the contract, and a caption with an unknown digit fails.
- The spec fails if `/api/submit` is ever requested.
- `ffprobe` of each output: duration within the target ±2 s (P01 60–90, P10 43–47), the right resolution, 30 fps, no audio stream.
- The contact sheets are looked at, frame by frame, before Aaron sees them.
- `tools/scan-identifiers.sh` over the tracked files before every commit.

## Out of scope

Music, voice-over, R2 upload (after Aaron's yes), the thesis, clearance and publishing (Phase 7).
