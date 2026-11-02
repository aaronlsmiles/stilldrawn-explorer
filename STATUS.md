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

## Plain words (added 30 Oct; criteria frozen 2026-10-30, before any copy)

An additive "In plain words" layer tells the explorer's story to a bright 10–12-year-old or a non-technical older reader (the hub's `docs/plain-words.md`). Aaron's choices: one voice for both readers, his own voice with no mascot, blue pencil, an invite on every page that turns the layer on, and a numbered chapter band per page with pinned notes and "Next →".

- **Success:**
  1. **Additive:** no existing copy, `THESIS*.md` or data file changes (checked in the diff). With the layer off, every existing unit and e2e suite passes unchanged.
  2. **Followable:** chapters 1–5 (Explore → Motion vs drift → Stillness Tax → Rate it yourself → About) each have a band, and "Next" walks the whole trail at 1440 and 390 px.
  3. **Readable:** Flesch–Kincaid grade ≤ 6 across the layer; average sentence ≤ 14 words, none over 25; jargon only inside quotes.
  4. **Honest:** every digit in the layer comes from the data contract; a rounded figure says "about".
  5. **Blind:** `/rate` with the layer on passes the leak scan.
  6. **Accessible:** axe WCAG 2.2 AA with the layer on, 1440 and 390 px, light and dark; no overflow at 200% text zoom.
  7. **The real-reader test:** a non-technical reader follows the trail unaided, then says in their own words what the project found and why it matters. Logged in `LOG.md`; the copy is revised before production.
- **Changed after the freeze (Aaron, 2 Nov):** criterion 7 runs on the live site, after go-live, with his proofread; both are on his soft to-do list (Obsidian, `Studio/Soft to-dos.md`). The layer ships with criteria 1–6 met, and the copy is revised after the reader, in a later deploy.
- **Kill rule:** a note the real reader skips or misreads twice is rewritten or cut, never left in.
- **Budget:** 1 focused day, £0.

## Gates

