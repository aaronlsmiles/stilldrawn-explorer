# Process log

Newest first. Written to be read in public: no account names, IDs or private repos.

## 2026-10-28 — planning

- Decided where the clips live: a bucket under the studio's own domain, all 373 served byte-exact. Re-encoding would have broken the C2PA signatures on 288 clips, and the release asks people not to. That also retired the card's "60–100 clip subset", which existed only to keep hosting costs down.
- Metrics come pre-computed from the released per-clip outputs. Per-frame series already exist for every clip, so nothing is re-run and the page can't drift from the paper's numbers.
- A correction caught while reading the data: the "9×" headline holds only against Wan 2.2. Against Gen-4 Turbo, Gen-4.5 moves 3.8× as much. The page says both.
- The paper reports a Pareto front but deliberately declines to set an exchange rate between stability and motion. The Stillness Tax tab will try three ways of handing that choice to the reader (price of motion, motion floor, matched-motion band), and the clearest one wins.
- The rating mode becomes the live demo of an open kit, blindpanel, built alongside.
