# StillDrawn Explorer — status

Card: P01, with P10 (blindpanel) folded in on 28 Oct · Started: 2026-10-28 · Public slug: `stilldrawn-explorer` (cleared 2026-10-28)

## Criteria (frozen 2026-10-28)

- **Success:**
  1. All 373 clips play from `media.studionephele.com` beside their source, with synced drift and motion curves.
  2. Each Stillness Tax lens reproduces the paper at its reference setting and reorders the leaderboard live:
     - price 0 gives the paper's ranking
     - the band presets give 5 usable pairs and 2 reversals
     - the Pareto front is {Gen-4.5, Gen-4 Turbo, LTX-2.3, Wan 2.2}
  3. "Rate it yourself" runs end to end, its results match the test fixtures, and opt-in submission stores nothing personal.
  4. Works at 1440 and 390 px, in light and dark, by keyboard, with a clean console and an LCP under 2.5 s.
  5. A 60–90 s film and the ~800-word thesis "Stability ranks stillness", published and linked from the portfolio.
- **Kill rules:**
  - A lens that can't be explained in one on-screen sentence after the comparison (G4) is cut.
  - If studionephele.com isn't live on Cloudflare by day 3, serve media from the bucket's `r2.dev` URL for now (never shared) and keep going.
- **Budget:** 7 focused days for P01 (12 with P10), £20 cap.

## Gates

| Gate | What | Status |
|---|---|---|
| G0 | Runway terms §5(viii) vs showing the CC BY Runway clips | **Confirmed 2026-10-28** (plan approval). The release's `docs/TOS-REVIEW.md` rules Runway "include (caveats)"; evaluation publication isn't addressed by the terms, so it is permitted by default. The explorer only displays and rates outputs already released under CC BY with the no-training notice, and it adds AI-bot blocking. Still open: the Supplemental Terms shown at the Runway developer-portal click-through. |
| G1 | Name clearance | **Passed 2026-10-28** (see Clearance) |
| G2 | studionephele.com on Cloudflare; R2 bucket and token | **Done 2026-10-28 (Aaron):** zone active, bucket `stilldrawn-media` with `media.studionephele.com` connected, AI training crawlers blocked, R2 key in 1Password (Personal – Dev) |
| G3 | Supabase project in the Nephele org | **Done 2026-10-28 (Aaron):** project `stilldrawn-explorer` (London) in the Nephele org; DB password in 1Password (Personal – Dev) |
| G4 | Lens choice | **Decided 2026-10-28 (Aaron):** price of motion is the default; the matched-motion band stays as the alternate because it ties back to the paper's reversals. The motion floor and the three-lens compare layout are removed and archived (tag `g4-three-lenses`; snapshot under the archive root's mirror of this repo) |
| G5 | Go-live: clearance, pushes, portfolio | Day 12 |

## Clearance

2026-10-28 name sweep for "StillDrawn Explorer" / `stilldrawn-explorer`:
- GitHub: only Aaron's own StillDrawn repos
- PyPI 404, npm 404; Hugging Face models, datasets and spaces: none
- arXiv: 0 results for "stilldrawn"; web: no product or page of that name
- The base name StillDrawn was cleared on 2026-09-30.
- Alternates, also clear: `stilldrawn-viewer`, `stilldrawn-lab`.

## Rounds

| # | Date | What was tried | Result | Kept? | £ |
|---|---|---|---|---|---|
| 0 | 2026-10-28 | Planning session (brainstorming, then the master plan) | Approved | yes | 0 |
| 1 | 2026-10-28 | Pipeline sub-plan A, tasks 1–6: loader, headlines, lenses, series, human check, export | 39 tests pass; reproduces the motion-confound outputs, α and the headline table exactly | yes | 0 |
| 2 | 2026-10-28 | Sub-plan B (explorer views): contract additions (zip names, within-engine ρ, full-precision `basis.json`), media derivation (780 files; clips symlinked), design direction, Vite app, Explore, scatter, Stillness Tax with all three lenses and the G4 compare layout | Pipeline 47 tests; web 49 unit tests (lens parity: ranks exact, values 1e-9) and 124 e2e runs at 1440/390 × light/dark, console clean; `inspect.mjs --app` 0 FAIL on every view; frame-0 difference test passes (BT.709) | yes | 0 |
| 3 | 2026-10-28 | Preview deploy to the personal Hobby team | **Blocked:** the stored token is refused for the team ("re-authenticate to this scope"); nothing deployed. Preview staged (81 MB) and verified locally | — | 0 |
| 4 | 2026-10-28 | G4 applied: two lenses (price default, band alternate); floor and compare layout archived, old links fall back to price | 49 unit, 120 e2e green; inspector 0 FAIL on both lenses | yes | 0 |

## Spend: £0 of £20 · £ per keeper: n/a

## Links: demo — · film — · thesis — · repo — (local only)

## Next

- **Aaron:** refresh the Vercel token for the personal team (create a token scoped to that team, store it over the same 1Password item with `~/.claude/scripts/op-new.sh`), then `tools/deploy-preview.sh`.
- Phase 1, task 7 upload half: unblocked by G2.
- Phase 3: blindpanel (sub-plan C), reconciling the kit design pass first.
- Defended inspector warnings to revisit in Phase 5: Explore readouts beside provenance end apart at 1440 (provenance is a disclosure); Tax board and chart heights differ by lens; the scatter carries no hue until an engine is chosen (engines are named, never coloured; see docs/DESIGN.md).
