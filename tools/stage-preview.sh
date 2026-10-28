#!/usr/bin/env bash
# Build web/ and stage a static preview in deploy/preview/ (its .vercel/ link is kept).
# Media come from the media host named in the contract (index.json media_base), so the
# preview ships the app and its data only. Before the media host was live (until 28 Oct),
# this script shipped a hash-checked subset of clips instead; see git history.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
out="$here/deploy/preview"

base="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['media_base'])" "$here/web/public/data/v1/index.json")"
code="$(curl -s -o /dev/null -w '%{http_code}' -r 0-0 "${base}clips/wan22/act-tone-2_campush_wan22.mp4")"
[ "$code" = "206" ] || { echo "media host not serving clips (${base}: HTTP $code); upload first" >&2; exit 1; }

(cd "$here/web" && npm ci --silent && VITE_MEDIA_BASE= npm run build --silent)
mkdir -p "$out"
rsync -a --delete --exclude .vercel "$here/web/dist/" "$out/"
cat > "$out/vercel.json" <<'JSON'
{
  "rewrites": [{ "source": "/((?!assets/|data/|favicon).*)", "destination": "/index.html" }],
  "headers": [
    { "source": "/(.*)", "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }] }
  ]
}
JSON
du -sh "$out"
