# Sub-plan D: blindpanel in the explorer (Phase 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/rate` in the explorer runs the blindpanel StillDrawn study, reveals each clip with a link into `/explore`, and opt-in submissions reach the live Supabase project through three thin Vercel functions, verified on the login-protected preview.

**Architecture:**
- The kit arrives as a vendored tarball (`web/vendor/blindpanel-0.1.0.tgz` plus `web/vendor/blindpanel.lock.json`), made by `tools/vendor-blindpanel.sh` from a clean blindpanel commit. The same script builds the StillDrawn study and copies `study.json` and `reveal.json` into `web/public/data/blindpanel/stilldrawn/`.
- The browser side is a React wrapper that calls `mountSession` and then `mountResults` (mount and destroy in one effect, StrictMode-safe), themed by mapping `--bp-*` onto the explorer's tokens.
- The server side is `web/api/{submit,tally,keepwarm}.ts`, thin wrappers over `blindpanel/server` with `supabaseStore`, configured by one tested module (`web/api/_lib.ts`).
- `tools/stage-preview.sh` stages `public/` (the built app), `api/`, `package.json`, `package-lock.json`, `vendor/` and `vercel.json` (rewrites, a daily keep-warm cron). Vercel installs the tarball and builds the functions there.

**Tech Stack:** React 19, Vite 8, TypeScript 7, Vitest 5 (no globals; `afterEach(cleanup)`), Playwright 1.64, blindpanel 0.1.0, Vercel Functions (Node 24, web-standard `GET`/`POST` exports) and Cron, Supabase Postgres (psql via `op run`).

