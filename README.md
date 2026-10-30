# StillDrawn Explorer

A benchmark you can hold. Pick an inked panel and an image-to-video engine, then watch the clip beside its source and read its per-frame drift. Then move a slider that puts a price on motion and watch the leaderboard reshuffle.

Live: `stilldrawn.studionephele.com` (in progress)

Thesis: [Stability ranks stillness](THESIS.md), about 800 words, also told [object first](THESIS-object-first.md). Both are on the site at `/about`, with a switch between them.

## What it explores

When an image-to-video model animates an inked panel, does it still look drawn? [StillDrawn](https://doi.org/10.5281/zenodo.23072784) measured that for 373 clips across six engines. This explorer puts every clip, its source and its per-frame metrics in one place you can steer.

## Why it matters

The benchmark's lesson is that stability scores rank stillness: the engines that kept their ink were mostly the ones that moved least. Gen-4.5 moves 9.2× as much as Wan 2.2 and 3.8× as much as Gen-4 Turbo (median optical flow). A static PDF can't show that trade-off. A slider can.

## What it suggests

World models will need evaluations that price motion openly, and the tools for reading them are a design problem.

## Data and licences

- Data: the StillDrawn dataset (Aaron Smiles, 2026), CC BY 4.0, DOI [10.5281/zenodo.23072784](https://doi.org/10.5281/zenodo.23072784). See [DATA-LICENSE.md](DATA-LICENSE.md).
- Clips are served unaltered: byte-identical to the release, with C2PA content credentials intact.
- Please don't use the clips or panels to train, fine-tune or improve generative models. The providers' notice is linked in DATA-LICENSE.md.
- Code: MIT ([LICENSE](LICENSE)).

## How to run

Needs a local copy of the public StillDrawn release (`STILLDRAWN_ROOT`, default `~/projects/stilldrawn`), uv, Node 22+ and ffmpeg with cwebp.

```bash
cd pipeline && uv sync && uv run pytest            # goldens, counts, contract schema
uv run python -m stilldrawn_web.export             # writes web/public/data/v1/
uv run python -m stilldrawn_web.media              # posters, frame-0 PNGs, panel WebPs into pipeline/out/media/ (clips symlinked)
cd ../web && npm ci && npm run dev                 # http://localhost:5173, media served from pipeline/out/media at /media/
npm test && npm run e2e                            # Vitest (incl. Python parity) and Playwright at 1440/390, light/dark
```

"Rate it yourself" (`/rate`) runs [blindpanel](../blindpanel), vendored as a tarball in `web/vendor/` with a lock file; `tools/vendor-blindpanel.sh` refreshes it from a clean kit commit. Locally the API is mocked in the tests; on Vercel, `web/api/` runs the kit's handlers against Supabase (see REDEPLOY.md).

Design direction: [docs/DESIGN.md](docs/DESIGN.md). Deploying: [REDEPLOY.md](REDEPLOY.md).
