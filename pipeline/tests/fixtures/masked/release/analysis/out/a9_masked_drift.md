SYNTHETIC TEST FIXTURE: not a result (see PROVENANCE.txt)

# A9 Test 2: masked drift

Post-hoc (A9), exploratory. Rows are in frozen-league order; there is no rank column. Masked
medians appear only beside whole-frame medians on the same cells.

**Verdict (m = 32, both mask sets): supported.**

- aaron's masks: Post-hoc (A9): on 104 cells, Gen-4.5/Wan falls from 8.0× to 2.0× outside the region the prompt allows to move (s = 0.67, 95% CI 0.67 to 0.67). The frozen league is unchanged; this qualifies how its gap is read.
- agent's masks: Post-hoc (A9): on 104 cells, Gen-4.5/Wan falls from 8.0× to 2.2× outside the region the prompt allows to move (s = 0.62, 95% CI 0.62 to 0.62). The frozen league is unchanged; this qualifies how its gap is read.

Eligible rows: 21 of 22. Bootstrap: 10000 panel resamples, seed 20261030.

## Split: all (the registered verdict's cells)

### aaron masks, m = 16 px

| engine | clips | whole-frame median (px) | masked median (px) |
|---|---|---|---|
| Wan 2.2 | 21 | 1.010 | 1.010 |
| Gen-4 Turbo | 20 | 2.625 | 1.110 |
| LTX-2.3 | 21 | 2.828 | 1.212 |
| Gen-4.5 | 21 | 8.080 | 2.020 |
| MiniMax H3 | 21 | 9.090 | 2.525 |

g_whole 3.000, g_masked 1.000, s 0.667 (95% CI 0.667 to 0.667), delta g 2.000 (95% CI 2.000 to 2.000), Kendall tau_b 1.000; replicates with g_whole <= 0: 0.
Excluded (frame 0 under 500 line px in R): none.

### aaron masks, m = 32 px

| engine | clips | whole-frame median (px) | masked median (px) |
|---|---|---|---|
| Wan 2.2 | 21 | 1.010 | 1.010 |
| Gen-4 Turbo | 20 | 2.625 | 1.110 |
| LTX-2.3 | 21 | 2.828 | 1.212 |
| Gen-4.5 | 21 | 8.080 | 2.020 |
| MiniMax H3 | 21 | 9.090 | 2.525 |

g_whole 3.000, g_masked 1.000, s 0.667 (95% CI 0.667 to 0.667), delta g 2.000 (95% CI 2.000 to 2.000), Kendall tau_b 1.000; replicates with g_whole <= 0: 0.
Excluded (frame 0 under 500 line px in R): none.

### aaron masks, m = 64 px

| engine | clips | whole-frame median (px) | masked median (px) |
|---|---|---|---|
| Wan 2.2 | 21 | 1.010 | 1.010 |
| Gen-4 Turbo | 20 | 2.625 | 1.110 |
| LTX-2.3 | 21 | 2.828 | 1.212 |
| Gen-4.5 | 21 | 8.080 | 2.020 |
| MiniMax H3 | 21 | 9.090 | 2.525 |

g_whole 3.000, g_masked 1.000, s 0.667 (95% CI 0.667 to 0.667), delta g 2.000 (95% CI 2.000 to 2.000), Kendall tau_b 1.000; replicates with g_whole <= 0: 0.
Excluded (frame 0 under 500 line px in R): none.

### agent masks, m = 16 px

| engine | clips | whole-frame median (px) | masked median (px) |
|---|---|---|---|
| Wan 2.2 | 21 | 1.010 | 1.010 |
| Gen-4 Turbo | 20 | 2.625 | 1.110 |
| LTX-2.3 | 21 | 2.828 | 1.212 |
| Gen-4.5 | 21 | 8.080 | 2.222 |
| MiniMax H3 | 21 | 9.090 | 2.727 |

g_whole 3.000, g_masked 1.138, s 0.621 (95% CI 0.621 to 0.621), delta g 1.862 (95% CI 1.862 to 1.862), Kendall tau_b 1.000; replicates with g_whole <= 0: 0.
Excluded (frame 0 under 500 line px in R): none.

### agent masks, m = 32 px

| engine | clips | whole-frame median (px) | masked median (px) |
|---|---|---|---|
| Wan 2.2 | 21 | 1.010 | 1.010 |
| Gen-4 Turbo | 20 | 2.625 | 1.110 |
| LTX-2.3 | 21 | 2.828 | 1.212 |
| Gen-4.5 | 21 | 8.080 | 2.222 |
| MiniMax H3 | 21 | 9.090 | 2.727 |

g_whole 3.000, g_masked 1.138, s 0.621 (95% CI 0.621 to 0.621), delta g 1.862 (95% CI 1.862 to 1.862), Kendall tau_b 1.000; replicates with g_whole <= 0: 0.
Excluded (frame 0 under 500 line px in R): none.

### agent masks, m = 64 px

