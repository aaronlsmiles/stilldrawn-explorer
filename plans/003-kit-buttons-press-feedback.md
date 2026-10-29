# 003 — Give the kit's buttons the explorer's press feedback in /rate

- **Status**: DONE
- **Commit**: 3269784
- **Severity**: LOW
- **Category**: Cohesion & tokens
- **Estimated scope**: 1 file (`web/src/views/Rate/rate.css`), 2 rules

## Problem

Every explorer button scales to 0.97 when pressed (`web/src/shell/shell.css`: `.btn:active { transform: scale(.97); }`, with `transition: … transform var(--fast) var(--ease)`). Inside /rate the kit's buttons (Start, Back, Next, See where you land, Add my ratings) only change colour, so the one page where a visitor presses a button 17 times feels different from the rest.

## Target

```css
/* web/src/views/Rate/rate.css */
.rate .bp-btn { transition: background-color var(--fast) var(--ease), transform var(--fast) var(--ease); }
.rate .bp-btn:active:not(:disabled) { transform: scale(.97); }
```

`--fast` is 160 ms and `--ease` is `cubic-bezier(.2,.7,.2,1)` (DESIGN.md; press feedback 100–160 ms, scale 0.95–0.98). Reduced motion: the explorer's base layer already zeroes transition durations, and the kit's own `.bp * { transition: none !important }` does too.

## Repo conventions to follow

- Host theming of the kit lives in `web/src/views/Rate/rate.css`, unlayered over the kit's `@layer blindpanel`. Exemplar: `.rate .bp-btn { min-height: var(--control-h); padding: 0 16px; }`.

## Steps

1. Append the two target rules to `web/src/views/Rate/rate.css`.

## Boundaries

- Do NOT edit the kit (`../blindpanel`); this is the host's theme.
- Do NOT add press feedback to the answer tiles (`.bp-opt`): they are wide, and their checked state is the feedback.

## Verification

- **Mechanical**: e2e `rate.spec.ts` passes (its contrast check waits for transitions to finish).
- **Feel check**: on /rate, press and hold "Start": it settles to 97 % and springs back on release; a disabled "Next" doesn't move.
- **Done when**: the two rules are in place and the rate e2e passes.
