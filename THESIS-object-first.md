# Stability ranks stillness


Pick a drawing. Pick an engine. The clip plays beside the panel it came from, and a curve underneath counts, frame by frame, how far the lines have wandered.

## What it explores

[StillDrawn Explorer](https://stilldrawn.studionephele.com) is a benchmark you can hold. StillDrawn is an open set of 373 short clips, with a paper. Each clip was made from a black-and-white ink panel by a video model asked for idle motion, a short burst of action or a slow camera push. Every prompt also asked for the drawing to stay exactly as drawn. Five metrics measure what each clip kept: lines, screentone, edges, style and closed shapes.

The explorer shows every clip, byte for byte as released, so the 288 that carry content credentials still do. Scrub the curve and the clip follows. Switch on the difference view and the clip is laid over its own first frame: black means unchanged. Put two engines side by side on the same panel and the gap is there to see.

The explorer opens on a camera push. Wan 2.2's curve stays low, ending at 1.35 px. Gen-4.5's climbs past 8 px. Across the whole benchmark, Wan 2.2 leads on line drift with a median of 0.78 px. Gen-4 Turbo has 2.64, LTX-2.3 2.80, Gen-4.5 4.79 and MiniMax H3 5.38.

Then watch the clips again. Wan 2.2's barely move.

## Why it matters

Measured by optical flow, Gen-4.5 moves 9.2 times as much as Wan 2.2, and 3.8 times as much as Gen-4 Turbo. Plot motion against drift and the engines line up (Figure 1). Their median motion and median line drift rank together at ρ = 0.90 (Spearman's rank correlation). The two orderings match except that the last two engines swap places. Inside four of the five engines, clips that move more drift more, at ρ 0.38 to 0.58. Wan 2.2 is the exception, at −0.007: it moves so little that there's nothing for drift to follow.

![Figure 1: the motion against line drift scatter, one cross per engine](web/public/thesis/scatter-light.png)

*Figure 1. Motion against line drift for the 164 standard clips, both axes on a log scale. Each cross is an engine's median, with its interquartile range. Hollow points are six clips generated between a first and a last frame; no comparison uses them. The engines that move more drift more. [Open it in the explorer](https://stilldrawn.studionephele.com/scatter).*

So stability ranks stillness. Any metric that rewards a clip for staying like its first frame is maximised by a clip that doesn't move. This isn't peculiar to ink: VBench, a widely used video benchmark, pairs its consistency scores with a motion score for the same reason. A stability leaderboard with no motion beside it is mostly a ranking of who did least.

Matching doesn't fix it. A matched-motion comparison sets two engines side by side only where their motion ranges overlap. Five of the ten pairs have enough clips for that, and two of those five reverse. H3, last on line drift, beats Gen-4 Turbo at equal movement, and so does LTX-2.3. Wan 2.2 can't be compared with any other engine at equal motion.

## What it suggests

StillDrawn's paper stopped short of setting an exchange rate between stability and motion. The explorer's Stillness Tax hands that choice to you. It is labelled exploratory, because the motion measure was added after the clips were made (pre-registration amendment A6).

You decide how many pixels of drift a doubling of motion is worth (Figure 2). Each engine is credited for the motion it delivers. At zero you get the paper's order, and Wan 2.2 leads. It keeps the lead until a doubling of motion is worth 1.23 px. LTX-2.3 leads for a sliver. From 1.27 px, Gen-4.5 leads, because it moves more, not because it looks better. Gen-4 Turbo is on the Pareto front, since no engine both moves more and drifts less, but it never leads at any price.

![Figure 2: the Stillness Tax leaderboard and chart, with Gen-4.5 leading](web/public/thesis/tax-light.png)

*Figure 2. The Stillness Tax with the price set past 1.27 px, where Gen-4.5 leads. Each engine's score is its median line drift minus the price for every doubling of motion it has over Wan 2.2; the lowest score leads. The leader changes at 1.23 and 1.27 px per doubling. [Move the slider yourself](https://stilldrawn.studionephele.com/tax?lens=price&p=2).*

No price is the right one. A slider shows what a table can't: the ranking was always a choice, and now you can see who made it. Generated video is supposed to move. Evaluations that score only what stays the same will keep rewarding models for not doing the job. Stability scores need motion beside them.

**The honest limits**
- **Five engines.** With five points, ρ = 0.90 has an exact p of 0.083: suggestive, not proven.
- **Thin comparisons.** A matched-motion comparison counts only when each engine has at least five clips in the overlap, so half the pairs drop out.
- **Few failure tags.** They come from 24 clips reviewed frame by frame.
- **Modest human agreement.** People agree only loosely on whether a clip still looks hand-drawn (Krippendorff's α 0.21).
- **Motion came later.** The motion measure was added after the fact, so it qualifies the results rather than restating them.

The next test: measure drift only where the requested motion shouldn't reach, and see whether the order survives.

Data: StillDrawn dataset (Aaron Smiles, 2026), CC BY 4.0, [doi:10.5281/zenodo.23072784](https://doi.org/10.5281/zenodo.23072784).

The same argument, told finding first: [THESIS.md](THESIS.md).