| engine | clips | whole-frame median (px) | masked median (px) |
|---|---|---|---|
| Wan 2.2 | 21 | 1.010 | 1.010 |
| Gen-4 Turbo | 20 | 2.625 | 1.110 |
| LTX-2.3 | 21 | 2.828 | 1.212 |
| Gen-4.5 | 21 | 8.080 | 2.222 |
| MiniMax H3 | 21 | 9.090 | 2.727 |

g_whole 3.000, g_masked 1.138, s 0.621 (95% CI 0.621 to 0.621), delta g 1.862 (95% CI 1.862 to 1.862), Kendall tau_b 1.000; replicates with g_whole <= 0: 0.
Excluded (frame 0 under 500 line px in R): none.

## Split: idle (no verdict)

### aaron masks, m = 16 px

| engine | clips | whole-frame median (px) | masked median (px) |
|---|---|---|---|
| Wan 2.2 | 11 | 1.010 | 1.010 |
| Gen-4 Turbo | 10 | 2.625 | 1.110 |
| LTX-2.3 | 11 | 2.828 | 1.212 |
| Gen-4.5 | 11 | 8.080 | 2.020 |
| MiniMax H3 | 11 | 9.090 | 2.525 |

g_whole 3.000, g_masked 1.000, s 0.667 (95% CI 0.667 to 0.667), delta g 2.000 (95% CI 2.000 to 2.000), Kendall tau_b 1.000; replicates with g_whole <= 0: 0.
Excluded (frame 0 under 500 line px in R): none.

### aaron masks, m = 32 px

| engine | clips | whole-frame median (px) | masked median (px) |
|---|---|---|---|
| Wan 2.2 | 11 | 1.010 | 1.010 |
| Gen-4 Turbo | 10 | 2.625 | 1.110 |
| LTX-2.3 | 11 | 2.828 | 1.212 |
| Gen-4.5 | 11 | 8.080 | 2.020 |
| MiniMax H3 | 11 | 9.090 | 2.525 |

g_whole 3.000, g_masked 1.000, s 0.667 (95% CI 0.667 to 0.667), delta g 2.000 (95% CI 2.000 to 2.000), Kendall tau_b 1.000; replicates with g_whole <= 0: 0.
Excluded (frame 0 under 500 line px in R): none.

### aaron masks, m = 64 px

| engine | clips | whole-frame median (px) | masked median (px) |
|---|---|---|---|
| Wan 2.2 | 11 | 1.010 | 1.010 |
| Gen-4 Turbo | 10 | 2.625 | 1.110 |
| LTX-2.3 | 11 | 2.828 | 1.212 |
| Gen-4.5 | 11 | 8.080 | 2.020 |
| MiniMax H3 | 11 | 9.090 | 2.525 |

g_whole 3.000, g_masked 1.000, s 0.667 (95% CI 0.667 to 0.667), delta g 2.000 (95% CI 2.000 to 2.000), Kendall tau_b 1.000; replicates with g_whole <= 0: 0.
Excluded (frame 0 under 500 line px in R): none.

### agent masks, m = 16 px

| engine | clips | whole-frame median (px) | masked median (px) |
|---|---|---|---|
| Wan 2.2 | 11 | 1.010 | 1.010 |
| Gen-4 Turbo | 10 | 2.625 | 1.110 |
| LTX-2.3 | 11 | 2.828 | 1.212 |
| Gen-4.5 | 11 | 8.080 | 2.222 |
| MiniMax H3 | 11 | 9.090 | 2.727 |

g_whole 3.000, g_masked 1.138, s 0.621 (95% CI 0.621 to 0.621), delta g 1.862 (95% CI 1.862 to 1.862), Kendall tau_b 1.000; replicates with g_whole <= 0: 0.
Excluded (frame 0 under 500 line px in R): none.

### agent masks, m = 32 px

| engine | clips | whole-frame median (px) | masked median (px) |
|---|---|---|---|
| Wan 2.2 | 11 | 1.010 | 1.010 |
| Gen-4 Turbo | 10 | 2.625 | 1.110 |
| LTX-2.3 | 11 | 2.828 | 1.212 |
| Gen-4.5 | 11 | 8.080 | 2.222 |
| MiniMax H3 | 11 | 9.090 | 2.727 |

g_whole 3.000, g_masked 1.138, s 0.621 (95% CI 0.621 to 0.621), delta g 1.862 (95% CI 1.862 to 1.862), Kendall tau_b 1.000; replicates with g_whole <= 0: 0.
Excluded (frame 0 under 500 line px in R): none.

### agent masks, m = 64 px

| engine | clips | whole-frame median (px) | masked median (px) |
|---|---|---|---|
| Wan 2.2 | 11 | 1.010 | 1.010 |
| Gen-4 Turbo | 10 | 2.625 | 1.110 |
| LTX-2.3 | 11 | 2.828 | 1.212 |
| Gen-4.5 | 11 | 8.080 | 2.222 |
| MiniMax H3 | 11 | 9.090 | 2.727 |

