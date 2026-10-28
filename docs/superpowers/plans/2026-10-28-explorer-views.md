# Explorer views (sub-plan B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to work through this plan task by task. Steps use `- [ ]` checkboxes.

**Goal:** the StillDrawn Explorer's three views (Explore, Motion vs drift, Stillness Tax) built on the v1 data contract, served with local media in dev, and shipped to a private Vercel preview for gate G4.

**Architecture:**
- `pipeline/` gains `media.py` (derivation half of task 7): posters, frame-0 PNGs and panel WebPs via ffmpeg into `pipeline/out/media/`, laid out exactly as R2 will be. Clips are symlinks to the release's `runs/` files, never re-encoded.
- `web/` is Vite + React + TypeScript with no router or state library: a 60-line history router keeps every view's state in the query string.
- `src/lib/` (stats, lenses, pareto) is a TypeScript port of `pipeline/stilldrawn_web/lenses.py`, parity-tested against `__fixtures__/lenses.json` (ranks exact, values to 1e-9).
- Media URLs resolve against `MEDIA_BASE`: `VITE_MEDIA_BASE` when set (dev: `/media/`, served from `pipeline/out/media` by a Vite plugin with Range support), else `index.json`'s `media_base` (R2).
- Every figure quoted from the paper is read from `paper.json`. Live lens and per-clip numbers are computed from `clips.json` / the fixtures' basis by the parity-tested lib. No number is typed into the UI.

**Tech stack:** Node 24 LTS target (`engines >=22`), npm with `--save-exact` and a committed lockfile. Vite 8.3.5, React 19.3.1, TypeScript 7.0.2, @vitejs/plugin-react 6.1.2, d3-scale 4.0.2, d3-shape 3.2.0, d3-array 3.2.4, Vitest 5.0.5 with jsdom 30.1.3 and @testing-library/react 16.3.3, @playwright/test 1.64.1. Python 3.12 + uv for the pipeline, ffmpeg 9.

**About code in this plan.** Logic modules (lib, router, data, media plugin, media.py) are given in full. View markup is decided by Task 3's design direction, so each view task gives its behaviour contract, its tests in full and the load-bearing snippets (frame sync, difference blend, FLIP), not finished JSX.

---

## Facts this plan relies on (checked 28 Oct)

- Contract: `web/public/data/v1/{index,engines,panels,clips,paper,taxonomy}.json`, `series/<engine>.json` (keyed by clip id; `line`, `iou`, `style` have n_frames − 1 values, `edge` and `closure` n_frames, `tone` may be null, `motion` 60 or 61 at stride 2), `study/stilldrawn.json`.
- `clips.json`: 373 rows; arms primary 164, repeat 98, hazard 71, ground 25, seedance 9, flint 6. A clip's `cell` drops the draw suffix, so repeats (`-r2`) and hazard draws (`-h1…-h10`) share their primary clip's cell. Draws seen: r1, r2, h1–h10.
- `index.json.missing_cells`: `cu-tone-3_idle_gen4t`, "Refused by the engine's moderation (runs/README.md)".
- Fixture `lenses.json`: `basis` (164 rows `{id, engine, motion, drift}`), `summary`, `pareto`, `pairwise` (10 pairs, 8 overlap), `crossovers`, `price` (p ∈ 0, 0.5, 1, 1.24, 1.25, 1.3, 2, 3), `floor` (f ∈ 0 … 0.01), `band` (8 overlapping presets), `ref_engine` = wan22, `min_n` = 5.
- Engine ids sort by code point (`gen4.5` < `gen4_turbo` because `.` < `_`). **Never use `localeCompare` for tie-breaks**; it disagrees with Python.
- Release clips: `~/projects/stilldrawn/runs/<engine>/<id>.mp4`. Panels: `dataset/panels/<id>.png`. Zips: `stilldrawn-clips-<engine>-v1.0.0.zip` (`zenodo/pack.sh`).
- Clips carry no colour tags (`color_space` unknown). Browsers decode untagged HD as BT.709; ffmpeg's swscale defaults to BT.601. Frame-0 PNGs must be converted as BT.709 limited → full range or the difference view shows a tint (Task 2 measures this).
- Within-engine ρ(motion, metric) lives in `motion_confound.json` `q2_within_engine_motion_vs_metric` (and `q2_pooled`); not yet in `paper.json` (Task 1 adds it).
- Vercel: the personal Hobby team named under "Accounts" in the rating study's REDEPLOY.md, never the company team. Its slug lives in gitignored `.env.local` as `VERCEL_SCOPE`, so no team name is committed. Token via `op run`, never `--token`.

## File map

```
pipeline/stilldrawn_web/export.py   + engines[].zip, paper.within_engine_rho, paper.pooled_rho
pipeline/stilldrawn_web/media.py    derive(root, out) → posters/, frame0/, panels/, clips/ symlinks; idempotent
pipeline/tests/test_media.py
pipeline/out/media/                 gitignored; mirrors R2: clips/<engine>/<id>.mp4 · panels/<id>.png|.webp · posters/<id>.webp · frame0/<id>.png
docs/DESIGN.md                      direction, tokens, engine palette (Task 3)
web/package.json  package-lock.json  tsconfig.json  vite.config.ts  index.html  .env.development
web/vite/media-dev.ts               dev middleware: /media/* from pipeline/out/media, Range-aware, follows symlinks
web/src/main.tsx  App.tsx  router.ts
web/src/theme/tokens.css  base.css
web/src/data/types.ts  load.ts  media.ts  model.ts   (model: grid rows, draws, ranks, cell keys)
web/src/lib/stats.ts  lenses.ts  pareto.ts  format.ts  (+ *.test.ts)
web/src/views/Explore/  Explore.tsx Grid.tsx Player.tsx useFrameClock.ts DriftCurve.tsx Readouts.tsx Provenance.tsx Compare.tsx FailureGallery.tsx
web/src/views/Scatter/  Scatter.tsx
web/src/views/Tax/      Tax.tsx LensControls.tsx Leaderboard.tsx flip.ts ParetoChart.tsx
web/e2e/                playwright.config.ts  *.spec.ts
tools/stage-preview.sh              builds web/, stages deploy/preview/ with a media subset and vercel.json
deploy/                             gitignored staging (keeps .vercel/ link)
```

---

## Task 1: contract additions (pipeline)

**Files:** modify `pipeline/stilldrawn_web/export.py`; test `pipeline/tests/test_export.py`.

- [ ] **Step 1: failing tests** (append to `tests/test_export.py`, reusing its `built` fixture that runs `export.main` into a tmp dir):

```python
def test_engines_name_their_zenodo_zip(built):
    engines = json.loads((built / "engines.json").read_text())
    by = {e["id"]: e for e in engines}
    assert by["gen4.5"]["zip"] == "stilldrawn-clips-gen4.5-v1.0.0.zip"
    assert by["seedance"]["zip"] == "stilldrawn-clips-seedance-v1.0.0.zip"


def test_paper_carries_within_engine_and_pooled_rho(built):
    paper = json.loads((built / "paper.json").read_text())
    w = paper["within_engine_rho"]
    assert "q2_within_engine_motion_vs_metric" in w["source"]
    assert w["value"]["gen4.5"]["line"]["n"] == 33
    assert abs(w["value"]["gen4.5"]["line"]["rho"] - 0.43014705882352944) < 1e-12
    pooled = paper["pooled_rho"]["value"]
    assert pooled["line"]["n"] == 164
```

- [ ] **Step 2:** `cd pipeline && uv run pytest tests/test_export.py -q`. Expect 2 FAIL (KeyError `zip`, `within_engine_rho`).
- [ ] **Step 3: implement.** In `export.py`:

```python
RELEASE_VERSION = "1.0.0"   # zenodo/pack.sh default V
METRIC_KEYS = {"line": "line_chamfer_mean_px", "tone": "tone_variance", "edge": "edge_abs_slope",
               "style": "style_terminal", "closure": "closure_abs_terminal"}

def build_engines(root):
    mv = model_versions(root)
    return [{"id": e, **meta, "model_version": mv.get(e), "notice": e in NOTICE_ENGINES,
             "zip": f"stilldrawn-clips-{e}-v{RELEASE_VERSION}.zip"}
            for e, meta in ENGINES.items()]

def _q2(mc: dict) -> tuple[dict, dict]:
    within = {e: {k: mc["q2_within_engine_motion_vs_metric"][e][src] for k, src in METRIC_KEYS.items()}
              for e in mc["q2_within_engine_motion_vs_metric"]}
    pooled = {k: mc["q2_pooled"][src] for k, src in METRIC_KEYS.items()}
    return within, pooled
```

  `build_paper` gains a `mc` argument (the parsed `motion_confound.json`, already read in `main`) and two entries:

```python
        "within_engine_rho": _src(within, f"{q} q2_within_engine_motion_vs_metric (Spearman, scipy p)"),
        "pooled_rho": _src(pooled, f"{q} q2_pooled"),
```

- [ ] **Step 4:** `uv run pytest -q`. Expect 41 passed. Re-export: `uv run python -m stilldrawn_web.export`.
- [ ] **Step 5:** `~/projects/studio/tools/scan-identifiers.sh .` → clean; commit `feat(pipeline): zip names and within-engine rho in the contract`.

## Task 2: media derivation (pipeline task 7, derivation half)

**Files:** create `pipeline/stilldrawn_web/media.py`, `pipeline/tests/test_media.py`; modify `.gitignore` (`pipeline/out/`, `deploy/`).

Layout under `pipeline/out/media/` (mirrors `stilldrawn/v1.0.0/` on R2):
- `clips/<engine>/<id>.mp4`: **symlink** to `<root>/runs/<engine>/<id>.mp4`
- `panels/<id>.png`: symlink to `<root>/dataset/panels/<id>.png`; `panels/<id>.webp`: display copy, max width 1344, quality 85
- `posters/<id>.webp`: frame 96, scaled to 640 px wide, quality 78 (frame 96 shows the drift; frame 0 is just the panel)
- `frame0/<id>.png`: frame 0 at native resolution, BT.709 limited → full-range RGB

- [ ] **Step 1: failing tests** (`tests/test_media.py`; the release is the conftest `root`):

