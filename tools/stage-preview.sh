#!/usr/bin/env bash
# Build web/ and stage a static preview in deploy/preview/ (its .vercel/ link is kept).
# Until the media host is live (G2), the preview ships every poster and panel display copy,
# plus the clips and frame-0 references for PREVIEW_CLIPS only; media/available.json lists
# them, and the player shows the poster with a note for every other clip.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
out="$here/deploy/preview"
m="$here/pipeline/out/media"
PREVIEW_CLIPS=(act-tone-2_campush_gen45 act-tone-2_campush_gen4t act-tone-2_campush_h3 act-tone-2_campush_ltx23 act-tone-2_campush_wan22)

[ -d "$m/posters" ] || { echo "run: (cd pipeline && uv run python -m stilldrawn_web.media)" >&2; exit 1; }
(cd "$here/web" && npm ci --silent && VITE_MEDIA_BASE=/media/ VITE_MEDIA_SUBSET=1 npm run build --silent)
mkdir -p "$out"
rsync -a --delete --exclude .vercel --exclude media "$here/web/dist/" "$out/"
rm -rf "$out/media" && mkdir -p "$out/media/posters" "$out/media/panels" "$out/media/frame0" "$out/media/clips"
rsync -a "$m/posters/" "$out/media/posters/"
rsync -a --include '*.webp' --exclude '*' "$m/panels/" "$out/media/panels/"
json="["
for id in "${PREVIEW_CLIPS[@]}"; do
  link="$(ls "$m"/clips/*/"$id.mp4")"
  eng="$(basename "$(dirname "$link")")"
  mkdir -p "$out/media/clips/$eng"
  cp -L "$link" "$out/media/clips/$eng/$id.mp4"
  cp "$m/frame0/$id.png" "$out/media/frame0/$id.png"
  json+="\"$id\","
done
printf '%s]\n' "${json%,}" > "$out/media/available.json"
cat > "$out/vercel.json" <<'JSON'
{
  "rewrites": [{ "source": "/((?!assets/|data/|media/|favicon).*)", "destination": "/index.html" }],
  "headers": [
    { "source": "/media/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] },
    { "source": "/(.*)", "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }] }
  ]
}
JSON
# the staged copies must be byte-identical to the release
for id in "${PREVIEW_CLIPS[@]}"; do
  f="$(ls "$out"/media/clips/*/"$id.mp4")"
  want="$(grep "/$id.mp4," "$(dirname "$(readlink -f "$(ls "$m"/clips/*/"$id.mp4")")")/../CLIP-HASHES.csv" | cut -d, -f2)"
  got="$(shasum -a 256 "$f" | cut -d' ' -f1)"
  [ "$want" = "$got" ] || { echo "hash mismatch: $id" >&2; exit 1; }
done
du -sh "$out"
