#!/usr/bin/env bash
# Build web/ and stage deploy/preview/ (its .vercel/ link is kept): the built app under public/,
# the API functions under api/ with a package.json that installs the vendored blindpanel tarball
# (Vercel runs npm install and builds the functions there; it cannot see ../blindpanel), and vercel.json.
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
find "$out" -mindepth 1 -maxdepth 1 ! -name .vercel -exec rm -rf {} +
mkdir -p "$out/public" "$out/api" "$out/vendor"
rsync -a "$here/web/dist/" "$out/public/"
for f in "$here"/web/api/*.ts; do case "$f" in *.test.ts) ;; *) cp "$f" "$out/api/" ;; esac; done
tarball="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['tarball'])" "$here/web/vendor/blindpanel.lock.json")"
cp "$here/web/vendor/$tarball" "$out/vendor/"
# the functions' type check on Vercel needs Node's types; same pin as web/
typesnode="$(node -p "require('$here/web/package.json').devDependencies['@types/node']")"
cat > "$out/package.json" <<JSON
{
  "private": true,
  "type": "module",
  "engines": { "node": "24.x" },
  "dependencies": { "blindpanel": "file:vendor/$tarball" },
  "devDependencies": { "@types/node": "$typesnode" }
}
JSON
(cd "$out" && npm install --package-lock-only --silent --no-audit --no-fund)
# Cron jobs run on production deployments only; on a preview, /api/keepwarm is called by hand.
cat > "$out/vercel.json" <<'JSON'
{
  "rewrites": [{ "source": "/((?!api/|assets/|data/|fonts/|favicon).*)", "destination": "/index.html" }],
  "functions": { "api/*.ts": { "includeFiles": "public/data/blindpanel/stilldrawn/study.json" } },
  "crons": [{ "path": "/api/keepwarm", "schedule": "17 6 * * *" }],
  "headers": [
    { "source": "/(.*)", "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }] }
  ]
}
JSON
du -sh "$out"
node "$here/tools/check-stage.mjs" "$out"