```python
import os, subprocess
from pathlib import Path
import pytest
from stilldrawn_web import media
from stilldrawn_web.load import load_clips

ONE = "act-tone-2_campush_wan22"

@pytest.fixture(scope="module")
def out(tmp_path_factory, root):
    out = tmp_path_factory.mktemp("media")
    clips = [c for c in load_clips(root) if c.cid.id in {ONE, "act-tone-2_campush_gen45"}]
    media.derive(root, out, clips=clips, panels=["act-tone-2"])
    return out

def test_clip_is_a_symlink_to_the_release_file(out, root):
    p = out / "clips" / "wan22" / f"{ONE}.mp4"
    assert p.is_symlink()
    assert p.resolve() == (root / "runs" / "wan22" / f"{ONE}.mp4").resolve()

def test_frame0_is_native_size_png(out):
    w, h = media.png_size(out / "frame0" / f"{ONE}.png")
    assert (w, h) == (1280, 704)

def test_poster_and_panel_webp_exist(out):
    assert (out / "posters" / f"{ONE}.webp").stat().st_size > 1000
    assert (out / "panels" / "act-tone-2.webp").stat().st_size > 1000
    assert (out / "panels" / "act-tone-2.png").is_symlink()

def test_rerun_is_idempotent(out, root):
    before = {p: p.stat().st_mtime_ns for p in out.rglob("*") if p.is_file() and not p.is_symlink()}
    clips = [c for c in load_clips(root) if c.cid.id == ONE]
    stats = media.derive(root, out, clips=clips, panels=["act-tone-2"])
    assert stats["written"] == 0
    after = {p: p.stat().st_mtime_ns for p in before}
    assert before == after

def test_frame0_matches_bt709_decode(out, root):
    """Our PNG must equal ffmpeg's BT.709 decode of frame 0 (what browsers show for untagged HD)."""
    ref = subprocess.run(["ffmpeg", "-v", "error", "-i", str(root / "runs/wan22" / f"{ONE}.mp4"),
                          "-frames:v", "1", "-vf", media.RGB_FILTER, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         capture_output=True, check=True).stdout
    got = subprocess.run(["ffmpeg", "-v", "error", "-i", str(out / "frame0" / f"{ONE}.png"),
                          "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    assert got == ref
```

- [ ] **Step 2:** `uv run pytest tests/test_media.py -q`. Expect FAIL (no module `media`).
- [ ] **Step 3: implement** `media.py`:

```python
"""Derive the explorer's display media from the public release, laid out as on R2.

Clips are symlinked, never re-encoded (288 carry C2PA signatures). Only posters,
frame-0 references and panel display copies are derived, with ffmpeg.
"""
import os, struct, subprocess, sys
from pathlib import Path

from .load import load_clips, release_root

POSTER_FRAME = 96
# Untagged HD: browsers decode as BT.709 limited range. Match it, or the difference view tints.
RGB_FILTER = "scale=in_color_matrix=bt709:in_range=tv:out_range=pc,format=rgb24"
OUT = Path(__file__).resolve().parents[1] / "out" / "media"


def png_size(p: Path) -> tuple[int, int]:
    with open(p, "rb") as f:
        f.read(16)
        return struct.unpack(">II", f.read(8))


def _fresh(dst: Path, src: Path) -> bool:
    return dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime


def _link(dst: Path, src: Path) -> bool:
    if dst.is_symlink() and dst.resolve() == src.resolve():
        return False
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.is_symlink() or dst.exists():
        dst.unlink()
    dst.symlink_to(src.resolve())
    return True


def _ffmpeg(args: list[str]) -> None:
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)


def derive(root: Path | None = None, out: Path = OUT, clips=None, panels=None) -> dict:
    root = release_root(root)
    clips = load_clips(root) if clips is None else clips
    panel_dir = root / "dataset" / "panels"
    panels = sorted(p.stem for p in panel_dir.glob("*.png")) if panels is None else panels
    written = linked = 0
    for c in clips:
        src = c.mp4_path
        linked += _link(out / "clips" / c.cid.engine_dir / f"{c.cid.id}.mp4", src)
        f0 = out / "frame0" / f"{c.cid.id}.png"
        if not _fresh(f0, src):
            f0.parent.mkdir(parents=True, exist_ok=True)
            _ffmpeg(["-i", str(src), "-frames:v", "1", "-vf", RGB_FILTER, str(f0)])
            written += 1
        po = out / "posters" / f"{c.cid.id}.webp"
        if not _fresh(po, src):
            po.parent.mkdir(parents=True, exist_ok=True)
            _ffmpeg(["-i", str(src), "-vf", f"select=eq(n\\,{POSTER_FRAME}),scale=640:-2:flags=lanczos,{RGB_FILTER}",
                     "-frames:v", "1", "-c:v", "libwebp", "-quality", "78", str(po)])
            written += 1
    for pid in panels:
        src = panel_dir / f"{pid}.png"
        linked += _link(out / "panels" / f"{pid}.png", src)
        wp = out / "panels" / f"{pid}.webp"
        if not _fresh(wp, src):
            _ffmpeg(["-i", str(src), "-vf", "scale='min(1344,iw)':-2:flags=lanczos", "-c:v", "libwebp",
                     "-quality", "85", str(wp)])
            written += 1
    return {"written": written, "linked": linked, "clips": len(clips), "panels": len(panels)}


if __name__ == "__main__":
    print(derive(Path(sys.argv[1]) if len(sys.argv) > 1 else None))
```

  If `load.py`'s `Clip` names the mp4 path or engine directory differently (`mp4_path`, `cid.engine_dir`), use its names; do not add duplicates.
- [ ] **Step 4:** `uv run pytest -q`. Expect all pass. Then the full run: `uv run python -m stilldrawn_web.media`. Expect `{'written': 780, …, 'clips': 373, 'panels': 34}`; a second run reports `written: 0`. Record the total size of posters, frame0 and panel WebPs (`du -sh pipeline/out/media/{posters,frame0,panels}`).
- [ ] **Step 5:** scan, commit `feat(pipeline): derive posters, frame-0 references and panel webps (clips symlinked)`.

## Task 3: design direction

**Files:** create `docs/DESIGN.md`.

- [ ] Run `design-taste-frontend` in its **app-screens** run (Explore and Tax are screens people work in), seeded from the site concept: paper `#e2e2de`, surface `#d3d3ce`, ink `#1c1915`, muted `#574e44`, one gold `#c4922a` (hi `#d6a43c`), Schibsted Grotesk 400/600/800, square corners, 12 px gutter, the contact-sheet idea. **Gold marks only the selection** (selected cell, the pinned compare engine, the current leader under a lens, the playhead) and the one primary action.
- [ ] Run the `dataviz` skill for the engine palette: 6 categorical hues (5 analysed engines + Seedance) that pass its validator against paper and against the dark theme's ground, keep clear of gold (no hue within ~25° of `#c4922a`), and stay distinguishable for deuteranopia. Engines are also always labelled directly (never colour alone).
- [ ] Define the dark theme (ink ground, paper text, same gold), the type scale for dense screens (body 15–16 px, small 13 px, tabular numerals for readouts), focus ring (3 px gold), motion tokens (one ease, 160/240 ms; reduced motion = instant).
- [ ] Write `docs/DESIGN.md`: idea sentence, tokens (both themes), engine palette with validator output, layout per view at 1440 and 390, what gold is allowed to mark. Commit `docs: design direction for the explorer views`.

## Task 4: scaffold `web/`

**Files:** `web/package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `vite/media-dev.ts`, `index.html`, `.env.development`, `src/main.tsx`, `src/App.tsx`, `src/theme/*.css`; test `vite/media-dev.test.ts`.

- [ ] **Step 1:** create the project by hand (no template, so nothing unpinned sneaks in):

```bash
cd web
npm init -y
npm i --save-exact react@19.3.1 react-dom@19.3.1 d3-scale@4.0.2 d3-shape@3.2.0 d3-array@3.2.4
npm i --save-exact -D vite@8.3.5 @vitejs/plugin-react@6.1.2 typescript@7.0.2 vitest@5.0.5 jsdom@30.1.3 \
  @testing-library/react@16.3.3 @playwright/test@1.64.1 @types/react@19.3.0 @types/react-dom@19.3.0 \
  @types/d3-scale@4.0.9 @types/d3-shape@3.2.0 @types/d3-array@3.2.2 @types/node@24
```

  `package.json`: `"private": true, "type": "module", "engines": {"node": ">=22"}`, scripts `dev` (`vite`), `build` (`tsc --noEmit && vite build`), `test` (`vitest run`), `e2e` (`playwright test -c e2e/playwright.config.ts`). Repo root `.nvmrc`: `24`.
- [ ] **Step 2: failing test** for the dev media server (`web/vite/media-dev.test.ts`):

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { mediaHandler } from "./media-dev";

let base = "";
beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "media-"));
  mkdirSync(join(dir, "clips/wan22"), { recursive: true });
  const real = join(dir, "real.mp4");
  writeFileSync(real, Buffer.from("0123456789"));
  symlinkSync(real, join(dir, "clips/wan22/x.mp4"));
  const h = mediaHandler(dir);
  const srv = createServer((req, res) => h(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise<void>((r) => srv.listen(0, r));
  base = `http://127.0.0.1:${(srv.address() as any).port}`;
});

describe("media dev server", () => {
  it("serves a symlinked clip with the right type", async () => {
    const r = await fetch(`${base}/media/clips/wan22/x.mp4`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("video/mp4");
    expect(await r.text()).toBe("0123456789");
  });
  it("answers a Range request with 206", async () => {
    const r = await fetch(`${base}/media/clips/wan22/x.mp4`, { headers: { Range: "bytes=2-5" } });
    expect(r.status).toBe(206);
    expect(r.headers.get("content-range")).toBe("bytes 2-5/10");
    expect(await r.text()).toBe("2345");
  });
  it("refuses path traversal", async () => {
    const r = await fetch(`${base}/media/..%2F..%2Fetc%2Fpasswd`);
    expect(r.status).toBe(404);
  });
});
```

- [ ] **Step 3:** `npx vitest run vite/media-dev.test.ts`. Expect FAIL (module missing).
- [ ] **Step 4: implement** `web/vite/media-dev.ts`:

```ts
// Dev only: serve pipeline/out/media at /media/, as R2 will. Range-aware so <video> can seek.
import { createReadStream, statSync } from "node:fs";
import { resolve, sep, extname } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const TYPES: Record<string, string> = { ".mp4": "video/mp4", ".png": "image/png", ".webp": "image/webp" };

export function mediaHandler(root: string) {
  const top = resolve(root);
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = decodeURIComponent((req.url ?? "").split("?")[0]);
    if (!url.startsWith("/media/")) return next();
    const file = resolve(top, "." + url.slice("/media".length));
    if (!file.startsWith(top + sep)) return next();
    let size: number;
    try { size = statSync(file).size; } catch { return next(); }
    res.setHeader("Content-Type", TYPES[extname(file)] ?? "application/octet-stream");
    res.setHeader("Accept-Ranges", "bytes");
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
    if (m) {
      const start = m[1] ? Number(m[1]) : size - Number(m[2]);
      const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
      if (start > end || start >= size) { res.statusCode = 416; res.setHeader("Content-Range", `bytes */${size}`); return res.end(); }
      res.statusCode = 206;
      res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
      res.setHeader("Content-Length", String(end - start + 1));
      return void createReadStream(file, { start, end }).pipe(res);
    }
    res.setHeader("Content-Length", String(size));
    createReadStream(file).pipe(res);
  };
}

export function mediaDev(root: string): Plugin {
  return { name: "media-dev", apply: "serve", configureServer: (s) => void s.middlewares.use(mediaHandler(root)) };
}
```

  `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { mediaDev } from "./vite/media-dev";

const MEDIA = fileURLToPath(new URL("../pipeline/out/media", import.meta.url));
export default defineConfig({
  plugins: [react(), mediaDev(MEDIA)],
  test: { environment: "jsdom", include: ["src/**/*.test.ts?(x)", "vite/**/*.test.ts"] },
});
```

  `.env.development`: `VITE_MEDIA_BASE=/media/`. `index.html` loads Schibsted Grotesk from Google Fonts (400/600/800, `display=swap`), sets `<html lang="en">`, a `theme-color` meta for both schemes, and `<title>StillDrawn Explorer</title>`.
