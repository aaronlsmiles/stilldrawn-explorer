#!/usr/bin/env bash
# Stage and deploy a PRIVATE preview to the personal Hobby team (never the company team, never --prod).
# Needs: .env.op (VERCEL_TOKEN as a 1Password secret reference) and .env.local (VERCEL_SCOPE=<team slug>).
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
set -a; . "$here/.env.local"; set +a
: "${VERCEL_SCOPE:?set VERCEL_SCOPE in .env.local}"
"$here/tools/stage-preview.sh"
cd "$here/deploy/preview"
run() { op run --env-file="$here/.env.op" -- "$@"; }
[ -f .vercel/project.json ] || run vercel link --yes --scope "$VERCEL_SCOPE" --project stilldrawn-explorer
run vercel deploy --yes --scope "$VERCEL_SCOPE"
