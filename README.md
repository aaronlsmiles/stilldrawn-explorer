# StillDrawn Explorer

A benchmark you can hold. Pick an inked panel and an image-to-video engine, then watch the clip beside its source and read its per-frame drift. Then move a slider that puts a price on motion and watch the leaderboard reshuffle.

Live: `stilldrawn.studionephele.com` (in progress)

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

Each section is added as its phase lands.

- `pipeline/`: Python (uv). Builds the data contract from a local copy of the public StillDrawn release.
- `web/`: Vite + React + TypeScript.