- [ ] **Step 5:** `npx vitest run` → 3 pass. `npm run dev` and `curl -sI localhost:5173/media/clips/wan22/act-tone-2_campush_wan22.mp4` → 200 video/mp4.
- [ ] **Step 6:** `tokens.css` and `base.css` from `docs/DESIGN.md` (light on `:root`; dark under `@media (prefers-color-scheme: dark)` and `:root[data-theme=dark]`; engine tokens `--e-gen45` …). `App.tsx` renders a header (wordmark, nav: Explore · Motion vs drift · Stillness Tax, theme toggle) and the routed view. Commit `feat(web): scaffold Vite + React + TS with a local media server`.

## Task 5: `stats.ts`

**Files:** `web/src/lib/stats.ts`, `web/src/lib/stats.test.ts`.

- [ ] **Step 1: failing tests:**

```ts
import { describe, it, expect } from "vitest";
import { median, nanmedian, percentile, rank, pearson, spearman, spearmanExact } from "./stats";

describe("stats", () => {
  it("median of odd and even", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
  it("nanmedian skips NaN", () => expect(nanmedian([NaN, 1, 3])).toBe(2));
  it("percentile matches numpy 'linear'", () => {
    // numpy.percentile([1,2,3,4,10], [25, 75]) == [2., 4.]; [0,10] at 33 == 3.3
    expect(percentile([1, 2, 3, 4, 10], 25)).toBe(2);
    expect(percentile([1, 2, 3, 4, 10], 75)).toBe(4);
    expect(percentile([0, 10], 33)).toBeCloseTo(3.3, 12);
  });
  it("rank averages ties", () => expect(rank([10, 20, 20, 5])).toEqual([2, 3.5, 3.5, 1]));
  it("pearson of a line is 1", () => expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 12));
  it("spearman is pearson of ranks", () => expect(spearman([1, 2, 3, 4], [1, 3, 2, 4])).toBeCloseTo(0.8, 12));
  it("exact p for n = 5, rho = 0.9 is 1/12", () => {
    const [rho, p] = spearmanExact([1, 2, 3, 4, 5], [1, 3, 2, 4, 5]);
    expect(rho).toBeCloseTo(0.9, 12);
    expect(p).toBeCloseTo(1 / 12, 12);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/lib/stats.test.ts` → FAIL.
- [ ] **Step 3: implement:**

```ts
// Ports of the numpy calls in pipeline/stilldrawn_web/lenses.py. Percentile is numpy's default 'linear'.
const asc = (a: number[]) => [...a].sort((x, y) => x - y);

function lerp(a: number, b: number, t: number) {
  // numpy._lerp: computed from the nearer end for stability
  const d = b - a;
  return t >= 0.5 ? b - d * (1 - t) : a + d * t;
}

export function percentile(xs: number[], q: number): number {
  const s = asc(xs);
  if (!s.length) return NaN;
  const h = (s.length - 1) * (q / 100);
  const lo = Math.floor(h);
  return lo + 1 < s.length ? lerp(s[lo], s[lo + 1], h - lo) : s[lo];
}

export function median(xs: number[]): number {
  const s = asc(xs), n = s.length;
  if (!n) return NaN;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

export const nanmedian = (xs: number[]) => median(xs.filter((x) => Number.isFinite(x)));

export function rank(xs: number[]): number[] {
  const idx = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b] || a - b);
  const r = new Array<number>(xs.length);
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && xs[idx[j + 1]] === xs[idx[i]]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k]] = avg;
    i = j + 1;
  }
  return r;
}

export function pearson(x: number[], y: number[]): number {
  const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return sxy / Math.sqrt(sxx * syy);
}

export const spearman = (x: number[], y: number[]) => pearson(rank(x), rank(y));

function* permutations<T>(a: T[]): Generator<T[]> {
  if (a.length <= 1) { yield a.slice(); return; }
  for (let i = 0; i < a.length; i++) {
    const rest = [...a.slice(0, i), ...a.slice(i + 1)];
    for (const p of permutations(rest)) yield [a[i], ...p];
  }
}

/** Spearman rho with an exact two-sided permutation p (small n only). */
export function spearmanExact(x: number[], y: number[]): [number, number] {
  const rx = rank(x), ry = rank(y), rho = pearson(rx, ry);
  let hits = 0, total = 0;
  for (const p of permutations(ry)) { hits += Math.abs(pearson(rx, p)) >= Math.abs(rho) - 1e-12 ? 1 : 0; total++; }
  return [rho, hits / total];
}
```

- [ ] **Step 4:** run → 7 pass. Commit `feat(web): stats port (median, numpy-linear percentile, Spearman exact)`.

## Task 6: `pareto.ts` and `lenses.ts`, parity with Python

**Files:** `web/src/lib/pareto.ts`, `lenses.ts`, `lenses.test.ts`, `web/src/data/types.ts` (lens types).

- [ ] **Step 1: failing parity tests** (`lenses.test.ts`):

```ts
import { describe, it, expect } from "vitest";
import fx from "./__fixtures__/lenses.json";
import { summary, priceRanking, priceCrossovers, floorRanking, bandRanking, pairwiseBands, type BoardRow, type BasisRow } from "./lenses";
import { pareto, onLowerHull } from "./pareto";

const basis: BasisRow[] = fx.basis.map((r) => ({ ...r, drift: r.drift ?? NaN }));
const summ = summary(basis);
const close = (a: number | null, b: number | null) =>
  a === null || b === null ? expect(a).toBe(b) : expect(Math.abs(a - b)).toBeLessThan(1e-9);

function sameBoard(got: BoardRow[], want: any[]) {
  expect(got.map((r) => [r.engine, r.rank, r.ranked])).toEqual(want.map((r) => [r.engine, r.rank, r.ranked]));
  got.forEach((r, i) => { close(r.score, want[i].score); close(r.drift_median_px, want[i].drift_median_px); expect(r.n).toBe(want[i].n); });
}

describe("parity with pipeline/stilldrawn_web/lenses.py", () => {
  it("summary", () => {
    for (const [e, w] of Object.entries(fx.summary)) {
      expect(summ[e].n).toBe(w.n);
      close(summ[e].motion_median_norm, w.motion_median_norm);
      close(summ[e].drift_median_px, w.drift_median_px);
      close(summ[e].motion_iqr[0], w.motion_iqr[0]);
      close(summ[e].motion_iqr[1], w.motion_iqr[1]);
    }
  });
  it("pareto front and dominated sets", () => expect(pareto(summ)).toEqual(fx.pareto));
  it("pairwise bands", () => {
    const got = pairwiseBands(basis, summ);
    expect(Object.keys(got)).toEqual(Object.keys(fx.pairwise));
    for (const [k, w] of Object.entries<any>(fx.pairwise)) {
      const g = got[k];
      close(g.lo, w.lo); close(g.hi, w.hi);
      expect([g.overlaps, g.usable, g.winner_in_band, g.reverses_league]).toEqual([w.overlaps, w.usable, w.winner_in_band, w.reverses_league]);
    }
  });
  it("price boards", () => { for (const [p, want] of Object.entries(fx.price)) sameBoard(priceRanking(summ, Number(p)), want); });
  it("price crossovers", () => {
    const got = priceCrossovers(summ, 3);
    expect(got.map((s) => s.leader)).toEqual(fx.crossovers.map((s) => s.leader));
    got.forEach((s, i) => { close(s.p_from, fx.crossovers[i].p_from); close(s.p_to, fx.crossovers[i].p_to); });
  });
  it("floor boards", () => { for (const [f, want] of Object.entries(fx.floor)) sameBoard(floorRanking(basis, Number(f)), want); });
  it("band boards at each pairwise preset", () => {
    for (const [k, want] of Object.entries(fx.band)) {
      const { lo, hi } = (fx.pairwise as any)[k];
      sameBoard(bandRanking(basis, lo, hi), want);
    }
  });
  it("only lower-hull engines ever lead on price", () => {
    const leaders = new Set(priceCrossovers(summ, 3).map((s) => s.leader));
    for (const e of leaders) expect(onLowerHull(summ, e)).toBe(true);
    expect(leaders.has("gen4_turbo")).toBe(false);
  });
});
```

  Enable `"resolveJsonModule": true` in `tsconfig.json`.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: implement** `pareto.ts`:

