# Process log

Newest first. Written to be read in public: no account names, IDs or private repos.

## 2026-10-28 — the clips go up

- All 373 clips are now on the studio's own media host, byte for byte as released, so the 288 with signed content credentials keep them. The upload hashes every clip against the release's published list before sending anything, and stops if one differs; a second run sends nothing because every object's size and hash already match. Spot checks through the public address get partial-content responses (so video can seek) and the exact released bytes.
- The player no longer asks the media host for cross-origin permission. Nothing on the page reads pixels back from the video, so plain cross-origin video and images are enough, and the media host needs no extra configuration.

## 2026-10-28 — choosing the lens

- Of the three ways to price motion, the slider that charges a price per doubling of motion became the default: it is the one a reader can explain after one go, and it carries the main finding (the leader changes as the price rises). The matched-motion band stays as the alternate because it reproduces the paper's own result, two pairs whose order flips once motion is matched. The motion floor was cut: it reshuffles a lot, but its rankings soon rest on six clips or fewer. Its code is archived, not deleted.

## 2026-10-28 — the views

- The engines carry no colour. A colourblind-safety check on every five-colour palette we could find or search for (60,000 candidates) failed the moment all five engines share one scatter: at least one pair always sat too close even for full colour vision. So engines are named everywhere, data is ink, context is grey, and the one gold marks whatever the reader has selected. The constraint became the look: ink on paper, with a grease-pencil circle.
- The contact sheet shows each clip at frame 96, four seconds in, not frame 0. Frame 0 is just the panel again; frame 96 is where the drift shows, so a glance across a row already tells the story before anything is clicked.
- The difference view (the clip over its own first frame, blended by difference) only works if the reference frame is decoded exactly as the browser decodes the video. The clips carry no colour tags; browsers assume BT.709 for HD while the usual extraction default is BT.601. Extracting as BT.709 makes frame 0 cancel to near-black (mean difference under 2 of 255), and a test now holds it there.
- The price-of-motion lens has a near-tie hiding in it: Wan 2.2, LTX-2.3 and Gen-4.5 sit almost on one straight line in (doublings of motion, median drift). That is why LTX-2.3 leads for only 0.04 px of price, and why one slider position can flip three places at once.
- Every lens board is computed in the browser by a port of the pipeline's code and checked against the pipeline's own outputs: ranks exactly, values to 1e-9. Two traps found on the way: JavaScript's locale-aware sort puts "_" before ".", unlike Python, so ties broke differently until the comparison used code points; and rounding a band edge in the URL can drop the one clip that sits exactly on it, so URLs carry exact values and a preset always uses the pair's computed edges.
- The matched-motion band ranks all five engines inside a pair's band, not just the pair. The paper's reversals still reproduce within each pair (H3 beats Gen-4 Turbo, 2.46 against 2.88 px; LTX-2.3 beats Gen-4 Turbo, 1.83 against 2.88 px), and the board shows what else lives in that band.

## 2026-10-28 — pipeline

- The data contract builds from the public release alone: 373 clips in 2.2 MB of JSON, with per-frame series loaded per engine.
- Every number the page will quote is reproduced from the paper's own outputs before anything is drawn: league medians, motion medians, the exact engine-level ρ = 0.9 (p = 1/12), the Pareto front, the matched-motion bands (8 overlap, 5 usable, 2 reverse), and the raters' agreement (α 0.209 and 0.478).
- First result of the price-of-motion lens: Wan 2.2 leads until a doubling of motion is worth 1.23 px of line drift. LTX-2.3 then leads for a sliver, and from 1.27 px Gen-4.5 leads. Gen-4 Turbo sits on the Pareto front but never leads at any price: it lies off the front's convex hull.
- Failure tags are transcribed by hand from the taxonomy, and a test checks each one against its source text, so none can be invented.

## 2026-10-28 — planning

- Decided where the clips live: a bucket under the studio's own domain, all 373 served byte-exact. Re-encoding would have broken the C2PA signatures on 288 clips, and the release asks people not to. That also retired the card's "60–100 clip subset", which existed only to keep hosting costs down.
- Metrics come pre-computed from the released per-clip outputs. Per-frame series already exist for every clip, so nothing is re-run and the page can't drift from the paper's numbers.
- A correction caught while reading the data: the "9×" headline holds only against Wan 2.2. Against Gen-4 Turbo, Gen-4.5 moves 3.8× as much. The page says both.
- The paper reports a Pareto front but deliberately declines to set an exchange rate between stability and motion. The Stillness Tax tab will try three ways of handing that choice to the reader (price of motion, motion floor, matched-motion band), and the clearest one wins.
- The rating mode becomes the live demo of an open kit, blindpanel, built alongside.
