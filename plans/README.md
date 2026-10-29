# Animation plans (improve-animations, 29 Oct 2026)

Audit of the explorer's motion against DESIGN.md (feedback only; `--ease` cubic-bezier(.2,.7,.2,1); 160 ms press and hover; 240 ms leaderboard reorder; reduced motion instant). Not reported, because DESIGN.md settles them: the reorder's ease-out curve, and reduced motion making every change instant.

| # | Plan | Severity | Status |
|---|---|---|---|
| 001 | Interruptible leaderboard FLIP | MEDIUM | DONE (verified by a unit test of the offset maths, `flip.test.ts`, instead of a timing-based e2e) |
| 002 | Hover feedback only on hover pointers | LOW | DONE |
| 003 | Kit buttons' press feedback in /rate | LOW | DONE |

Order: 001, 002, 003 (independent).

Missed opportunities, not planned: the keeper loop could draw itself on (a ~180 ms stroke) when a frame is chosen, the product's own gesture; it would be an entrance, which DESIGN.md rules out, so it is Aaron's call.