```ts
import type { Summary } from "./lenses";
export const byCodePoint = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Maximise motion, minimise drift, on engine medians (lenses.pareto). */
export function pareto(summ: Summary) {
  const es = Object.keys(summ).sort(byCodePoint);
  const dominated_by: Record<string, string[]> = {};
  for (const e of es) {
    const me = summ[e].motion_median_norm, de = summ[e].drift_median_px;
    dominated_by[e] = es.filter((o) => {
      const mo = summ[o].motion_median_norm, d = summ[o].drift_median_px;
      return o !== e && mo >= me && d <= de && (mo > me || d < de);
    });
  }
  return { frontier: es.filter((e) => !dominated_by[e].length), dominated_by };
}

/** On the lower convex hull of (log2 motion, drift): the only engines a linear price can put first. */
export function onLowerHull(summ: Summary, engine: string): boolean {
  const pts = Object.entries(summ).map(([e, v]) => ({ e, x: Math.log2(v.motion_median_norm), y: v.drift_median_px }));
  const t = pts.find((p) => p.e === engine)!;
  // t is on the lower hull iff some slope s makes it the strict minimiser of y − s·x for s ≥ 0
  // equivalently: no pair (a, b) with a.x ≤ t.x ≤ b.x lies strictly below t on the chord.
  for (const a of pts) for (const b of pts) {
    if (a.x < t.x && t.x < b.x) {
      const yChord = a.y + ((t.x - a.x) / (b.x - a.x)) * (b.y - a.y);
      if (yChord < t.y - 1e-12) return false;
    }
  }
  return pts.every((p) => p.e === t.e || !(p.x >= t.x && p.y <= t.y && (p.x > t.x || p.y < t.y)));
}
```

  `lenses.ts` (port of `lenses.py`; same names, same tie-break):

```ts
import { median, nanmedian, percentile } from "./stats";
import { byCodePoint } from "./pareto";

export const MIN_N = 5;
export const REF_ENGINE = "wan22";
export type BasisRow = { id: string; engine: string; motion: number; drift: number };
export type Summary = Record<string, { n: number; motion_median_norm: number; motion_iqr: [number, number]; drift_median_px: number }>;
export type BoardRow = { engine: string; n: number; drift_median_px: number | null; score: number | null;
  ranked: boolean; rank: number | null; doublings?: number; reason?: string };

function arrays(basis: BasisRow[]) {
  const per: Record<string, { motion: number[]; drift: number[] }> = {};
  for (const r of basis) (per[r.engine] ??= { motion: [], drift: [] }), per[r.engine].motion.push(r.motion), per[r.engine].drift.push(r.drift);
  return per;
}

export function summary(basis: BasisRow[]): Summary {
  const out: Summary = {};
  for (const [e, d] of Object.entries(arrays(basis)).sort(([a], [b]) => byCodePoint(a, b)))
    out[e] = { n: d.motion.length, motion_median_norm: median(d.motion),
      motion_iqr: [percentile(d.motion, 25), percentile(d.motion, 75)], drift_median_px: nanmedian(d.drift) };
  return out;
}

function board(scored: Record<string, Omit<BoardRow, "engine" | "ranked" | "rank">>, unranked: typeof scored): BoardRow[] {
  const rows: BoardRow[] = [
    ...Object.entries(scored).sort(([a, x], [b, y]) => (x.score! - y.score!) || byCodePoint(a, b))
      .map(([engine, v]) => ({ engine, ...v, ranked: true, rank: null })),
    ...Object.entries(unranked).sort(([a], [b]) => byCodePoint(a, b)).map(([engine, v]) => ({ engine, ...v, ranked: false, rank: null })),
  ];
  rows.forEach((r, i) => (r.rank = r.ranked ? i + 1 : null));
  return rows;
}

const doublingsOf = (summ: Summary, e: string, ref: string) => Math.log2(summ[e].motion_median_norm / summ[ref].motion_median_norm);

/** score = drift median − p · log2(motion / reference motion). p = 0 is the paper's league. */
export function priceRanking(summ: Summary, p: number, ref = REF_ENGINE): BoardRow[] {
  const scored: Record<string, any> = {};
  for (const [e, v] of Object.entries(summ)) {
    const doublings = doublingsOf(summ, e, ref);
    scored[e] = { score: v.drift_median_px - p * doublings, doublings, drift_median_px: v.drift_median_px, n: v.n };
  }
  return board(scored, {});
}

export function priceCrossovers(summ: Summary, pMax = 3, ref = REF_ENGINE) {
  const es = Object.keys(summ).sort(byCodePoint);
  const line = (e: string) => [summ[e].drift_median_px, doublingsOf(summ, e, ref)] as const;
  const cuts = new Set([0, pMax]);
  for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {
    const [da, xa] = line(es[i]), [db, xb] = line(es[j]);
    if (xa !== xb) { const p = (da - db) / (xa - xb); if (p > 0 && p < pMax) cuts.add(p); }
  }
  const cs = [...cuts].sort((a, b) => a - b);
  const segs: { p_from: number; p_to: number; leader: string }[] = [];
  for (let k = 0; k + 1 < cs.length; k++) {
    const mid = (cs[k] + cs[k + 1]) / 2;
    const score = (e: string) => line(e)[0] - mid * line(e)[1];
    const leader = es.reduce((best, e) => (score(e) < score(best) || (score(e) === score(best) && byCodePoint(e, best) < 0) ? e : best));
    const last = segs[segs.length - 1];
    if (last && last.leader === leader) last.p_to = cs[k + 1];
    else segs.push({ p_from: cs[k], p_to: cs[k + 1], leader });
  }
  return segs;
}

function subsetBoard(basis: BasisRow[], keep: (m: number, d: number) => boolean): BoardRow[] {
  const scored: Record<string, any> = {}, unranked: Record<string, any> = {};
  for (const [e, d] of Object.entries(arrays(basis)).sort(([a], [b]) => byCodePoint(a, b))) {
    const sel = d.drift.filter((x, i) => keep(d.motion[i], x));
    const n = sel.length, rec = { n, drift_median_px: n ? median(sel) : null };
    if (n >= MIN_N) scored[e] = { ...rec, score: rec.drift_median_px };
    else unranked[e] = { ...rec, score: null, reason: `too few clips (n = ${n})` };
  }
  return board(scored, unranked);
}

export const floorRanking = (basis: BasisRow[], f: number) => subsetBoard(basis, (m, d) => m >= f && Number.isFinite(d));
export const bandRanking = (basis: BasisRow[], lo: number, hi: number) => subsetBoard(basis, (m, d) => m >= lo && m <= hi && Number.isFinite(d));

export function pairwiseBands(basis: BasisRow[], summ: Summary) {
  const arr = arrays(basis), es = Object.keys(summ).sort(byCodePoint);
  const out: Record<string, any> = {};
  for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {
    const a = es[i], b = es[j];
    const lo = Math.max(summ[a].motion_iqr[0], summ[b].motion_iqr[0]);
    const hi = Math.min(summ[a].motion_iqr[1], summ[b].motion_iqr[1]);
    const rec: any = { lo, hi, overlaps: lo < hi };
    if (rec.overlaps) {
      for (const e of [a, b]) {
        const sel = arr[e].drift.filter((d, k) => arr[e].motion[k] >= lo && arr[e].motion[k] <= hi && Number.isFinite(d));
        rec[e] = { n: sel.length, drift_median: sel.length ? median(sel) : null };
      }
      rec.usable = rec[a].n >= MIN_N && rec[b].n >= MIN_N;
      if (rec.usable) {
        rec.winner_in_band = rec[a].drift_median < rec[b].drift_median ? a : b;
        const league = summ[a].drift_median_px < summ[b].drift_median_px ? a : b;
        rec.reverses_league = rec.winner_in_band !== league;
      }
    }
    out[`${a}|${b}`] = rec;
  }
  return out;
}
```

- [ ] **Step 4:** run → 8 pass. If a board's order differs, check tie-breaks first (code-point order), then NaN handling (`nanmedian` only in `summary`).
- [ ] **Step 5:** commit `feat(web): lenses and pareto ported, parity-tested against the pipeline`.

## Task 7: data loaders, model and format

**Files:** `web/src/data/types.ts`, `load.ts`, `media.ts`, `model.ts`, `model.test.ts`; `web/src/lib/format.ts`, `format.test.ts`.

- [ ] **Step 1: failing tests** (`model.test.ts`, reading the real contract from `public/data/v1` with `fs`):

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { gridRows, drawsOf, cellKey, basisRank, ARM_VIEWS, clipFor } from "./model";
import type { Clip } from "./types";

const clips: Clip[] = JSON.parse(readFileSync("public/data/v1/clips.json", "utf8"));
const index = JSON.parse(readFileSync("public/data/v1/index.json", "utf8"));

describe("model", () => {
  it("standard grid is 33 rows × 5 engines with one refused slot", () => {
    const rows = gridRows(clips, "standard");
    expect(rows.length).toBe(33);
    const missing = rows.flatMap((r) => r.cells.filter((c) => !c.clip).map((c) => `${r.key}_${c.engine}`));
    expect(missing).toEqual(["cu-tone-3_idle_gen4t"]);
    expect(index.missing_cells[0].cell).toBe("cu-tone-3_idle_gen4t");
  });
  it("draws of a primary cell include its repeat and hazard draws", () => {
    const d = drawsOf(clips, "act-black-3_burst_h3").map((c) => c.draw);
    expect(d[0]).toBe("r1");
    expect(d).toContain("h1");
  });
  it("cell keys round-trip", () => expect(cellKey("act-tone-2", "CAMPUSH")).toBe("act-tone-2_campush"));
  it("clipFor resolves the default compare pair", () => {
    expect(clipFor(clips, "act-tone-2_campush", "gen4.5")?.id).toBe("act-tone-2_campush_gen45");
    expect(clipFor(clips, "act-tone-2_campush", "wan22")?.id).toBe("act-tone-2_campush_wan22");
  });
  it("basis rank is 1-based within the engine's primary standard cells", () => {
    const steadiest = clips.filter((c) => c.arm === "primary" && c.engine === "wan22").sort((a, b) => a.h.line! - b.h.line!)[0];
    expect(basisRank(clips, steadiest, "line")).toEqual({ rank: 1, of: 33 });
  });
  it("arm views cover all 373 clips", () => {
    const n = ARM_VIEWS.reduce((s, v) => s + clips.filter(v.includes).length, 0);
    expect(n).toBe(373);
  });
});
```

  `format.test.ts`:

```ts
import { it, expect } from "vitest";
import { px, ratio, norm, ordinal } from "./format";
it("formats", () => {
  expect(ratio(9.222123151817687)).toBe("9.2×");
  expect(ratio(3.790582767584321)).toBe("3.8×");
  expect(px(0.7798875656772123)).toBe("0.78 px");
  expect(norm(0.0007961275056004524)).toBe("0.00080");
  expect(ordinal(1)).toBe("1st"); expect(ordinal(22)).toBe("22nd"); expect(ordinal(13)).toBe("13th");
});
```

- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: implement.**
  - `types.ts`: `Engine`, `Panel`, `Clip`, `Series`, `Paper` (typed as `Record<string, {value: unknown; source: string}>` with typed accessors for the keys used), `Taxonomy`, `Index`, mirroring the JSON shown in the facts above.
  - `load.ts`: `loadCore()` fetches index, engines, panels, clips, paper, taxonomy in parallel from `/data/v1/` once (module-level promise); `loadSeries(engine)` caches per engine. A React hook `useCore()` built on `use()` with a Suspense boundary in `App.tsx` and an error boundary that shows a plain retry message.
  - `media.ts`: `MEDIA_BASE = import.meta.env.VITE_MEDIA_BASE ?? index.media_base`; `mediaUrl(path)`.
  - `model.ts`:

```ts
import type { Clip } from "./types";
export const ANALYSED = ["gen4.5", "gen4_turbo", "h3-fal", "ltx23", "wan22"] as const;
export const cellKey = (panel: string, mc: string) => `${panel}_${mc.toLowerCase()}`;
const rowKey = (c: Clip) => (c.arm === "flint" ? c.panel : cellKey(c.panel, c.motion_class!));