| Gate | What | Status |
|---|---|---|
| G0 | Runway terms §5(viii) vs showing the CC BY Runway clips | **Confirmed 2026-10-28** (plan approval). The release's `docs/TOS-REVIEW.md` rules Runway "include (caveats)"; evaluation publication isn't addressed by the terms, so it is permitted by default. The explorer only displays and rates outputs already released under CC BY with the no-training notice, and it adds AI-bot blocking. **Closed 2026-10-30 (Aaron), with a caveat:** checked in the signed-in developer portal, whose only legal links are the Terms of Use (23 Oct 2026), the Privacy Policy and the Code of Conduct (→ the Usage Policy, 6 Mar 2026: content rules only, nothing on training, datasets or evaluation); no API agreement anywhere in the account. The sign-up screen itself can't be recovered. The release's `TOS-REVIEW.md` open item closes in its next build (generated tree; source in the private repo). |
| G1 | Name clearance | **Passed 2026-10-28** (see Clearance) |
| G2 | studionephele.com on Cloudflare; R2 bucket and token | **Done 2026-10-28 (Aaron):** zone active, bucket `stilldrawn-media` with `media.studionephele.com` connected, AI training crawlers blocked, R2 key in 1Password (Personal – Dev) |
| G3 | Supabase project in the Nephele org | **Done 2026-10-28 (Aaron):** project `stilldrawn-explorer` (London) in the Nephele org; DB password in 1Password (Personal – Dev) |
| G4 | Lens choice | **Decided 2026-10-28 (Aaron):** price of motion is the default; the matched-motion band stays as the alternate because it ties back to the paper's reversals. The motion floor and the three-lens compare layout are removed and archived (tag `g4-three-lenses`; snapshot under the archive root's mirror of this repo) |
| G5 | Go-live: clearance, pushes, portfolio | **Passed 2026-10-30**, each step on Aaron's word: both repos public; blindpanel v0.1.0 tagged and released; production at `stilldrawn.studionephele.com` (TLS, cron, env vars); the old site links the case study |

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
| 10 | 2026-10-29 | Phase 6, the films (spec `docs/superpowers/specs/2026-10-29-films-design.md`, plan `docs/superpowers/plans/2026-10-29-films.md`): scripted capture of the production build (`web/e2e/film.spec.ts`, slowed 4× desktop / 2× phone), facts-checked captions, overlays in the explorer's face, ffmpeg edit (`film/build/edit.py`). Aaron: silence, a separate phone capture for 9:16, the terminal starts at `npm run setup`, beat sheets as drafted | P01 67.6 s (16:9) and 73.3 s (9:16); P10 43.1 s and 44.4 s; all 30 fps, no audio, captioned, every clip on screen credited with its model. Found by the film and fixed test first: `/rate`'s lede said "eight stills" (the session filmed had 6). 71 unit, 378 e2e local; R2 build 406 (a first run had 7 transient image-load failures, all passed on the rerun). Awaiting Aaron's review; nothing uploaded | yes | 0 |
| 11 | 2026-10-29 | Aaron's notes on the first cut: captions blended into the page; P10's first 20 s jarring; Avenir (or better) as house face; narration in place of music, from an AI voice that isn't overused. He chose **Geist + Geist Mono** and **Hume Octave via MCP** | Ink caption band; P10 session at real speed (one still, two clips, Done) with ready/leave marks so loading never shows; explorer in Geist (self-hosted, reproducible build; Geist Mono for the hash; a chart title moved 2 px; type spec failed first); captions rewritten as narration (`say`, `show`), transcript generated (`film/narration.md`); `voice.py` for Hume reads (refuses to spend without `--yes`); edit places lines in order, lets the picture run on into spare footage (every capture now keeps 3–4 s), sets -14 LUFS by gain plus an oversampled limiter and measures each file; credits recomputed at every cut (a credit had carried onto "Done"). Silent cuts: P01 71.3/76.8 s, P10 46.1/43.0 s. Placeholder-voice test (macOS `say`, never shipped): P01 79/81 s, P10 47/45 s, -14.1 to -14.2 LUFS, peaks -2.0 to -2.4 dBTP. 71 unit, 382 e2e local. R2 build: 409 of 410 on one worker; the one failure, and 19–53 failures with parallel workers, are all a 5 s wait for one of `/rate`'s original PNG stills (1.2–3 MB) on a link measured at 1.0–1.4 MB/s (WebP copies offered, not made) | yes | 0 |
| 12 | 2026-10-30 | Narration with Hume Octave. Aaron found the first voices too formal and soft and asked for a female option, so the studio identity (in the hub's docs: sharp, hands-on, candid, ink and machine) drove a new brief: 2 female and 2 male candidates. **Aaron picked m-london**, saved in his Hume library as the studio narrator; every line read with that audition as context | P01 81.7 s (16:9) and 83.7 s (9:16); P10 46.8 s and 44.6 s; −14.2 to −14.3 LUFS, true peak −1.8 to −2.4 dBTP; speech within 0.05 s of each subtitle (median). Two P10 lines shortened to fit the card (the subtitle keeps the detail). Hume's per-minute request quota hit once; voice.py now backs off on 429. Hume characters: ~2,200 (designs 294 + 392, lines 1,439 + 71), free tier, £0 | yes | 0 |
| 13 | 2026-10-30 | Aaron's yes: films to R2; the voice's refinement moved to its own card (F6); studio name cleared; baseline v1 recorded (hub `docs/sn-voice-baseline-v1.md`, paid reads archived) | 16 objects under `media.studionephele.com/films/v1/{stilldrawn-explorer,blindpanel}/` (both cuts, SRT + WebVTT, poster, loop): 200 through the public host, sha256 = local, ranged requests 206, immutable cache. `voice.py` now pins Octave versions (design 1; reads from `voice.version`). **Phase 6 closed** | yes | 0 |
| 14 | 2026-10-30 | Phase 7 before G5: WebP stills for `/rate` (kit `29dac01`, re-vendored); Runway touchpoints checked; clearance (repos, histories, build, films); the thesis in two tellings on `/about` (`c1ebe00`); Provenance names each panel's model; Open Graph; the production recipe; a preview deploy | `/rate` stills 6.2× smaller (q92 WebP, 43–51 dB PSNR); every `/rate` test passes on the R2 build with parallel workers. Clearance: 0 scanner hits anywhere, no secrets in history. Thesis: A 799 words, B 743, plain-checked, every number held to the contract by a facts test. Caught by tests: a model name in the preview-image alt (the head ships on `/rate`); the figure export overwriting phone figures inside the full run. 99 unit, 434 e2e local; preview: `/about`, figures, `og.png`, tally 200, noindex | yes | 0 |
| 15 | 2026-10-30 | G5, go-live (each step on Aaron's word): repos `aaronlsmiles/stilldrawn-explorer` and `aaronlsmiles/blindpanel` public; blindpanel v0.1.0 tagged and released, vendored from the release (lock sha = release SHA256SUMS); production env vars, domain (A record in Cloudflare), `G5_GO_LIVE=yes tools/deploy-production.sh`; the old site's Projects note links the explorer, thesis, films and blindpanel | Live: 200 with Let's Encrypt TLS, no `x-robots-tag`; a ranged clip GET 206, sha256 = CLIP-HASHES; `/api/tally` 200, edge-cached (HIT); daily keep-warm cron registered; Lighthouse cold, median of 3: phone 1.7 s on four views, Explore 3.2 s; desktop 0.4–0.8 s. Against production: 160 page e2e and 8 live `/rate` runs (no opt-in, 0 rows) | yes | 0 |
| 16 | 2026-10-30 | Plain words (criteria above): `src/plainwords/` (words, state, band and notes, CSS), blue-pencil tokens, the top-bar switch, notes in six views, a story map on wide screens; `words.test.ts` (facts shared with the thesis test via `src/test/facts.ts`, jargon in quotes, reading level, blinding, placement); `e2e/plain.spec.ts`; design and a11y specs run again with the layer on; film and figure captures keep it off | Criteria 1–6 met locally. 108 unit; 568 e2e (56 skipped, 0 failed) on the dev server; 134 plain-words, design and a11y runs on the production build streaming from R2. Flesch–Kincaid grade 2.6, 0 jargon outside quotes, /rate leak scan clean with the layer on, reflow clean at 320 px. Criterion 7 (the real-reader test) is open. Nothing deployed | pending the reader | 0 |

## Spend: £0 of the £20 cap, inside budget · £ per keeper: n/a

Nothing was paid for. Every service ran on a free tier: Cloudflare R2 (media, well under the 10 GB free storage), Vercel Hobby, Supabase free, and Hume's free tier for the narration (~2,200 characters, 30 Oct). The domain, studionephele.com, was already owned before the card started. Hume's paid plan for commercial use of the voice belongs to planner card F6, not here.

## Links: demo https://stilldrawn.studionephele.com · film https://media.studionephele.com/films/v1/stilldrawn-explorer/16x9.mp4 (9x16.mp4, .vtt) · thesis https://stilldrawn.studionephele.com/about (THESIS.md) · repo https://github.com/aaronlsmiles/stilldrawn-explorer

## Next

- **Done 30 Oct: P01 shipped.** Live at https://stilldrawn.studionephele.com (thesis at `/about`), repo public, films on R2, linked from aaronlsmiles.github.io. Phase 7 closed; every gate G0–G5 passed.
- **Open, not blocking:**
  - Explore's phone LCP is 3.2 s on Lighthouse's simulated phone (target 2.5 s; 3.6 s was accepted in Phase 5). `/about` is not yet in `tools/lighthouse-preview.mjs`.
  - Films v2 (card F6): the re-voice; the tax line "charge each engine for its motion" reads the wrong way round (the lens credits motion); per-aspect caption timings for 9:16; a panel-model credit on the end cards. v1 is immutable at `films/v1/`.
  - Option 2 for the thesis page, kept for later: the live scatter and Tax board embedded in the text (about a day).
  - The release's `TOS-REVIEW.md` open item closes in StillDrawn's next release build.
  - Plain words: Aaron's proofread and the real-reader test (criterion 7), on the live site; his soft to-do list holds both. Log the reader's words here and in `LOG.md`, then revise the copy.
  - P46 "Drift where nothing should move" (planner, added 30 Oct) picks up the question the thesis ends on.
