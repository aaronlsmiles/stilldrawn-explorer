#!/usr/bin/env bash
# Stage and deploy a PRIVATE preview to the personal Hobby team (never the company team, never --prod).
# Needs: ~/projects/studio/tools/stilldrawn-explorer.env.op (VERCEL_TOKEN as a 1Password secret reference;
# op:// files live in the hub, never in a prototype repo) and .env.local here (VERCEL_SCOPE=<team slug>).
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
set -a; . "$here/.env.local"; set +a
: "${VERCEL_SCOPE:?set VERCEL_SCOPE in .env.local}"
"$here/tools/stage-preview.sh"
cd "$here/deploy/preview"
ENV_OP="${ENV_OP:-$HOME/projects/studio/tools/stilldrawn-explorer.env.op}"
run() { op run --env-file="$ENV_OP" -- "$@"; }
[ -f .vercel/project.json ] || run vercel link --yes --scope "$VERCEL_SCOPE" --project stilldrawn-explorer
# --target=preview: on 28 Oct a plain deploy of this new project went to production and Vercel aliased
# it to the public <project>.vercel.app. A preview target keeps it behind Vercel login.
run vercel deploy --yes --target=preview --scope "$VERCEL_SCOPE"