export const ARM_VIEWS = [
  { id: "standard", label: "Standard cells", includes: (c: Clip) => ["primary", "repeat", "hazard"].includes(c.arm) },
  { id: "ground", label: "Ground variants", includes: (c: Clip) => c.arm === "ground" },
  { id: "flint", label: "FLINT pairs", includes: (c: Clip) => c.arm === "flint" },
  { id: "seedance", label: "Seedance (scout)", includes: (c: Clip) => c.arm === "seedance" },
] as const;
export type ArmView = (typeof ARM_VIEWS)[number]["id"];

const FIRST: Record<ArmView, (c: Clip) => boolean> = {
  standard: (c) => c.arm === "primary", ground: (c) => c.arm === "ground",
  flint: (c) => c.arm === "flint", seedance: (c) => c.arm === "seedance",
};

export function gridRows(clips: Clip[], view: ArmView) {
  const firsts = clips.filter(FIRST[view]);
  const engines = view === "seedance" ? ["seedance"] : [...new Set(firsts.map((c) => c.engine))].sort();
  const cols = view === "standard" ? [...ANALYSED] : engines;
  const keys = [...new Set(firsts.map(rowKey))].sort();
  return keys.map((key) => ({
    key,
    cells: cols.map((engine) => ({ engine, clip: firsts.find((c) => rowKey(c) === key && c.engine === engine) })),
  }));
}

const DRAW_ORDER = (d: string) => (d === "r1" ? 0 : d === "r2" ? 1 : 1 + Number(d.slice(1)));
export const drawsOf = (clips: Clip[], cell: string) =>
  clips.filter((c) => c.cell === cell).sort((a, b) => DRAW_ORDER(a.draw) - DRAW_ORDER(b.draw));

export const clipFor = (clips: Clip[], row: string, engine: string, draw = "r1") =>
  clips.find((c) => rowKey(c) === row && c.engine === engine && c.draw === draw);

export function basisRank(clips: Clip[], clip: Clip, metric: keyof Clip["h"]) {
  if (clip.arm !== "primary") return null;
  const pool = clips.filter((c) => c.arm === "primary" && c.engine === clip.engine && c.h[metric] != null);
  const v = clip.h[metric];
  if (v == null) return null;
  return { rank: 1 + pool.filter((c) => c.h[metric]! < v).length, of: pool.length };
}
```

  (`gridRows` sorts engine ids with default `sort()`, which is code-point order. Standard columns follow `ANALYSED`, the order DESIGN.md sets.)
  - `format.ts`: `px(v)` = 2 dp + " px"; `ratio(v)` = 1 dp + "×"; `norm(v)` = 2 significant figures in fixed notation (`0.00080`); `ordinal(n)`; `pct`. One module, so every surface rounds the same way.
- [ ] **Step 4:** run → pass. Commit `feat(web): typed contract loaders, grid model, formatting`.

## Task 8: router and query state

**Files:** `web/src/router.ts`, `router.test.ts`.

- [ ] **Step 1: failing tests:**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRoute, useQuery, navigate } from "./router";

beforeEach(() => history.replaceState(null, "", "/explore?cell=act-tone-2_campush&e=gen4.5"));

describe("router", () => {
  it("reads path and query", () => {
    const { result } = renderHook(() => useRoute());
    expect(result.current.path).toBe("/explore");
    expect(result.current.query.get("e")).toBe("gen4.5");
  });
  it("useQuery patches the query with replaceState and keeps other keys", () => {
    const { result } = renderHook(() => useQuery());
    act(() => result.current[1]({ vs: "wan22" }));
    expect(location.search).toBe("?cell=act-tone-2_campush&e=gen4.5&vs=wan22");
    act(() => result.current[1]({ vs: null }));
    expect(location.search).toBe("?cell=act-tone-2_campush&e=gen4.5");
  });
  it("navigate pushes and notifies", () => {
    const { result } = renderHook(() => useRoute());
    act(() => navigate("/tax?lens=price&p=1.25"));
    expect(result.current.path).toBe("/tax");
    expect(result.current.query.get("p")).toBe("1.25");
  });
});
```

- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: implement:**

```ts
// Real paths, state in the query string. pushState for navigation, replaceState for control changes.
import { useSyncExternalStore, useCallback } from "react";

const EVT = "sd:route";
const subscribe = (cb: () => void) => {
  addEventListener("popstate", cb); addEventListener(EVT, cb);
  return () => { removeEventListener("popstate", cb); removeEventListener(EVT, cb); };
};
const snap = () => location.pathname + location.search;

export function navigate(to: string, { replace = false } = {}) {
  history[replace ? "replaceState" : "pushState"](null, "", to);
  dispatchEvent(new Event(EVT));
}

export function useRoute() {
  const s = useSyncExternalStore(subscribe, snap, snap);
  const u = new URL(s, "http://x");
  return { path: u.pathname.replace(/\/$/, "") || "/", query: u.searchParams };
}

export function useQuery() {
  const { query } = useRoute();
  const set = useCallback((patch: Record<string, string | number | null | undefined>) => {
    const q = new URLSearchParams(location.search);
    for (const [k, v] of Object.entries(patch)) v == null || v === "" ? q.delete(k) : q.set(k, String(v));
    const s = q.toString();
    navigate(location.pathname + (s ? `?${s}` : ""), { replace: true });
  }, []);
  return [query, set] as const;
}

/** <a> that routes in-app, but stays a real link (middle-click, copy). */
export function onLinkClick(e: React.MouseEvent<HTMLAnchorElement>) {
  if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault(); navigate(e.currentTarget.getAttribute("href")!);
}
```

  `App.tsx` maps `/` → `navigate("/explore" + search, {replace: true})`, `/explore` → Explore, `/explore/failures` → FailureGallery, `/scatter`, `/tax`, else a 404 view with links. Focus moves to the view's `<h1>` on path change (not on query change); `document.title` updates per view.
- [ ] **Step 4:** run → pass. Commit `feat(web): history router with query-string state`.

## Task 9: Explore grid

**Files:** `web/src/views/Explore/Explore.tsx`, `Grid.tsx`; e2e `web/e2e/explore.spec.ts`; `web/e2e/playwright.config.ts`.

Behaviour:
- `/explore?arm=standard` (default): a contact sheet. Rows are the 33 cells (panel thumbnail + motion class), columns are the 5 engines (labelled; colour token as a 3 px rule under the label). Each cell is a `<button>` (or link) with its poster, `loading="lazy"`, `decoding="async"`, explicit width/height (no layout shift). A cell with more than one draw shows a small "+N draws" mark.
- The refused cell renders an empty slot (dashed rule, no poster) reading "Not generated" with the reason from `index.missing_cells` (never typed).
- Arms filter: a radio group (`ARM_VIEWS`) sets `?arm=`. Draw switcher appears in the player for the selected cell.
- Selecting a cell sets `?cell=<row>&e=<engine>` and opens the player above the grid on desktop (sticky) and as a full-width section on phones. Selected cell gets the gold keeper mark.
- At 390 px: a panel list (one row per cell: thumbnail, key) and, under the open row, engine tabs (radio group) instead of the 5-column sheet. No horizontal page scroll.
- Keyboard: Tab reaches the arms filter, then the grid. Inside the grid, arrow keys move between cells (roving tabindex), Enter/Space selects.

- [ ] **Step 1: e2e config** (`web/e2e/playwright.config.ts`):

```ts
import { defineConfig } from "@playwright/test";
const sizes = [{ name: "desktop", width: 1440, height: 900 }, { name: "phone", width: 390, height: 844 }];
const schemes = ["light", "dark"] as const;
export default defineConfig({
  testDir: ".",
  webServer: { command: "npm run dev -- --port 5199 --strictPort", port: 5199, reuseExistingServer: true, cwd: ".." },
  use: { baseURL: "http://localhost:5199" },
  projects: sizes.flatMap((s) => schemes.map((c) => ({
    name: `${s.name}-${c}`, use: { viewport: { width: s.width, height: s.height }, colorScheme: c },
  }))),
});
```

  and a shared fixture `web/e2e/fixtures.ts` that fails any test on a console error, page error or failed same-origin request:

```ts
import { test as base, expect } from "@playwright/test";
export const test = base.extend<{ clean: void }>({
  clean: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("requestfailed", (r) => r.url().startsWith("http://localhost") && errors.push(`failed ${r.url()}`));
    await use();
    expect(errors).toEqual([]);
  }, { auto: true }],
});
export { expect };
```

- [ ] **Step 2: failing spec** (`explore.spec.ts`):

```ts
import { test, expect } from "./fixtures";

test("contact sheet shows 33 cells and the refused slot with its reason", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const desktop = (page.viewportSize()?.width ?? 0) > 800;
  if (desktop) {
    await expect(page.getByTestId("grid-row")).toHaveCount(33);
    await expect(page.getByTestId("cell-missing")).toHaveCount(1);
    await expect(page.getByTestId("cell-missing")).toContainText("moderation");
  } else {
    await expect(page.getByTestId("panel-row")).toHaveCount(33);
  }
});

test("arms filter switches to ground variants and back", async ({ page }) => {
  await page.goto("/explore");
  await page.getByRole("radio", { name: /ground/i }).check();
  await expect(page).toHaveURL(/arm=ground/);
  await page.getByRole("radio", { name: /standard/i }).check();
  await expect(page).toHaveURL(/arm=standard|\/explore$/);
});

test("selecting a cell deep-links it", async ({ page }) => {
  await page.goto("/explore?cell=act-tone-2_campush&e=gen4.5");
  await expect(page.getByTestId("player")).toBeVisible();
  await expect(page.getByTestId("player")).toContainText("Gen-4.5");
});

test("grid is keyboard reachable", async ({ page }) => {
  await page.goto("/explore");
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    if (await page.evaluate(() => document.activeElement?.closest("[data-testid=grid],[data-testid=panel-list]") != null)) break;
  }
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/cell=/);
});

test("no horizontal page scroll", async ({ page }) => {
  await page.goto("/explore");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
```