g_whole 3.000, g_masked 1.138, s 0.621 (95% CI 0.621 to 0.621), delta g 1.862 (95% CI 1.862 to 1.862), Kendall tau_b 1.000; replicates with g_whole <= 0: 0.
Excluded (frame 0 under 500 line px in R): none.

## Split: burst (no verdict)

### aaron masks, m = 16 px

| engine | clips | whole-frame median (px) | masked median (px) |
|---|---|---|---|
| Wan 2.2 | 10 | 1.010 | 1.010 |
| Gen-4 Turbo | 10 | 2.625 | 1.110 |
| LTX-2.3 | 10 | 2.827 | 1.211 |
| Gen-4.5 | 10 | 8.076 | 2.019 |
| MiniMax H3 | 10 | 9.085 | 2.524 |

g_whole 3.000, g_masked 1.000, s 0.667 (95% CI 0.667 to 0.667), delta g 2.000 (95% CI 2.000 to 2.000), Kendall tau_b 1.000; replicates with g_whole <= 0: 0.
Excluded (frame 0 under 500 line px in R): none.

### aaron masks, m = 32 px

| engine | clips | whole-frame median (px) | masked median (px) |
|---|---|---|---|
| Wan 2.2 | 10 | 1.010 | 1.010 |
| Gen-4 Turbo | 10 | 2.625 | 1.110 |
| LTX-2.3 | 10 | 2.827 | 1.211 |
| Gen-4.5 | 10 | 8.076 | 2.019 |
| MiniMax H3 | 10 | 9.085 | 2.524 |

g_whole 3.000, g_masked 1.000, s 0.667 (95% CI 0.667 to 0.667), delta g 2.000 (95% CI 2.000 to 2.000), Kendall tau_b 1.000; replicates with g_whole <= 0: 0.
Excluded (frame 0 under 500 line px in R): none.

### aaron masks, m = 64 px

| engine | clips | whole-frame median (px) | masked median (px) |
|---|---|---|---|
| Wan 2.2 | 10 | 1.010 | 1.010 |
| Gen-4 Turbo | 10 | 2.625 | 1.110 |
| LTX-2.3 | 10 | 2.827 | 1.211 |
| Gen-4.5 | 10 | 8.076 | 2.019 |
| MiniMax H3 | 10 | 9.085 | 2.524 |

g_whole 3.000, g_masked 1.000, s 0.667 (95% CI 0.667 to 0.667), delta g 2.000 (95% CI 2.000 to 2.000), Kendall tau_b 1.000; replicates with g_whole <= 0: 0.
Excluded (frame 0 under 500 line px in R): none.

### agent masks, m = 16 px

| engine | clips | whole-frame median (px) | masked median (px) |
|---|---|---|---|
| Wan 2.2 | 10 | 1.010 | 1.010 |
| Gen-4 Turbo | 10 | 2.625 | 1.110 |
| LTX-2.3 | 10 | 2.827 | 1.211 |
| Gen-4.5 | 10 | 8.076 | 2.221 |
| MiniMax H3 | 10 | 9.085 | 2.726 |

g_whole 3.000, g_masked 1.138, s 0.621 (95% CI 0.621 to 0.621), delta g 1.862 (95% CI 1.862 to 1.862), Kendall tau_b 1.000; replicates with g_whole <= 0: 0.
Excluded (frame 0 under 500 line px in R): none.

### agent masks, m = 32 px

| engine | clips | whole-frame median (px) | masked median (px) |
|---|---|---|---|
| Wan 2.2 | 10 | 1.010 | 1.010 |
| Gen-4 Turbo | 10 | 2.625 | 1.110 |
| LTX-2.3 | 10 | 2.827 | 1.211 |
| Gen-4.5 | 10 | 8.076 | 2.221 |
| MiniMax H3 | 10 | 9.085 | 2.726 |

g_whole 3.000, g_masked 1.138, s 0.621 (95% CI 0.621 to 0.621), delta g 1.862 (95% CI 1.862 to 1.862), Kendall tau_b 1.000; replicates with g_whole <= 0: 0.
Excluded (frame 0 under 500 line px in R): none.

### agent masks, m = 64 px

| engine | clips | whole-frame median (px) | masked median (px) |
|---|---|---|---|
| Wan 2.2 | 10 | 1.010 | 1.010 |
| Gen-4 Turbo | 10 | 2.625 | 1.110 |
| LTX-2.3 | 10 | 2.827 | 1.211 |
| Gen-4.5 | 10 | 8.076 | 2.221 |
| MiniMax H3 | 10 | 9.085 | 2.726 |

g_whole 3.000, g_masked 1.138, s 0.621 (95% CI 0.621 to 0.621), delta g 1.862 (95% CI 1.862 to 1.862), Kendall tau_b 1.000; replicates with g_whole <= 0: 0.
Excluded (frame 0 under 500 line px in R): none.
