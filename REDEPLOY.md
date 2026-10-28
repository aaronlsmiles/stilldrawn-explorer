# Redeploy

## Preview (private; for gates such as G4)

```bash
tools/deploy-preview.sh
```

It runs `tools/stage-preview.sh` (build with `VITE_MEDIA_BASE=/media/ VITE_MEDIA_SUBSET=1`, then stage `deploy/preview/` with every poster and panel display copy and the five clips of the default cell, hash-checked against the release), links `deploy/preview` to the project `stilldrawn-explorer` on the personal Hobby team once, and deploys a preview. Never `--prod`, never an alias, never the company team.

Needs two gitignored files:
- `~/projects/studio/tools/stilldrawn-explorer.env.op` (in the hub: files with 1Password references never sit in a prototype repo): `VERCEL_TOKEN=` followed by the 1Password secret reference the rating study's REDEPLOY.md uses (vault and item IDs). Never a raw value, never `--token`.
- `.env.local` at this repo's root: `VERCEL_SCOPE=` the personal team's slug.

The preview URL is behind Vercel's deployment protection: only the team's logged-in members can open it.

## Production

After G2 (media on R2) and G5 (go-live): the full media upload (pipeline task 7, upload half), then a production deploy to `stilldrawn.studionephele.com`. Recipe lands with Phase 4.