- [ ] **Step 3:** `npx playwright install chromium` (once), then `npm run e2e -- explore.spec.ts` → FAIL.
- [ ] **Step 4:** implement `Explore.tsx` (reads `arm`, `cell`, `e`, `draw`, `vs` from `useQuery`; renders `ArmFilter`, `Player` when a cell is selected, then `Grid`) and `Grid.tsx` per the behaviour above and DESIGN.md.
- [ ] **Step 5:** e2e passes on all four projects. Scan, commit `feat(web): Explore contact sheet with arms filter and refused slot`.

## Task 10: the player, frame clock and difference toggle

**Files:** `web/src/views/Explore/Player.tsx`, `useFrameClock.ts`, `useFrameClock.test.ts`; e2e `player.spec.ts`.

Behaviour:
- Left: the source panel (`panels/<id>.webp`, `<a>` to the PNG original). Right: `<video muted loop playsInline preload="metadata" poster=…>` for the clip. Clips over 10 MB use `preload="none"` and show their size next to the play button (`format.mb`).
- Controls (a toolbar): play/pause (Space), speed radio 0.25× / 0.5× / 1×, step back/forward one frame (`,` `.`, also buttons), "Difference" toggle (D), draw switcher (radio, only when >1 draw: r1, r2, h1…).
- Frame clock: `useFrameClock(video, fps)` returns the current frame index, updated by `requestVideoFrameCallback` (`Math.round(metadata.mediaTime * fps)`), with a `timeupdate` + rAF fallback when rVFC is missing. `seekFrame(n)` sets `currentTime = (n + 0.5) / fps` (mid-frame, so the decoder lands on n).
- Difference: a stacked view where the frame-0 PNG sits under the video and the video takes `mix-blend-mode: difference`. Same box, `object-fit: contain`, same intrinsic size, so they are pixel-aligned. Caption: "Clip minus its own first frame. Black means unchanged; this is what line drift measures." Frame 0 should read near-black.
- If the clip fails to load (media host not live, preview subset), the player shows the poster and "This clip streams once the media host is live." No console error (handle `error` on the element; do not let the browser log an unhandled promise from `play()`).

- [ ] **Step 1: failing unit test** for the frame maths (`useFrameClock.test.ts`):

```ts
import { it, expect } from "vitest";
import { frameAt, timeFor } from "./useFrameClock";
it("maps media time to frames and back to mid-frame times", () => {
  expect(frameAt(0, 24)).toBe(0);
  expect(frameAt(1.0, 24)).toBe(24);
  expect(frameAt(timeFor(96, 24), 24)).toBe(96);
  expect(timeFor(0, 24)).toBeCloseTo(1 / 48, 12);
});
```

- [ ] **Step 2: failing e2e** (`player.spec.ts`), using the default pair:

```ts
import { test, expect } from "./fixtures";
const URL = "/explore?cell=act-tone-2_campush&e=wan22";

test("frame stepping with , and .", async ({ page }) => {
  await page.goto(URL);
  const v = page.getByTestId("clip-video");
  await v.evaluate((el: HTMLVideoElement) => new Promise((r) => (el.readyState >= 2 ? r(0) : el.addEventListener("loadeddata", r, { once: true }))));
  await page.getByRole("button", { name: /pause|play/i }).first().focus();
  await page.keyboard.press("k"); // pause if playing (k toggles, like video players)
  await page.keyboard.press(".");
  await page.keyboard.press(".");
  await expect(page.getByTestId("frame-readout")).toHaveText(/^Frame 2\b/);
  await page.keyboard.press(",");
  await expect(page.getByTestId("frame-readout")).toHaveText(/^Frame 1\b/);
});

test("speed control sets playbackRate", async ({ page }) => {
  await page.goto(URL);
  await page.getByRole("radio", { name: "0.25×" }).check();
  expect(await page.getByTestId("clip-video").evaluate((el: HTMLVideoElement) => el.playbackRate)).toBe(0.25);
});

test("difference at frame 0 is near-black", async ({ page }) => {
  await page.goto(URL + "&diff=1");
  const mean = await page.evaluate(async () => {
    const v = document.querySelector<HTMLVideoElement>("[data-testid=clip-video]")!;
    const img = document.querySelector<HTMLImageElement>("[data-testid=frame0]")!;
    v.pause(); v.currentTime = 1 / 48;
    await new Promise((r) => v.addEventListener("seeked", r, { once: true }));
    await img.decode();
    const c = new OffscreenCanvas(v.videoWidth, v.videoHeight), g = c.getContext("2d")!;
    g.drawImage(img, 0, 0); const a = g.getImageData(0, 0, c.width, c.height).data;
    g.drawImage(v, 0, 0); const b = g.getImageData(0, 0, c.width, c.height).data;
    let s = 0; for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    return s / (a.length / 4) / 3;
  });
  expect(mean).toBeLessThan(2); // mean abs difference per channel, 0–255
});
```

  If the last test fails with a mean around 3–8 and a colour cast, the PNG's matrix is wrong: switch `RGB_FILTER` to BT.601 in `media.py`, re-derive, re-run, and record which one Chrome uses in LOG.md.
- [ ] **Step 3:** run → FAIL. **Step 4:** implement `useFrameClock.ts` (`frameAt`, `timeFor`, the hook) and `Player.tsx`. Keyboard shortcuts are bound on the player region (not `window`) and ignored when focus is in a text input. **Step 5:** pass on all four projects; commit `feat(web): player with frame stepping, speed and the difference view`.

## Task 11: drift curve, readouts, provenance

**Files:** `web/src/views/Explore/DriftCurve.tsx`, `Readouts.tsx`, `Provenance.tsx`, `curve.ts`, `curve.test.ts`; e2e `curve.spec.ts`.

Behaviour:
- `DriftCurve`: SVG, d3-scale + d3-shape. Series selector (radio): line drift (default), IoU, edge, style, closure, and tone only when the clip has a tone series. The motion series is drawn underneath as a muted area on its own right-hand axis. X is frame index 0…n−1: `line`, `iou`, `style` start at frame 1; `edge`, `closure` at 0; `motion[i]` sits at frame `2i + 1` (stride 2).
- Playhead: a gold vertical rule at the clock's frame. Scrubbing: pointer down/move on the chart seeks (`seekFrame`); the chart is also `role="slider"` with `aria-valuemin/max/now`, `aria-valuetext="Frame 42, line drift 3.10 px"`, arrows step one frame, PageUp/Down ten, Home/End.
- A text alternative: a "Show values" disclosure renders the series as a table (every 8th frame).
- `Readouts`: the five headlines (`h.line` …, `—` for null with "not defined for this clip"), each with `basisRank` ("12th steadiest of 33 for Gen-4.5"); motion `median_px` and `median_norm`; `departed` badge ("Departed: line drift over 10 px", threshold from `paper.departure_threshold_px`); hand tags with their taxonomy name and definition, linked to the failure gallery.
- `Provenance` (a `<details>` open on desktop): sha256 (monospace, copy button), "Byte-identical to the release" plus "C2PA Content Credentials intact" when `c2pa`, the engine's `model_version`, the zip name (`engines[].zip`), DOI link (`paper.doi_version`), "CC BY 4.0, StillDrawn dataset (Aaron Smiles, 2026)". When `engine.notice` or `panel.notice`: a badge "Provider notice: please don't train on this clip" linking to `NOTICE-PROVIDERS.md` in the public repo.

- [ ] **Step 1: failing unit test** (`curve.test.ts`):

```ts
import { it, expect } from "vitest";
import { seriesFrames } from "./curve";
it("aligns each series to frame indices", () => {
  expect(seriesFrames("line", 120)).toEqual({ start: 1, step: 1 });
  expect(seriesFrames("edge", 121)).toEqual({ start: 0, step: 1 });
  expect(seriesFrames("motion", 60)).toEqual({ start: 1, step: 2 });
});
```

- [ ] **Step 2: failing e2e** (`curve.spec.ts`):

```ts
import { test, expect } from "./fixtures";
const URL = "/explore?cell=act-tone-2_campush&e=gen4.5";

test("curve slider seeks the video by keyboard", async ({ page }) => {
  await page.goto(URL);
  const s = page.getByRole("slider", { name: /drift curve/i });
  await s.focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("PageUp");
  await expect(s).toHaveAttribute("aria-valuenow", "10");
  await expect(page.getByTestId("frame-readout")).toHaveText(/^Frame 10\b/);
});

test("series selector hides tone when the clip has none", async ({ page }) => {
  await page.goto(URL);
  const hasTone = await page.evaluate(async () => {
    const s = await (await fetch("/data/v1/series/gen4.5.json")).json();
    return s["act-tone-2_campush_gen45"].tone != null;
  });
  await expect(page.getByRole("radio", { name: /tone/i })).toHaveCount(hasTone ? 1 : 0);
});

test("readouts show basis rank and provenance from the contract", async ({ page }) => {
  await page.goto(URL);
  const clip = await page.evaluate(async () => (await (await fetch("/data/v1/clips.json")).json()).find((c: any) => c.id === "act-tone-2_campush_gen45"));
  await expect(page.getByTestId("readouts")).toContainText(/of 33/);
  await expect(page.getByTestId("provenance")).toContainText(clip.sha256);
  await expect(page.getByTestId("provenance")).toContainText("stilldrawn-clips-gen4.5-v1.0.0.zip");
  await expect(page.getByTestId("notice-badge")).toBeVisible();
});
```

- [ ] **Step 3–5:** run → FAIL; implement; pass on all projects; commit `feat(web): synced drift curve, readouts and provenance`.

## Task 12: compare mode and the failure gallery

**Files:** `web/src/views/Explore/Compare.tsx`, `FailureGallery.tsx`; e2e `compare.spec.ts`.