**Inputs:** master plan §"Rate it yourself", §"blindpanel: kit architecture", §Infrastructure, §Phase 4; `~/projects/studio/docs/blindpanel-phase3-calls.md` (Aaron's 29 Oct answers).

**Judgment calls:** logged as they are made in `~/projects/studio/docs/phase4-integration-calls.md`.

---

## Facts this plan relies on (checked 29 Oct)

- The built `study.json` holds `endpoints: { submit: "/api/submit", tally: "/api/tally", reveal: "reveal.json" }`, opaque codes, media URLs under `https://media.studionephele.com/blindpanel/stilldrawn/` and no per-item hashes. `modes.public.min_crowd_n` is 5.
- `reveal.json` items carry `link: https://stilldrawn.studionephele.com/explore?cell=<panel>_<motion>&e=<engine>`; engine ids (`gen4.5`, `gen4_turbo`, `h3-fal`, `ltx23`, `wan22`) match `web/public/data/v1/engines.json`.
- `mountResults` renders each link as a plain `<a href>`. `mountSession(...).on("complete", ({ submission }) => …)`; `destroy()` removes the kit's root and listeners. Progress persists in `localStorage` under `blindpanel:stilldrawn:A6`.
- The kit's CSS sits in `@layer blindpanel`, so unlayered host rules win.
- Server flags: `too_fast` when the rounded duration is under 0.5 × clips × 5 s (20 s for 8 clips); `straightline` when every answer is the same. The tally leaves flagged rows out, and shows a cell only once it has ≥ 5 answers.
- The Vercel project is framework "Other": no build command is needed, the output directory is `public` when it exists, and `npm install` runs when there is a `package.json`.
- Vercel Cron on Hobby: once a day at most, and it invokes **production** deployments only. Vercel sends `Authorization: Bearer $CRON_SECRET`.
- The Vercel automation bypass works as a header or as the query parameter `x-vercel-protection-bypass`, and `x-vercel-set-bypass-cookie=true` sets a cookie for the rest of the browser session. The tests use the query parameter on the first navigation only, so the secret never reaches the media host.
- psql is not installed; `brew install libpq` provides it (keg-only, `/opt/homebrew/opt/libpq/bin/psql`).

## File map

| Path | Responsibility |
|---|---|
| `tools/vendor-blindpanel.sh` | build and pack the kit from a clean commit; copy the study; write the lock |
| `web/vendor/blindpanel-0.1.0.tgz`, `web/vendor/blindpanel.lock.json` | the vendored kit and its provenance |
| `web/vendor/stilldrawn-banned-terms.txt` | test-only copy of the study's banned terms (never served) |
| `web/public/data/blindpanel/stilldrawn/{study,reveal}.json` | the built study, served static |
| `web/src/views/Rate/rateModel.ts` | pure helpers: localise reveal links, resolve study-relative URLs |
| `web/src/views/Rate/RatingPanel.tsx` | the React wrapper over `mountSession`/`mountResults` |
| `web/src/views/Rate/Rate.tsx`, `rate.css` | the `/rate` view and the token map |
| `web/api/_lib.ts` | env → allowed origins, store, handlers |
| `web/api/submit.ts`, `tally.ts`, `keepwarm.ts` | one-line route files |
| `tools/check-stage.mjs` | asserts the staged deploy folder's layout |
| `tools/supabase/check.sql` | the live privilege and RLS check, run as postgres |
| `web/e2e/rate.spec.ts` | local flow with mocked API (all four projects) |
| `web/e2e/live.config.ts`, `web/e2e/rate-live.spec.ts` | the same flow against the preview, real API |
| `~/projects/studio/tools/stilldrawn-supabase.env.op` | op references for psql and the Supabase key (hub, gitignored) |

---

### Task 1: Vendor the kit

**Files:**
- Create: `tools/vendor-blindpanel.sh`, `web/src/views/Rate/vendor.test.ts`
- Modify: `web/package.json` (dependency), `web/vite.config.ts` (test include)

- [ ] **Step 1: Write the failing test** (`web/src/views/Rate/vendor.test.ts`)

```ts
// @vitest-environment node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const at = (p: string) => new URL(`../../../${p}`, import.meta.url);
const sha = (p: string) => createHash("sha256").update(readFileSync(at(p))).digest("hex");

describe("vendored blindpanel", () => {
  const lock = JSON.parse(readFileSync(at("vendor/blindpanel.lock.json"), "utf8"));
  it("lock matches the tarball and the copied study", () => {
    expect(lock.version).toBe("0.1.0");
    expect(lock.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(sha(`vendor/blindpanel-${lock.version}.tgz`)).toBe(lock.tarball_sha256);
    expect(sha("public/data/blindpanel/stilldrawn/study.json")).toBe(lock.study.study_sha256);
    expect(sha("public/data/blindpanel/stilldrawn/reveal.json")).toBe(lock.study.reveal_sha256);
  });
  it("package.json installs the vendored tarball, and node_modules holds that version", () => {
    const pkg = JSON.parse(readFileSync(at("package.json"), "utf8"));
    expect(pkg.dependencies.blindpanel).toBe(`file:vendor/blindpanel-${lock.version}.tgz`);
    expect(JSON.parse(readFileSync(at("node_modules/blindpanel/package.json"), "utf8")).version).toBe(lock.version);
  });
  it("the banned-terms copy is test-only (not under public/)", () => {
    expect(existsSync(at("vendor/stilldrawn-banned-terms.txt"))).toBe(true);
    expect(existsSync(at("public/data/blindpanel/stilldrawn/banned-terms.txt"))).toBe(false);
  });
});
```

Add `"src/**/*.test.{ts,tsx}", "vite/**/*.test.ts", "api/**/*.test.ts"` to `test.include` in `web/vite.config.ts` (the api entry is for Task 4).

- [ ] **Step 2: Run it; expect FAIL** (`cd web && npx vitest run src/views/Rate/vendor.test.ts`: ENOENT on the lock).

- [ ] **Step 3: Write `tools/vendor-blindpanel.sh`**

```bash
#!/usr/bin/env bash
# Vendor blindpanel into web/: pack the kit from a CLEAN commit, build the StillDrawn study,
# copy study.json and reveal.json to web/public/data/blindpanel/stilldrawn/, and write
# web/vendor/blindpanel.lock.json (version, tag, commit, sha256s). Re-run after any kit change.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
kit="${BLINDPANEL_DIR:-$here/../blindpanel}"
vendor="$here/web/vendor"
studydir="$here/web/public/data/blindpanel/stilldrawn"
[ -z "$(git -C "$kit" status --porcelain)" ] || { echo "blindpanel has uncommitted changes; commit first" >&2; exit 1; }
commit="$(git -C "$kit" rev-parse HEAD)"
tag="$(git -C "$kit" describe --tags --exact-match 2>/dev/null || true)"
version="$(node -p "require('$kit/package.json').version")"
tmp="$(mktemp -d)"
(cd "$kit" && npm run build --silent && npm pack --silent --pack-destination "$tmp" >/dev/null)
(cd "$kit" && node bin/blindpanel.mjs build examples/stilldrawn/study.yaml --out "$tmp/study" >/dev/null)
mkdir -p "$vendor" "$studydir"
rm -f "$vendor"/blindpanel-*.tgz
cp "$tmp/blindpanel-$version.tgz" "$vendor/"
cp "$tmp/study/study.json" "$tmp/study/reveal.json" "$studydir/"
cp "$kit/examples/stilldrawn/banned-terms.txt" "$vendor/stilldrawn-banned-terms.txt"
sha() { shasum -a 256 "$1" | cut -d' ' -f1; }
cat > "$vendor/blindpanel.lock.json" <<JSON
{
  "package": "blindpanel",
  "version": "$version",
  "tag": ${tag:+\"$tag\"}${tag:-null},
  "commit": "$commit",
  "tarball": "blindpanel-$version.tgz",
  "tarball_sha256": "$(sha "$vendor/blindpanel-$version.tgz")",
  "study": {
    "source": "examples/stilldrawn/study.yaml",
    "study_sha256": "$(sha "$studydir/study.json")",
    "reveal_sha256": "$(sha "$studydir/reveal.json")"
  }
}
JSON
rm -rf "$tmp"
(cd "$here/web" && npm install --silent "blindpanel@file:vendor/blindpanel-$version.tgz" --save-exact)
echo "vendored blindpanel $version @ ${commit:0:7}${tag:+ ($tag)}"
```

- [ ] **Step 4: Run it, then the test; expect PASS.** `tools/vendor-blindpanel.sh && cd web && npx vitest run src/views/Rate/vendor.test.ts`. Check `web/package.json` reads `"blindpanel": "file:vendor/blindpanel-0.1.0.tgz"`.

- [ ] **Step 5: Commit** (after `~/projects/studio/tools/scan-identifiers.sh .`, checking its exit code): `chore: vendor blindpanel 0.1.0 as a tarball with a lock; StillDrawn study under data/blindpanel`.

### Task 2: Reveal links land in Explore

**Files:** Create `web/src/views/Rate/rateModel.ts`, `web/src/views/Rate/rateModel.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { clipFor, gridRows } from "../../data/model";
import type { Clip } from "../../data/types";
import { localiseReveal, studyRelative, SITE_ORIGIN } from "./rateModel";

const read = (p: string) => JSON.parse(readFileSync(new URL(`../../../public/${p}`, import.meta.url), "utf8"));

describe("rateModel", () => {
  it("rewrites the site's own links to in-app paths and leaves other links alone", () => {
    const r = localiseReveal({ study: "s", items: {
      a: { label: "X", link: `${SITE_ORIGIN}/explore?cell=c_idle&e=wan22` },
      b: { label: "Y", link: "https://doi.org/10.5281/zenodo.23072784" },
      c: { label: "Z" },
    } } as never);
    expect(r.items.a.link).toBe("/explore?cell=c_idle&e=wan22");
    expect(r.items.b.link).toBe("https://doi.org/10.5281/zenodo.23072784");
    expect(r.items.c.link).toBeUndefined();
  });
  it("resolves study-relative endpoints against the study URL", () => {
    expect(studyRelative("/data/blindpanel/stilldrawn/study.json", "reveal.json")).toBe("/data/blindpanel/stilldrawn/reveal.json");
    expect(studyRelative("/data/blindpanel/stilldrawn/study.json", "/api/submit")).toBe("/api/submit");
  });
  it("every revealed clip opens a real clip in Explore", () => {
    const reveal = localiseReveal(read("data/blindpanel/stilldrawn/reveal.json"));
    const clips: Clip[] = read("data/v1/clips.json");
    const rows = gridRows(clips, "standard");
    const links = Object.values(reveal.items).map((i) => i.link).filter(Boolean) as string[];
    expect(links).toHaveLength(20);
    for (const l of links) {
      const u = new URL(l, "http://x");
      expect(u.pathname).toBe("/explore");
      const cell = u.searchParams.get("cell")!, e = u.searchParams.get("e")!;
      expect(rows.some((r) => r.key === cell), cell).toBe(true);
      expect(clipFor(clips, cell, e), `${cell} ${e}`).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run; expect FAIL** (module not found).

- [ ] **Step 3: Implement `rateModel.ts`**

```ts
import type { Reveal } from "blindpanel";

/** The explorer's public origin; reveal.json links point here (the kit's example is host-agnostic otherwise). */
export const SITE_ORIGIN = "https://stilldrawn.studionephele.com";
export const STUDY_URL = "/data/blindpanel/stilldrawn/study.json";

/** Links into this site become in-app paths, so they work on any preview origin and route without a reload. */
export function localiseReveal(r: Reveal): Reveal {
  const items = Object.fromEntries(Object.entries(r.items).map(([code, it]) => {
    const link = it.link?.startsWith(SITE_ORIGIN + "/") ? it.link.slice(SITE_ORIGIN.length) : it.link;
    return [code, link === it.link ? it : { ...it, link }];
  }));
  return { ...r, items };
}

/** Resolves a study endpoint ("reveal.json" or "/api/submit") against the study's own URL. */
export function studyRelative(studyUrl: string, p: string) {
  return /^(https?:)?\//.test(p) ? p : studyUrl.replace(/[^/]*$/, "") + p;
}
```

(If `Reveal` is not exported from the package root, import it from where `blindpanel`'s `dist/core/index.d.ts` exports it; check with `grep -n Reveal web/node_modules/blindpanel/dist/core/index.d.ts`.)

- [ ] **Step 4: Run; expect PASS.** If `gridRows` keys rows differently from `cell=<panel>_<motion>`, the third test fails: that is a real broken link, so fix the reveal links in the kit's `prepare.mjs` (test first, CHANGELOG line), re-vendor, and re-run.

- [ ] **Step 5: Commit** `feat(rate): reveal links become in-app paths; test that each opens a real clip`.

### Task 3: The React wrapper and the `/rate` view

**Files:**
- Create: `web/src/views/Rate/RatingPanel.tsx`, `RatingPanel.test.tsx`, `Rate.tsx`, `rate.css`
- Modify: `web/src/App.tsx` (route, NotFound text), `web/src/shell/TopBar.tsx` (nav entry)

- [ ] **Step 1: Write the failing test** (`RatingPanel.test.tsx`)

```tsx
import { StrictMode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import type { Study } from "blindpanel";
import { RatingPanel } from "./RatingPanel";

const study = JSON.parse(readFileSync(new URL("../../../public/data/blindpanel/stilldrawn/study.json", import.meta.url), "utf8")) as Study;
afterEach(() => { cleanup(); localStorage.clear(); });

describe("RatingPanel", () => {
  it("mounts exactly one session under StrictMode and removes it on unmount", async () => {
    const { container, unmount } = render(<StrictMode><RatingPanel study={study} studyUrl="/s/study.json" /></StrictMode>);
    expect(container.querySelectorAll('[data-bp="session"]')).toHaveLength(1);
    unmount();
    expect(document.querySelectorAll('[data-bp="session"]')).toHaveLength(0);
  });
  it("keeps one saved session across the StrictMode remount", async () => {
    render(<StrictMode><RatingPanel study={study} studyUrl="/s/study.json" /></StrictMode>);
    await new Promise((r) => setTimeout(r, 50));
    const keys = Object.keys(localStorage).filter((k) => k.startsWith("blindpanel:"));
    expect(keys).toEqual([`blindpanel:${study.id}:${study.instrument}`]);
  });
});
```

- [ ] **Step 2: Run; expect FAIL.**

- [ ] **Step 3: Implement `RatingPanel.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { mountResults, mountSession, type ResultsController, type SessionController } from "blindpanel/ui";
import type { Reveal, Study } from "blindpanel";
import "blindpanel/ui/style.css";
import { navigate } from "../../router";
import { localiseReveal, studyRelative } from "./rateModel";

/**
 * blindpanel's framework-free UI inside React: one effect mounts the session and
 * destroys whatever is mounted on cleanup, so StrictMode's mount-unmount-mount
 * leaves exactly one session (progress survives in localStorage).
 */
export function RatingPanel({ study, studyUrl }: { study: Study; studyUrl: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [epoch, setEpoch] = useState(0);
  const [done, setDone] = useState(false);
  const session = useRef<SessionController | null>(null);

  useEffect(() => {
    const el = host.current!;
    let disposed = false;
    let results: ResultsController | null = null;
    const s = mountSession(el, study);
    session.current = s;
    s.on("complete", async ({ submission }) => {
      let reveal: Reveal;
      try {
        const r = await fetch(studyRelative(studyUrl, study.endpoints.reveal));
        if (!r.ok) throw new Error(String(r.status));
        reveal = localiseReveal((await r.json()) as Reveal);
      } catch {
        if (!disposed) el.insertAdjacentHTML("beforeend", '<p class="bp" role="alert">The results could not be loaded. Your answers are kept; reload to try again.</p>');
        return;
      }
      if (disposed) return;
      s.destroy();
      results = mountResults(el, {
        study, reveal, submission,
        onSubmit: async () => {
          const r = await fetch(study.endpoints.submit, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(submission) });
          return { ok: r.ok, status: r.status };
        },
        loadTally: async () => {
          const r = await fetch(study.endpoints.tally);
          if (!r.ok) throw new Error(String(r.status));
          return r.json();
        },
      });
      setDone(true);
    });
    // in-app links inside the kit's DOM route without a reload
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a");
      const href = a?.getAttribute("href");
      if (!a || !href?.startsWith("/") || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      navigate(href);
    };
    el.addEventListener("click", onClick);
    return () => {
      disposed = true;
      el.removeEventListener("click", onClick);
      s.destroy();
      results?.destroy();
      session.current = null;
    };
  }, [study, studyUrl, epoch]);

  const again = () => {
    session.current?.reset();
    localStorage.removeItem(`blindpanel:${study.id}:${study.instrument}`);
    setDone(false);
    setEpoch((n) => n + 1);
  };
  return (
    <>
      <div ref={host} className="rate-host" />
      {done && <p className="rate-again"><button type="button" className="btn" onClick={again}>Start a new session</button></p>}
    </>
  );
}
```

(`results.destroy()` must remove its DOM; if the kit's `destroy` leaves nodes, that is a kit bug: test first in the kit, fix, CHANGELOG, re-vendor. Before `again`'s `reset()`, the session ref may already be destroyed; `reset` only clears storage, so it is safe.)

- [ ] **Step 4: Implement `Rate.tsx` and `rate.css`**

```tsx
import { use } from "react";
import type { Study } from "blindpanel";
import "./rate.css";
import { RatingPanel } from "./RatingPanel";
import { STUDY_URL } from "./rateModel";

let pending: Promise<Study> | null = null;
const loadStudy = () => (pending ??= fetch(STUDY_URL).then((r) => {
  if (!r.ok) throw new Error(`The rating study could not be loaded (HTTP ${r.status}).`);
  return r.json() as Promise<Study>;
}));

export default function Rate() {
  const study = use(loadStudy());
  return (
    <main id="main" className="page rate">
      <h1 tabIndex={-1}>Rate it yourself</h1>
      <p className="muted rate-lede">Score eight clips blind, as the paper's six raters did, then see where you land against them and against the automatic metrics.</p>
      <RatingPanel study={study} studyUrl={STUDY_URL} />
    </main>
  );
}
```

```css
/* blindpanel themed by the explorer's tokens (docs/DESIGN.md): no new colours.
   The kit's rules sit in @layer blindpanel, so these unlayered ones win. */
.rate .bp {
  --bp-paper: var(--surface); --bp-ground: var(--ground); --bp-raised: var(--raised);
  --bp-ink: var(--text); --bp-muted: var(--muted); --bp-faint: var(--faint);
  --bp-line: var(--border); --bp-control: var(--control); --bp-context: var(--context);
  --bp-accent: var(--gold); --bp-accent-line: var(--gold-line); --bp-on-accent: var(--on-gold);
  --bp-font: var(--font); --bp-radius: 0; --bp-gap: var(--gap); --bp-ease: var(--ease);
  color-scheme: inherit;
}
.rate-lede { max-width: 60ch; }
.rate-again { margin-top: var(--gap); }
```

In `App.tsx`: `const Rate = lazy(() => import("./views/Rate/Rate"));`, `if (path === "/rate") return <Rate />;`, and add `, <Link href="/rate">Rate it yourself</Link>` to the NotFound sentence. In `TopBar.tsx` NAV add `{ href: "/rate", label: "Rate it yourself" }`.

- [ ] **Step 5: Run unit tests; expect PASS** (`npx vitest run`), then `npx tsc --noEmit`.

- [ ] **Step 6: Commit** `feat(rate): /rate mounts blindpanel through a StrictMode-safe React wrapper, themed by the explorer's tokens`.

### Task 4: API wrappers

**Files:** Create `web/api/_lib.ts`, `web/api/submit.ts`, `web/api/tally.ts`, `web/api/keepwarm.ts`, `web/api/api.test.ts`; modify `web/tsconfig.json` (`include` adds `"api"`).

- [ ] **Step 1: Write the failing test** (`web/api/api.test.ts`)

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { memoryStore } from "blindpanel/server";
import { allowedOrigins, handlers, loadStudy } from "./_lib.js";

const SITE = "https://stilldrawn.studionephele.com";
describe("api config", () => {
  it("allows the custom domain always and the deployment's own origins on previews only", () => {
    expect(allowedOrigins({})).toEqual([SITE]);
    expect(allowedOrigins({ VERCEL_ENV: "preview", VERCEL_URL: "x-abc.vercel.app", VERCEL_BRANCH_URL: "x-git-b.vercel.app" }))
      .toEqual([SITE, "https://x-abc.vercel.app", "https://x-git-b.vercel.app"]);
    expect(allowedOrigins({ VERCEL_ENV: "production", VERCEL_URL: "x-abc.vercel.app" })).toEqual([SITE]);
  });
  it("loads the same study the page serves", () => {
    expect(loadStudy().id).toBe("stilldrawn");
  });
  it("refuses to build a Supabase store without its env", () => {
    expect(() => handlers({})).toThrow(/SUPABASE_URL/);
  });
  it("wires submit (origin-checked), tally (cached) and keepwarm (bearer)", async () => {
    const h = handlers({ CRON_SECRET: "s" }, memoryStore());
    const bad = await h.submit(new Request(`${SITE}/api/submit`, { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example" }, body: "{}" }));
    expect(bad.status).toBe(403);
    const t = await h.tally(new Request(`${SITE}/api/tally`));
    expect(t.status).toBe(200);
    expect(t.headers.get("cache-control")).toMatch(/s-maxage=300/);
    expect((await h.keepwarm(new Request(`${SITE}/api/keepwarm`))).status).toBe(401);
    expect((await h.keepwarm(new Request(`${SITE}/api/keepwarm`, { headers: { authorization: "Bearer s" } }))).status).toBe(200);
  });
});
```

- [ ] **Step 2: Run; expect FAIL.**

- [ ] **Step 3: Implement**

`web/api/_lib.ts`:
```ts
import { readFileSync } from "node:fs";
import { createKeepwarmHandler, createSubmitHandler, createTallyHandler, supabaseStore, type Store } from "blindpanel/server";
import type { Study } from "blindpanel";

type Env = Record<string, string | undefined>;
const SITE = "https://stilldrawn.studionephele.com";

/** The custom domain, plus this deployment's own origins on a preview (Vercel's system env). */
export function allowedOrigins(env: Env) {
  const own = env.VERCEL_ENV === "preview" ? [env.VERCEL_URL, env.VERCEL_BRANCH_URL].filter(Boolean).map((h) => `https://${h}`) : [];
  return [SITE, ...own];
}

/** The study the page serves; vercel.json includeFiles ships it with each function. */
export const loadStudy = (): Study =>
  JSON.parse(readFileSync(new URL("../public/data/blindpanel/stilldrawn/study.json", import.meta.url), "utf8"));

export function handlers(env: Env, store?: Store) {
  const study = loadStudy();
  if (!store) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set");
    store = supabaseStore({ url: env.SUPABASE_URL, key: env.SUPABASE_SECRET_KEY });
  }
  return {
    submit: createSubmitHandler({ study, store, allowedOrigins: allowedOrigins(env) }),
    tally: createTallyHandler({ study, store }),
    keepwarm: createKeepwarmHandler({ store, secret: env.CRON_SECRET, study: study.id }),
  };
}
```

`web/api/submit.ts`: `import { handlers } from "./_lib.js";\nexport const POST = (req: Request) => handlers(process.env).submit(req);`
`web/api/tally.ts`: same with `export const GET = (req: Request) => handlers(process.env).tally(req);`
`web/api/keepwarm.ts`: same with `.keepwarm`.

(Building the handlers per request keeps a missing env var a 500 at request time instead of a crashed cold start; the cost is one small JSON parse.)

- [ ] **Step 4: Run; expect PASS**, then `npx tsc --noEmit`.

- [ ] **Step 5: Commit** `feat(api): submit, tally and keepwarm as thin wrappers over blindpanel/server`.

### Task 5: Local end-to-end flow (mocked API)

**Files:** Create `web/e2e/rate.spec.ts`, `web/e2e/rateFlow.ts` (shared with Task 9).

- [ ] **Step 1: Write the flow helper and spec.** `rateFlow.ts` exports `runSession(page, { keyboard })`: seeds a fixed session id through `addInitScript` (as the kit's StillDrawn e2e does), presses Start, rates each still 5, answers each clip with the panel's rounded mean (from `reveal.json`, read on the test side only), by mouse or by number keys and Enter, until "Done". `rate.spec.ts`:
  1. **blinding:** before "See where you land", the page HTML matches no regex from `vendor/stilldrawn-banned-terms.txt` (with its own flags) and no request URL contains `reveal.json` or an engine id;
  2. **results:** "Where you land" visible; each reveal row's "Open" link has a `/explore?cell=` href; clicking one routes in-app (no document reload: a `window.__marker` survives) and the Explore h1 names the clip's panel;
  3. **opt-in:** mock `POST /api/submit` (200) and `GET /api/tally`; clicking the opt-in sends exactly one POST whose body's `session` equals the seeded id; a second click sends nothing;
  4. **theme:** `getComputedStyle(.bp).getPropertyValue('--bp-paper')` resolves to the same colour as `--surface` on `:root`;
  5. **keyboard:** a whole session by keyboard only (Tab to Start, number keys, Enter);
  6. every test: no horizontal overflow (`scrollWidth <= innerWidth`), console clean (the existing `fixtures.ts`).
- [ ] **Step 2: Run; expect FAIL** before Task 3 is wired (or on any real bug); then PASS across all four projects: `cd web && npx playwright test -c e2e/playwright.config.ts e2e/rate.spec.ts`.
- [ ] **Step 3: Run the whole e2e suite** to prove nothing else broke (nav gained a link).
- [ ] **Step 4: Commit** `test(rate): blinded flow, reveal links into Explore, single opt-in POST, keyboard-only, themed, no overflow`.

### Task 6: Stage functions with the vendored tarball

**Files:** Create `tools/check-stage.mjs`; modify `tools/stage-preview.sh`, `REDEPLOY.md`.

- [ ] **Step 1: Write the check (failing against today's stage).** `tools/check-stage.mjs <dir>` asserts:
  - `public/index.html`, `public/data/v1/index.json`, `public/data/blindpanel/stilldrawn/study.json` exist and the study is byte-identical to `web/public/…`;
  - `api/submit.ts`, `api/tally.ts`, `api/keepwarm.ts`, `api/_lib.ts` exist, and no `*.test.ts` was staged;
  - `package.json` is `{ private, type: "module", engines.node "24.x", dependencies.blindpanel "file:vendor/blindpanel-<v>.tgz" }`, `package-lock.json` exists, and `vendor/blindpanel-<v>.tgz` hashes to the lock's `tarball_sha256`;
  - `vercel.json` has `crons: [{ path: "/api/keepwarm", schedule: "<m> <h> * * *" }]` (daily), `functions["api/*.ts"].includeFiles` covering the study, a rewrite that excludes `api/`, `assets/`, `data/` and `favicon`, and the `X-Robots-Tag: noindex, nofollow` header;
  - nothing named `.env*`, `node_modules`, `*.op` or `banned-terms` anywhere in the folder.

  Run `node tools/check-stage.mjs deploy/preview`; expect FAIL (no `public/`).
- [ ] **Step 2: Change `stage-preview.sh`:** rsync `web/dist/` to `$out/public/`; copy `web/api/*.ts` except tests to `$out/api/`; copy `web/vendor/blindpanel-*.tgz` to `$out/vendor/`; write `package.json`, run `npm install --package-lock-only --silent` in `$out`; write `vercel.json`:

```json
{
  "rewrites": [{ "source": "/((?!api/|assets/|data/|favicon).*)", "destination": "/index.html" }],
  "functions": { "api/*.ts": { "includeFiles": "public/data/blindpanel/stilldrawn/study.json" } },
  "crons": [{ "path": "/api/keepwarm", "schedule": "17 6 * * *" }],
  "headers": [{ "source": "/(.*)", "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }] }]
}
```
  then end with `node "$here/tools/check-stage.mjs" "$out"`. The rsync `--delete` keeps `.vercel/`.
- [ ] **Step 3: Run `tools/stage-preview.sh`; expect the check to PASS.**
- [ ] **Step 4: Update REDEPLOY.md** (layout, the vendoring step, env vars, cron production-only) and commit `chore(deploy): stage the API functions with the vendored kit; daily keep-warm cron`.

### Task 7: The live database

**Files:** Create `tools/supabase/check.sql`; hub file `~/projects/studio/tools/stilldrawn-supabase.env.op` (gitignored; never in this repo).

- [ ] **Step 1: Write `tools/supabase/check.sql`** — `\set ON_ERROR_STOP on`, then one `DO` block that `RAISE EXCEPTION`s on the first failure and `RAISE NOTICE`s each pass:
  - `blindpanel.submissions` and `blindpanel.settings` have `relrowsecurity` and `relforcerowsecurity` true, and `pg_policies` has no rows for the schema;
  - for `anon` and `authenticated`: no `USAGE` on the schema; no `SELECT/INSERT/UPDATE/DELETE/TRUNCATE` on either table; no `EXECUTE` on `blindpanel.tally(text,integer)` or `blindpanel.enforce_caps()`;
  - for `service_role`: `SELECT` and `INSERT` on submissions; no `UPDATE/DELETE/TRUNCATE`; nothing on settings; `EXECUTE` on `tally`; no `EXECUTE` on `enforce_caps`;
  - then real attempts in a rolled-back transaction: `set local role anon; select … from blindpanel.submissions` raises `insufficient_privilege`; `set local role service_role; delete from blindpanel.submissions` raises `insufficient_privilege`; `select blindpanel.tally('stilldrawn')` as service_role returns `n_sessions`.
- [ ] **Step 2: Install psql and write the hub env file.** `brew install libpq`. Find the project ref and pooler host with the supabase CLI signed in as Aaron (`supabase projects list -o json`, filtered to `stilldrawn-explorer`, never printed whole). The env file holds `PGHOST` (the session pooler for London), `PGPORT=5432`, `PGUSER=postgres.<ref>`, `PGDATABASE=postgres`, `PGSSLMODE=require`, `PGPASSWORD=` a 1Password secret reference (vault and item IDs from a `--fields label=…` metadata call) (IDs from a `--fields label=…` metadata call), `SUPABASE_URL=https://<ref>.supabase.co`, and later `SUPABASE_SECRET_KEY=` as a secret reference.
- [ ] **Step 3: Run the check before the schema; expect FAIL** (schema missing): `op run --env-file=$HOME/projects/studio/tools/stilldrawn-supabase.env.op -- psql -f tools/supabase/check.sql`.
- [ ] **Step 4: Apply the schema**: `op run … -- psql -v ON_ERROR_STOP=1 -f ../blindpanel/sql/schema.sql`. Then **run the check; expect PASS.** Run the schema a second time (idempotence), and the check again.
- [ ] **Step 5: Commit** `chore(db): live privilege and RLS check for the blindpanel schema`. Record the round in STATUS.md.

### Task 8: Aaron's steps, then env vars and the preview deploy

- [ ] **Step 1: Ask Aaron** (one message, all at once):
  1. Supabase → Settings → API → Exposed schemas: add `blindpanel`.
  2. Store the project's secret key (`sb_secret_…`): `~/.claude/scripts/op-new.sh "Supabase stilldrawn-explorer secret key" credential <Personal – Dev vault id>`.
  3. Vercel → project → Settings → Deployment Protection → Protection Bypass for Automation: create a secret and store it the same way ("Vercel stilldrawn-explorer bypass").
  4. A cron secret: `openssl rand -hex 32`, stored the same way ("Vercel stilldrawn-explorer cron secret"), so the keep-warm endpoint can be called by hand as well as by the cron.
- [ ] **Step 2: Wire the references** (metadata-only `op item get … --fields label=…` for IDs) into the hub env files: `SUPABASE_SECRET_KEY` in `stilldrawn-supabase.env.op`; `VERCEL_BYPASS` and `CRON_SECRET` in `stilldrawn-explorer.env.op`. Verify each resolves with the length-and-prefix pattern only.
- [ ] **Step 3: Add preview env vars**, values piped and never echoed:
  `op read "<ref>" | vercel env add SUPABASE_SECRET_KEY preview --scope "$VERCEL_SCOPE"` (and `SUPABASE_URL`, `CRON_SECRET`), run under `op run` for `VERCEL_TOKEN`. `vercel env ls preview` shows the three names.
- [ ] **Step 4: Deploy the preview**: `tools/deploy-preview.sh`. Then smoke: with the bypass header, `GET /api/tally` → 200 with `cache-control: public, s-maxage=300, stale-while-revalidate=3600`; `GET /api/keepwarm` without a bearer → 401, with `Bearer $CRON_SECRET` → 200; `GET /rate` → 200 (the SPA).

### Task 9: Verify on the preview

**Files:** Create `web/e2e/live.config.ts`, `web/e2e/rate-live.spec.ts`, `tools/live-seed.mjs`.

- [ ] **Step 1: `live.config.ts`** reuses the four projects with `baseURL: process.env.PREVIEW_URL` and no web server. The bypass is applied by one first navigation to `?x-vercel-protection-bypass=…&x-vercel-set-bypass-cookie=true` (never `extraHTTPHeaders`, which would send the secret to the media host).
- [ ] **Step 2: `rate-live.spec.ts`** runs `runSession` against the real API in all four projects; the `desktop-light` project alone opts in, with the session's stored `seconds` seeded to 300 so the row is not flagged `too_fast` (recorded as test-only). It asserts one 200 response from `/api/submit`, and a second click sends nothing. Console clean, no overflow, keyboard run as in Task 5.
- [ ] **Step 3: Row checks with psql as postgres:** count rows for `study = 'stilldrawn'` before and after: exactly +1.
- [ ] **Step 4: The tally at n ≥ 5.** `tools/live-seed.mjs` posts 4 more valid, unflagged submissions through the preview's `/api/submit` (built with the kit's `participantOrder` and `buildSubmission` for random session ids, extended to all 20 clips so every cell is covered; 300 s durations; varied answers). It needs the bypass and the preview origin. Then `GET /api/tally?fresh=<ts>` (a new cache key) shows `n_sessions` = 5 and cells with `n: 5` for the clips all five sessions saw.
- [ ] **Step 5: `blindpanel report --store supabase`** from the kit (`op run … -- node bin/blindpanel.mjs report examples/stilldrawn/study.yaml --store supabase`) lists the 5 sessions.
- [ ] **Step 6: Clean up** as postgres: `delete from blindpanel.submissions where study = 'stilldrawn' returning id` (only test rows exist: the table was empty before Task 9). Record the count in LOG.md. Re-count: 0. Tally `n_sessions` 0 on a fresh key.
- [ ] **Step 7: Screenshots** at 1440 and 390, light and dark, of `/rate` mid-session and on results, for Aaron.

### Task 10: Records

- [ ] Both STATUS files: rounds, Phase 4 result; LOG.md public-safe notes; the explorer README's run section mentions `/rate` and the vendoring step.
- [ ] The judgment-call log at `~/projects/studio/docs/phase4-integration-calls.md`; hub `STATUS.md` and `session-log.md`; studio memory updated.
- [ ] Stop before Phase 5. Present the calls and the preview to Aaron.
