# Drift where nothing should move

This is an exploratory, post-hoc follow-up to StillDrawn, registered as amendment A9 before any rating or masked number existed. It asks whether the league is fair, and in particular whether it is fair to the engines that move.

## What it explores

StillDrawn measures how far an engine's ink lines wander from the drawing they started as. On that measure Gen-4.5 sits well behind Wan 2.2: its median line drift is 3.8 times Wan's on the cells tested here. The obvious objection is that this is the price of doing the job. Ask for a burst of action and a good engine moves the figure, the figure's lines move, and the benchmark scores that as drift. If so, the league partly rewards engines for ignoring the prompt.

A9 put that objection to two tests.

Test 2 takes it head on. On each of the 21 eligible drawings (one of 22 was left out because both mask sets allowed almost the whole frame), two mask sets mark where the requested motion is allowed to go: one drawn by the author, by hand, and one by a separate model run that had never seen a clip, working from the same written rules. Drift was then measured only outside those regions, with a margin of 32 px around them so that a sloppy edge costs nothing. If the objection is right, most of Gen-4.5's gap should vanish once the allowed motion is masked out. The registered bar was that at least half of it should go, under both mask sets.

Test 1 asks the reverse question: do the steadiest engines get their steadiness by not doing the motion? Two raters watched the burst and camera-push clips with the engine names hidden and rated how fully each clip did what it was asked. The registered prediction was that the steadier an engine's lines, the more often it misses.

## Why it matters

Test 2 is killed: the registered kill rule, the same order and under a quarter of the gap explained under both mask sets, was met. Under the author's masks, Gen-4.5's gap to Wan 2.2 falls only from 3.8 times to 3.3 times. Under the blind masks it rises slightly, to 3.9 times. The share of the gap that masking explains is 0.11 under the author's masks, with an interval from −0.41 to 0.33, and −0.01 under the blind masks, from −0.53 to 0.22. The engines keep exactly the same order under both mask sets at every margin. At margins of 16 px and 64 px, and on idle and burst drawings taken separately, nothing comes near half.

So the objection fails. Gen-4.5's extra drift is not motion it was asked for; it lies where nothing in the drawing should move. Before any masked number existed, the registration said that if the gap survived masking, the league would read more strongly as a measure of holding the drawing. It survived: Gen-4.5's gap to Wan 2.2 is not a tax on doing the work.

Test 1 is not supported. The rule needed both raters to find the pattern at p of 0.05 or less. For the author it holds, with a correlation of −0.90 and p of 0.042. For the second rater, R7, a new rater who had never seen StillDrawn, it does not: −0.50, p of 0.225. With only five engines to order, the test can reach that bar only if the order is almost perfect, and R7's middle of the league comes out in a different order.

What both raters agree on is the end of the league that matters most. Wan 2.2, the steadiest engine by a distance, missed the requested motion on 20 of its 22 clips for each of them, a miss being a score in the bottom two of five. Its steadiness is mostly stillness.

## What it suggests

Put the two results together and the league reads more sharply than before. Unsteadiness is not explained away by doing the motion: the gap survives masking. Steadiness, for Wan 2.2 at least, comes largely from not doing it. A stability score on its own cannot tell an engine that holds the drawing while acting from one that holds it by refusing to act. It needs an adherence reading beside it, and the explorer now shows the two side by side.

The honest limitation is in Test 1. Two raters and five engines are too few to say whether "steadier means lazier" holds across the whole field, rather than only for Wan 2.2. Adding raters now, after the results, would be fishing, so A9 does not. The broader claim needs its own registered test, rated at the level of single clips by more people who have never seen the work, and that is where it goes next. The masks have a limitation too: the author drew his after seeing clips, and on one drawing that showed. A deviations note records it, and the blind set, drawn without sight of any clip, is why Test 2 had to hold under both.

Nothing here changes the frozen league or its headline. A9 qualifies how to read it: when an engine drifts, the drift is real, and when an engine stays still, ask whether it did anything at all.