Behaviour:
- Compare: `?vs=<engine>` pins a second engine on the same cell → source | A | B. A "Compare with…" menu lists the cell's other engines. B is slaved to A: play/pause/rate mirror; on each A frame callback, if `|B.frame − A.frame| > 1`, B seeks to A's frame. One chart, two lines in their engine colours, one shared playhead. The pinned engine's label carries the gold mark. Readouts show A and B side by side in one table (headline, A, B), so the comparison is a sentence of numbers, not two cards.
- **Default deep link:** `/explore?cell=act-tone-2_campush&e=gen4.5&vs=wan22`. The Explore page's empty state ("Pick a cell, or start with the drift test") links to it.
- On phones, A and B stack under the source; the chart stays one.
- Failure gallery (`/explore/failures`): the 7 modes grouped by axis, plus A4 marked "candidate", each with its definition and exemplar posters linking to `/explore?cell=…&e=…&draw=…`. Exemplar ids come from `taxonomy.json` only.

- [ ] **Step 1: failing e2e:**

```ts
import { test, expect } from "./fixtures";

test("default compare pair plays in sync", async ({ page }) => {
  await page.goto("/explore?cell=act-tone-2_campush&e=gen4.5&vs=wan22");
  const vids = page.locator("[data-testid=clip-video]");
  await expect(vids).toHaveCount(2);
  await page.keyboard.press("k");
  for (let i = 0; i < 5; i++) await page.keyboard.press(".");
  const t = await vids.evaluateAll((els) => els.map((e) => (e as HTMLVideoElement).currentTime));
  expect(Math.abs(t[0] - t[1])).toBeLessThan(1 / 24 + 1e-3);
  await expect(page.getByTestId("compare-table")).toContainText("Wan 2.2");
});

test("failure gallery lists the taxonomy's exemplars", async ({ page }) => {
  await page.goto("/explore/failures");
  const tax = await page.evaluate(async () => (await fetch("/data/v1/taxonomy.json")).json());
  const n = Object.values<any>(tax).reduce((s, m) => s + m.clips.length, 0);
  await expect(page.getByTestId("exemplar")).toHaveCount(n);
  await expect(page.getByText(/candidate/i).first()).toBeVisible();
});
```

- [ ] **Step 2–4:** FAIL → implement → pass. Commit `feat(web): compare mode (act-tone-2 default) and failure gallery`.

## Task 13: `/scatter`

**Files:** `web/src/views/Scatter/Scatter.tsx`, `scatterModel.ts`, `scatterModel.test.ts`; e2e `scatter.spec.ts`.

Behaviour:
- One point per clip: x = `motion.median_norm` on a log scale, y = the chosen headline (`?y=line` default; radio of the five). Primary arm by default (164 standard + FLINT shown hollow, excluded from medians); `?arms=` toggles repeat, hazard, ground, seedance as checkboxes.
- Colour by engine (DESIGN.md tokens) with direct labels at each engine's median cross (median point with IQR whiskers on both axes, from `summary` for line, computed with `stats` for other metrics).
- Within-engine ρ per engine, shown in the legend from `paper.within_engine_rho` (never computed in the browser, so it matches the paper). For non-primary arm sets, the legend says these ρ are for the primary basis.
- Click (or Enter on a focused point, via a roving list) opens the clip in Explore. Hover shows a tooltip (id, engine, both values).
- "Show as table" toggle renders the same points as a sortable table for screen readers and keyboard users.
- Quoted figures (the engine-level ρ = 0.90, p = 0.083 caption) come from `paper.engine_rho_motion_drift`.

- [ ] **Step 1: failing unit test:**

```ts
import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { points, medianCross } from "./scatterModel";
const clips = JSON.parse(readFileSync("public/data/v1/clips.json", "utf8"));
const fx = JSON.parse(readFileSync("src/lib/__fixtures__/lenses.json", "utf8"));
it("primary basis has 164 points plus 6 flint", () => {
  const p = points(clips, "line", new Set(["primary"]));
  expect(p.filter((d) => !d.flint).length).toBe(164);
  expect(p.filter((d) => d.flint).length).toBe(6);
});
it("median cross matches the lens summary for line drift", () => {
  const m = medianCross(points(clips, "line", new Set(["primary"])), "wan22");
  expect(Math.abs(m.y - fx.summary.wan22.drift_median_px)).toBeLessThan(1e-9);
  expect(Math.abs(m.x - fx.summary.wan22.motion_median_norm)).toBeLessThan(1e-9);
});
```

  Note: `clips.json` rounds `h.line` and `motion.median_norm` to 4 significant figures while the fixture basis is full precision. If the medians differ at 1e-9, build the scatter's primary points from the fixture `basis` values joined by id (full precision) and keep `clips.json` for the other arms. Decide from the test, and record the choice in `scatterModel.ts`'s header comment.
- [ ] **Step 2: failing e2e:**

```ts
import { test, expect } from "./fixtures";
test("scatter draws the primary basis and opens a clip", async ({ page }) => {
  await page.goto("/scatter");
  await expect(page.locator("[data-testid=pt]")).toHaveCount(170);
  await page.getByRole("button", { name: /show as table/i }).click();
  await page.getByRole("link", { name: "act-tone-2_campush_gen45" }).click();
  await expect(page).toHaveURL(/\/explore\?cell=act-tone-2_campush&e=gen4\.5/);
});
test("y metric switch updates the axis label", async ({ page }) => {
  await page.goto("/scatter?y=style");
  await expect(page.getByTestId("y-label")).toContainText(/style/i);
});
```

- [ ] **Step 3–4:** FAIL → implement → pass. Commit `feat(web): motion vs drift scatter`.

## Task 14: `/tax`: lenses, shared FLIP leaderboard

**Files:** `web/src/views/Tax/Tax.tsx`, `LensControls.tsx`, `Leaderboard.tsx`, `Leaderboard.test.tsx`, `flip.ts`, `ParetoChart.tsx`, `taxModel.ts`, `taxModel.test.ts`; e2e `tax.spec.ts`.

Behaviour:
- Header: "Stillness Tax", and the label **"Exploratory (pre-registration amendment A6)"** read from `paper.status_motion`. One sentence on screen per lens (the G4 kill rule tests exactly this):
  - Price of motion: "How many pixels of drift would you accept for twice the motion? Slide the price; each engine's score is its drift minus that price per doubling of motion over Wan 2.2."
  - Motion floor: "Count only clips that move at least this much, then rank by median drift."
  - Matched-motion band: "Compare engines only on clips whose motion falls inside the same band."
- One lens control (radio group): price · floor · band, `?lens=`.
  - Price: `<input type=range>` 0–3 px, step 0.01, `?p=`. Ticks at the computed crossovers (`priceCrossovers`), each labelled with the engine that takes over and its price (formatted). A one-line caption: the current leader and the price range over which it leads.
  - Floor: a log-scaled range over the basis' motion range (min to the 90th percentile, 200 steps), `?f=`. Shows the per-engine n; unranked engines read "too few (n = k)".
  - Band: two thumbs on the same log scale (`?lo=&hi=`, lo ≤ hi enforced), plus a preset select of the paper's 10 pairs; the two non-overlapping pairs are disabled and say "no overlap". Choosing a preset sets lo and hi to that pair's IQR overlap and highlights the pair's two rows; a result line states the pair's winner, n for each, and "reverses the league" when it does (from `pairwiseBands`). Beside the board, the paper's card: "8 of 10 pairs overlap, 5 are usable, 2 reverse" from `paper.pairwise_bands`.
- Leaderboard (shared by all lenses): rank, engine (colour rule + name), score, n; the leader carries the gold mark. Reordering uses FLIP with WAAPI (240 ms, the design ease); `prefers-reduced-motion` swaps instantly. An `aria-live="polite"` region announces only changes in order, e.g. "Gen-4.5 moves to 1st. Wan 2.2 moves to 2nd." (debounced 400 ms while a slider is dragged).
- Pareto chart (price lens; also shown small beside floor and band): engines at (log2 motion, drift median), the front drawn as a step line, H3 marked "dominated by Gen-4.5" (from `pareto`). Under the price lens, an iso-score line of slope p through the current leader; its intercept moves with p.
- Gen-4.5's rank is framed as motion, never quality: copy says "leads once motion is priced at …", never "best".
- **G4 review layout:** `/tax?view=compare` renders the three lenses side by side (three columns at 1440, stacked at 390), each with its own control and its own board, all three driven from the same basis. This is the page for the gate; it can be removed after G4.

- [ ] **Step 1: failing unit tests** (`taxModel.test.ts`):

```ts
import { it, expect } from "vitest";
import fx from "../../lib/__fixtures__/lenses.json";
import { boardFor, defaultState, floorScale } from "./taxModel";

it("price 0 is the paper's league", () => {
  expect(boardFor(fx as any, { lens: "price", p: 0 }).map((r) => r.engine)).toEqual(["wan22", "gen4_turbo", "ltx23", "gen4.5", "h3-fal"]);
});
it("price past the last crossover puts gen4.5 first", () => {
  const last = fx.crossovers[fx.crossovers.length - 1];
  expect(boardFor(fx as any, { lens: "price", p: last.p_from + 0.01 })[0].engine).toBe("gen4.5");
});
it("band preset reproduces each reversal", () => {
  for (const k of ["gen4_turbo|h3-fal", "gen4_turbo|ltx23"]) {
    const { lo, hi, winner_in_band } = (fx.pairwise as any)[k];
    const b = boardFor(fx as any, { lens: "band", lo, hi });
    const [a, c] = k.split("|");
    const pair = b.filter((r) => r.engine === a || r.engine === c);
    expect(pair[0].engine).toBe(winner_in_band);
  }
});
it("floor scale is monotone and starts at the basis minimum", () => {
  const s = floorScale(fx.basis as any);
  expect(s.toValue(0)).toBeCloseTo(Math.min(...fx.basis.map((r: any) => r.motion)), 12);
  expect(s.toValue(100)).toBeGreaterThan(s.toValue(99));
});
it("default state is price at 0", () => expect(defaultState(new URLSearchParams())).toEqual({ lens: "price", p: 0 }));
```

  `Leaderboard.test.tsx`:

