# 002 — Gate hover feedback to pointers that hover

- **Status**: DONE
- **Commit**: 3269784
- **Severity**: LOW
- **Category**: Accessibility (touch)
- **Estimated scope**: 4 CSS files, ~6 rules wrapped

## Problem

Hover rules apply on touch screens too. A tap fires `:hover` and it sticks until the next tap elsewhere, so on a phone "Play" or a switch option keeps its hover fill after the tap:

```css
/* web/src/shell/shell.css */
.btn:hover { background: var(--raised); }
.seg-opt:hover { color: var(--text); background: var(--raised); }
/* web/src/views/Tax/tax.css */
.seg-jump:hover { background: var(--raised); }
/* web/src/views/Explore/explore.css */
.frame-btn:hover img { opacity: .82; }
.g-clip:hover img { opacity: .85; }
```

## Target

Each of these inside one query per file:

```css
@media (hover: hover) and (pointer: fine) {
  .btn:hover { background: var(--raised); }
}
```

Press feedback (`.btn:active { transform: scale(.97); }`) stays outside the query: a press is real on touch.

## Repo conventions to follow

- Plain CSS per view; tokens from `web/src/theme/tokens.css`. No new tokens.

## Steps

1. `web/src/shell/shell.css`: wrap `.btn:hover` and `.seg-opt:hover` in `@media (hover: hover) and (pointer: fine) { … }`.
2. `web/src/views/Tax/tax.css`: same for `.seg-jump:hover`.
3. `web/src/views/Explore/explore.css`: same for `.frame-btn:hover img` and `.g-clip:hover img`.

## Boundaries

- Do NOT change colours, durations or the `:active` rule.
- Do NOT touch the vendored kit's CSS (its hover rules are the kit's).

## Verification

- **Mechanical**: the e2e suite passes in all four projects (the phone projects run with `hasTouch`).
- **Feel check**: with touch emulation, tap "Play" on /explore: the button returns to its resting fill when the finger lifts. With a mouse at 1440, hover still fills.
- **Done when**: no `:hover` rule in the explorer's own CSS sits outside a `(hover: hover)` query.
