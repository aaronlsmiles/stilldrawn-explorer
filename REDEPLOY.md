# Redeploy

## Preview (private; for gates such as G4)

```bash
tools/deploy-preview.sh
```

It runs `tools/stage-preview.sh` (checks the media host answers a ranged clip request with 206, builds the app against the contract's `media_base`, and stages `deploy/preview/` with the app and its data only), links `deploy/preview` to the project `stilldrawn-explorer` on the personal Hobby team once, and deploys a preview. It deploys with `--target=preview`: without it, the first deploy of a new project went to production and was aliased to the public `<project>.vercel.app` (28 Oct; alias removed). Never `--prod`, never an alias, never the company team.

Needs two gitignored files:
- `~/projects/studio/tools/stilldrawn-explorer.env.op` (in the hub: files with 1Password references never sit in a prototype repo): `VERCEL_TOKEN=` followed by the 1Password secret reference the rating study's REDEPLOY.md uses (vault and item IDs). Never a raw value, never `--token`.
- `.env.local` at this repo's root: `VERCEL_SCOPE=` the personal team's slug.

The preview URL is behind Vercel's deployment protection: only the team's logged-in members can open it.

## Media (R2)

```bash
cd pipeline
op run --env-file=$HOME/projects/studio/tools/stilldrawn-r2.env.op -- uv run python -m stilldrawn_web.media upload
uv run python -m stilldrawn_web.media verify
```

Uploads everything under `pipeline/out/media` (run `uv run python -m stilldrawn_web.media` first) to `stilldrawn-media/stilldrawn/v1.0.0/` with `Cache-Control: public, max-age=31536000, immutable`, the content type and each object's sha256 as metadata, plus `robots.txt` (AI crawlers disallowed) at the bucket root. Clips are hashed against `CLIP-HASHES.csv` first; any mismatch stops the run before anything is sent. Re-runs skip objects whose size and hash match. The R2 key is object read/write on this bucket only; it cannot change bucket settings (CORS is not needed: the player loads media without `crossOrigin`).

## Production

After G5 (go-live): a production deploy to `stilldrawn.studionephele.com`. Recipe lands with Phase 4.