```tsx
import { it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { Leaderboard } from "./Leaderboard";
const row = (engine: string, rank: number) => ({ engine, rank, ranked: true, score: rank, n: 33, drift_median_px: rank });
const names = { wan22: "Wan 2.2", "gen4.5": "Gen-4.5" } as any;

it("announces order changes only", async () => {
  const { rerender } = render(<Leaderboard rows={[row("wan22", 1), row("gen4.5", 2)]} names={names} debounceMs={0} />);
  expect(screen.getByRole("status").textContent).toBe("");
  rerender(<Leaderboard rows={[row("gen4.5", 1), row("wan22", 2)]} names={names} debounceMs={0} />);
  await act(() => new Promise((r) => setTimeout(r, 10)));
  expect(screen.getByRole("status").textContent).toBe("Gen-4.5 moves to 1st. Wan 2.2 moves to 2nd.");
});
```

- [ ] **Step 2: failing e2e** (`tax.spec.ts`):

```ts
import { test, expect } from "./fixtures";
const order = (page: any) => page.getByTestId("board-row").evaluateAll((rs: Element[]) => rs.map((r) => r.getAttribute("data-engine")));

test("price 0 gives the paper's league; the computed crossover flips Gen-4.5 to first", async ({ page }) => {
  await page.goto("/tax?lens=price&p=0");
  await expect(page.getByText(/pre-registration amendment A6/i)).toBeVisible();
  expect(await order(page)).toEqual(["wan22", "gen4_turbo", "ltx23", "gen4.5", "h3-fal"]);
  await page.goto("/tax?lens=price&p=1.3");
  expect((await order(page))[0]).toBe("gen4.5");
});

test("price slider by keyboard reorders and announces", async ({ page }) => {
  await page.goto("/tax?lens=price&p=0");
  const s = page.getByRole("slider", { name: /price/i });
  await s.focus();
  await page.keyboard.press("End");
  await expect(page.getByRole("status")).toContainText(/Gen-4\.5 moves to 1st/);
});

test("band presets reproduce the two reversals", async ({ page }) => {
  await page.goto("/tax?lens=band");
  for (const [pair, winner] of [["gen4_turbo|h3-fal", "h3-fal"], ["gen4_turbo|ltx23", "ltx23"]]) {
    await page.getByLabel(/preset/i).selectOption(pair);
    await expect(page.getByTestId("band-result")).toContainText(/reverses the league/);
    await expect(page.getByTestId("band-result")).toHaveAttribute("data-winner", winner);
  }
  await expect(page.getByTestId("paper-card")).toContainText("5");
});

test("floor marks thin engines as too few", async ({ page }) => {
  await page.goto("/tax?lens=floor&f=0.01");
  await expect(page.getByText(/too few \(n = \d\)/).first()).toBeVisible();
});

test("G4 compare layout shows three lenses", async ({ page }) => {
  await page.goto("/tax?view=compare");
  await expect(page.getByTestId("lens-panel")).toHaveCount(3);
});
```

- [ ] **Step 3:** run → FAIL.
- [ ] **Step 4: implement.** `flip.ts`:

```ts
// FLIP: measure, reorder (React commits), invert, play. Reduced motion → no animation.
export function flip(container: HTMLElement, before: Map<string, DOMRect>, ms = 240, easing = "cubic-bezier(.2,.7,.2,1)") {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (const el of container.querySelectorAll<HTMLElement>("[data-flip]")) {
    const was = before.get(el.dataset.flip!), now = el.getBoundingClientRect();
    if (!was) continue;
    const dy = was.top - now.top;
    if (Math.abs(dy) < 0.5) continue;
    el.getAnimations().forEach((a) => a.cancel());
    el.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: ms, easing });
  }
}
export const measure = (container: HTMLElement) =>
  new Map([...container.querySelectorAll<HTMLElement>("[data-flip]")].map((el) => [el.dataset.flip!, el.getBoundingClientRect()]));
```

  `Leaderboard` measures in a `useLayoutEffect` cleanup-free pattern: keep the previous rects in a ref updated after each `flip` call; call `flip` in `useLayoutEffect` when the order key changes. `taxModel.ts` maps query state to `boardFor` (price → `priceRanking(summary(basis), p)`, floor → `floorRanking`, band → `bandRanking`) and owns `floorScale` (log scale over [min motion, p90 motion], 0–100 → value).
- [ ] **Step 5:** pass (Vitest and all four e2e projects). Commit `feat(web): Stillness Tax with three lenses and a FLIP leaderboard`.

## Task 15: whole-app verification pass

- [ ] `npm test` and `npm run e2e` green on all four projects; `npm run build` with `tsc --noEmit` clean.
- [ ] Playwright MCP screenshots of every view at 1440 and 390, light and dark (into `.playwright-mcp/`); look at each, fix what reads wrong against DESIGN.md.
- [ ] Keyboard-only walk: header nav → Explore grid → player → curve → compare menu → Scatter table → Tax control and slider. Focus always visible, no traps.
- [ ] `break-ui` on the leaderboard and readouts (long engine names, n = 0, null headlines, huge numbers) behind a dev-only `?worst=1` flag; fix what breaks.
- [ ] Contrast check of text tokens in both themes (WCAG AA), and the engine palette through the dataviz validator.
- [ ] Commit `fix(web): verification pass` with whatever changed.

## Task 16: preview deploy, then stop at G4

**Files:** `tools/stage-preview.sh`, `REDEPLOY.md` (preview section), `.env.op` (gitignored; 1Password secret references only), `.env.op.example`.

- [ ] **Step 1:** `tools/stage-preview.sh`:

```bash
#!/usr/bin/env bash
# Build web/ and stage a static preview in deploy/preview/ (its .vercel/ link is kept).
# Media: all posters and panel webps, plus clips and frame-0s for PREVIEW_CLIPS only;
# everything else waits for R2 (G2), and the player says so.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
out="$here/deploy/preview"
PREVIEW_CLIPS=(act-tone-2_campush_gen45 act-tone-2_campush_wan22)
(cd "$here/web" && npm ci && VITE_MEDIA_BASE=/media/ npm run build)
mkdir -p "$out"
rsync -a --delete --exclude .vercel "$here/web/dist/" "$out/"
m="$here/pipeline/out/media"
mkdir -p "$out/media/posters" "$out/media/panels" "$out/media/frame0"
rsync -a "$m/posters/" "$out/media/posters/"
rsync -a --include '*.webp' --exclude '*' "$m/panels/" "$out/media/panels/"
for id in "${PREVIEW_CLIPS[@]}"; do
  src="$(readlink -f "$m"/clips/*/"$id.mp4")"; eng="$(basename "$(dirname "$(ls "$m"/clips/*/"$id.mp4")")")"
  mkdir -p "$out/media/clips/$eng"; cp "$src" "$out/media/clips/$eng/$id.mp4"; cp "$m/frame0/$id.png" "$out/media/frame0/"
done
cat > "$out/vercel.json" <<'JSON'
{
  "cleanUrls": false,
  "rewrites": [{ "source": "/((?!assets/|data/|media/).*)", "destination": "/index.html" }],
  "headers": [
    { "source": "/media/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] },
    { "source": "/(.*)", "headers": [{ "key": "X-Robots-Tag", "value": "noindex" }] }
  ]
}
JSON
du -sh "$out"
```

  The panel PNG originals link to the PNG path; in the preview that link 404s for all but none, so the player links the PNG only when `MEDIA_BASE` is the R2 host (flag `index.media_base === MEDIA_BASE`). Keep the staged size under 90 MB; if posters push it over, drop poster quality to 65 in `media.py` and re-derive.
- [ ] **Step 2:** find the token for the personal Hobby team in 1Password by title only (`op item list --vault <Personal – Dev id> --format json | jq -r '.[].title' | grep -i vercel`). Write `.env.op` with one line, `VERCEL_TOKEN=` followed by the item's secret reference built from vault and item IDs (not names). Never print the value; verify with `op run --env-file=.env.op -- sh -c 'echo len ${#VERCEL_TOKEN}'`.
- [ ] **Step 3:** first deploy links the project on the right team:

```bash
cd deploy/preview
set -a; . ../../.env.local; set +a   # VERCEL_SCOPE
op run --env-file=../../.env.op -- vercel link --yes --scope "$VERCEL_SCOPE" --project stilldrawn-explorer
op run --env-file=../../.env.op -- vercel deploy --yes --scope "$VERCEL_SCOPE"
```

  Confirm the printed URL is on the personal team (`vercel project ls --scope "$VERCEL_SCOPE"`), and that `.vercel/project.json` names that team's org. The preview URL is protected by Vercel's deployment protection, so it is private to Aaron's login. Do not alias it, do not share it, do not deploy `--prod`.
- [ ] **Step 4:** check the preview with Playwright MCP (logged-in session not available headless: if protection blocks it, verify the staged folder locally with `npx vite preview`-equivalent `npx serve deploy/preview -s` and report the preview URL for Aaron to open).
- [ ] **Step 5:** `REDEPLOY.md` gains the preview recipe. Records: STATUS.md round 2 (views) and round 3 (preview), LOG.md public-safe notes, `docs/superpowers/plans` checkboxes ticked. Scan, commit `chore: preview staging and redeploy notes`.
- [ ] **Step 6: stop at G4.** Hand Aaron `/tax?view=compare` on the preview plus screenshots of the three lenses side by side at 1440 (light and dark), each with its one-sentence explanation and the reference setting that reproduces the paper. Ask him to pick the default lens and whether the other two stay as alternates. Nothing after G4 starts until he answers.

---

## Self-review (done while writing)

- Spec coverage: media derivation (T2) · design direction + palette (T3) · scaffold + pinned deps + MEDIA_BASE (T4) · stats/lenses/pareto parity (T5–6) · Explore grid, arms, draws, refused cell (T9) · player, speed, frame step, difference (T10) · drift curve with rVFC, readouts, provenance, notice badges (T11) · compare default + failure gallery (T12) · scatter (T13) · tax, three lenses, FLIP, aria-live, A6 label, presets (T14) · real paths + query state (T8, T16 rewrites) · preview on the personal team via op (T16) · G4 stop (T16.6). Within-engine ρ and zip names were missing from the contract: T1 adds them so no figure is typed.
- Types: `BasisRow`, `Summary`, `BoardRow` are defined in `lenses.ts` and used unchanged in `taxModel.ts` and the tests; `seekFrame`/`frameAt`/`timeFor` live in `useFrameClock.ts`; `gridRows`/`drawsOf`/`clipFor`/`basisRank`/`cellKey`/`ARM_VIEWS` in `model.ts`.
- Not in this phase: `/rate` (Phase 3–4), `/about` (Phase 7), R2 upload (after G2), `impeccable`/motion skills' full pass (Phase 5; T15 is the working check).
