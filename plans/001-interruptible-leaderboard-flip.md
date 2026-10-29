# 001 — Make the leaderboard's FLIP reorder interruptible

- **Status**: DONE
- **Commit**: 3269784
- **Severity**: MEDIUM
- **Category**: Interruptibility
- **Estimated scope**: 1 file (`web/src/views/Tax/flip.ts`), ~6 lines, plus 1 e2e test

## Problem

`web/src/views/Tax/flip.ts:6-15` animates each moved row from its old layout offset to its new one. When a second reorder lands while rows are still moving (dragging the price across the 0.04 px-wide LTX-2.3 window does this), it cancels the running animation and starts from the **old layout** position, not from where the row is on screen, so rows jump before they move:

```ts
/* web/src/views/Tax/flip.ts:10-14 — current */
    const dy = was - r.offsetTop;
    if (Math.abs(dy) < 0.5) continue;
    r.getAnimations().forEach((a) => a.cancel());
    r.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: ms, easing });
```

`was` comes from `offsets()` (layout `offsetTop`, which ignores the in-flight transform).

## Target

Start each new animation from the row's **current visual** position: the old layout offset plus whatever translateY the running animation has reached. Read it from the computed transform before cancelling.

```ts
/* target */
    const moving = getComputedStyle(r).transform;           // includes a running WAAPI animation
    const cur = moving && moving !== "none" ? new DOMMatrixReadOnly(moving).m42 : 0;
    const dy = was + cur - r.offsetTop;
    if (Math.abs(dy) < 0.5) continue;
    r.getAnimations().forEach((a) => a.cancel());
    r.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: ms, easing });
```

Duration (240 ms) and easing (`cubic-bezier(.2,.7,.2,1)`, the design's `--ease`) stay as they are: DESIGN.md sets both.

## Repo conventions to follow

- Motion values come from DESIGN.md: `--ease: cubic-bezier(.2,.7,.2,1)`, 240 ms for the reorder (`web/src/theme/tokens.css` `--move`).
- Reduced motion already returns early (`flip.ts:7`); keep that line first.

## Steps

1. In `web/src/views/Tax/flip.ts`, replace lines 10–11 with the three-line target above (`moving`, `cur`, `dy`).
2. Add an e2e test in `web/e2e/tax.spec.ts`: set the price past the first crossover, then within 60 ms set it past the second; sample the moving row's `getBoundingClientRect().top` every animation frame for 300 ms and assert no frame-to-frame jump larger than the row height / 2.

## Boundaries

- Do NOT change the duration, the easing or the reduced-motion branch.
- Do NOT touch `Leaderboard.tsx` beyond what a step says.
- If the code at `flip.ts:10-14` differs from the excerpt, STOP and report.

## Verification

- **Mechanical**: `npx tsc --noEmit -p web` passes; `npx playwright test -c web/e2e/playwright.config.ts tax.spec.ts` passes.
- **Feel check**: on /tax, drag the price slider quickly back and forth across 1.2–1.3 px:
  - rows glide from wherever they are; none snaps back before moving
  - In DevTools Animations at 10%, a second reorder mid-flight continues from the row's current position
  - With reduced motion on, rows swap instantly
- **Done when**: the new test passes and fails against the old `flip.ts`.
