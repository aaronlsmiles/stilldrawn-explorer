# StillDrawn Explorer — status

Card: P01, with P10 (blindpanel) folded in on 28 Oct · Started: 2026-10-28 · Public slug: `stilldrawn-explorer` (cleared 2026-10-28)

## Criteria (frozen 2026-10-28)

- **Success:**
  1. All 373 clips play from `media.studionephele.com` beside their source, with synced drift and motion curves. *(Media uploaded and verified 28 Oct; 29 Oct: all 170 primary clips (164 + 6 FLINT) play from the media host with their curves, e2e `allclips.spec`.)*
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
| 5 | 2026-10-28 | Preview deploy, after Aaron refreshed the token (scoped to the Nephele team only) | Deployed. **Incident:** the first deploy of the new project went to production and Vercel aliased it to the public `stilldrawn-explorer.vercel.app` (200, noindex) for about a minute; the alias was removed (now 404) and the script now forces `--target=preview`. The preview redeploy is behind Vercel login (302). No custom domain, nothing indexed | yes | 0 |
| 4 | 2026-10-28 | G4 applied: two lenses (price default, band alternate); floor and compare layout archived, old links fall back to price | 49 unit, 120 e2e green; inspector 0 FAIL on both lenses | yes | 0 |
| 6 | 2026-10-28 | Pipeline task 7, upload half: all media to R2 (`stilldrawn-media/stilldrawn/v1.0.0/`) | 1,187 objects (373 clips byte-exact, posters, frame-0 PNGs, 34 panels ×2) plus robots.txt; clips hash-checked against CLIP-HASHES before sending; re-run skips all 1,187 (size and sha256 match); public host: 6 sampled clips give 206 on a range request and match the release byte for byte, immutable cache headers; GPTBot gets 403. Preview now streams every clip from `media.studionephele.com` (2.6 MB deploy, behind Vercel login) | yes | 0 |
| 7 | 2026-10-29 | Phase 4 (sub-plan D, `docs/superpowers/plans/2026-10-29-integration.md`): blindpanel vendored as a tarball with a lock; `/rate` (React wrapper, `--bp-*` mapped to the explorer's tokens, reveal links routed into Explore); `api/submit`, `tally`, `keepwarm` over the kit's Supabase store; schema applied live; preview env vars; deployed preview | 61 unit, 144 local e2e, 8 live e2e (1440/390 × light/dark, keyboard, clean console, no overflow, button contrast ≥ 4.5); live DB check 27/27; one UI opt-in = exactly one row; tally at n ≥ 5 seen live; `blindpanel report --store supabase` read it; 6 test rows deleted, 0 remain. Fixed on the way: kit buttons unreadable under the explorer's reset (reset now layered below the kit); results 425 px wide at 390 (kit fix); stale crowd count after opting in | yes | 0 |
| 8 | 2026-10-29 | Phase 5 (design pass and verification): design-taste-frontend direction check; impeccable critique (two isolated agents), audit, layout, typeset, polish; improve-animations (3 plans, done); break-ui; kit fixes and re-vendor (`fd67336`) | The spaced decimals were the font: Schibsted Grotesk's tnum widens `. , : % ×`, now self-hosted with a digits-only tnum. /rate sits in the page (edge, type scale, two-column intro). A failed load refetched in a loop (1,779 requests in 3 s), now fixed. Local: 62 unit, 348 e2e; production build streaming from R2: 376 e2e, all 170 primary clips; axe serious 0; inspect 0 FAIL; detector 0. Preview: 8 live runs, no opt-in, 0 rows. Lighthouse mobile LCP 2.2–2.3 s on four views; Explore 5.2 s (the 423 KB source panel; desktop 1.3 s) | yes | 0 |
| 9 | 2026-10-29 | Aaron's answers: `/review-animations` and its fixes; display widths for panels (320/640/960) and posters (320) on R2 with `srcset` everywhere; `/explore`'s panel preloaded from the HTML; `tools/lighthouse-preview.mjs` | Review verdict Block, fixed: keyed and tapped state changes no longer fade (the D toggle, switches, the kit's 1–5 keys), kit hovers gated, a FLIP row that could jump. 475 objects uploaded (1,187 skipped by hash). A preload placed before the viewport tag picked a different copy than the `<img>` on a real phone viewport (two fetches), caught by Lighthouse and fixed with a test on its phone. Lighthouse, three cold runs: Explore mobile 5.2 → **3.6 s** (one 199 KB fetch; 2.9 s even at 87 KB, measured), four other views 2.3 s, desktop 0.6–0.9 s. Local: 69 unit, 370 e2e; R2 build 398 e2e, all 170 primary clips; inspect 0 FAIL; live 8/8, 0 rows | yes | 0 |

## Spend: £0 of £20 · £ per keeper: n/a

## Links: demo — · film — · thesis — · repo — (local only)

## Next

- Phase 5 done 29 Oct (rounds 8 and 9). Before/after screenshots and the final numbers: a private page linked from the hub's session log. Judgment calls: `~/projects/studio/docs/phase5-design-calls.md`.
- **Open for Aaron:** Explore misses LCP 2.5 s on Lighthouse's simulated phone at 3.6 s (was 5.2; 0.5 s observed; desktop 0.9 s). The last second is the panel itself, about 6–7 ms per KB on Slow 4G: under 2.5 s needs a panel of about 30 KB (visibly blurred screentone) or a pre-rendered Explore page. Accept the miss, or try the pre-render as a spike.
- Defended inspector warnings: Explore's 12 px text is the contact sheet's sublines (98 draw counts, 33 motion classes under 14 px names); the scatter has no hue until an engine is chosen (gold is the reader's selection; engines carry no colour, docs/DESIGN.md).
- Phase 6 (films) next, then writing, clearance and G5. Production at `stilldrawn.studionephele.com` waits for G5: the three env vars for production, the custom domain and the cron.
