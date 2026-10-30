# Films

Two silent demo films, each in 16:9 and 9:16 with captions: **StillDrawn Explorer** (`p01`, about 70 s) and **blindpanel** (`p10`, 45 s). The capture is scripted and the edit is a list, so a cut can be remade after any change to the site.

Design: `docs/superpowers/specs/2026-10-29-films-design.md`. Plan: `docs/superpowers/plans/2026-10-29-films.md`.

## Remake a cut

```bash
# 1. a production build that streams media from the media host, served locally
cd web && VITE_MEDIA_BASE= npm run build && npx vite preview --port 5320 &

# 2. capture (from web/): slowed 4× on desktop and 2× on phones, so the screenshot loop gets enough frames
FILM_SLOW=4 FILM_URL=http://localhost:5320 npx playwright test -c e2e/film.config.ts --project film-desktop
FILM_SLOW=2 FILM_URL=http://localhost:5320 npx playwright test -c e2e/film.config.ts --project film-phone
#    one beat only: add  -g p01-tax

# 3. cut (from the repo root): both films, both aspects, into film/out/
python3 film/build/edit.py            # or: edit.py p01 --aspect 9x16
```

`python3 -m unittest discover -s film/build` checks the facts the captions quote.

## How it works

| Part | What it does |
|---|---|
| `web/e2e/film.spec.ts` | One test per beat. It drives the real site with a drawn pointer and records JPEG frames at device pixels with their times, plus marks for what is on screen, into `film/capture/<film>/<aspect>/<beat>/` |
| `web/e2e/film/slow.ts` | Slows the page during capture: clips, CSS and WAAPI animations and the script's own waits. `times.json` records the factor, and the edit plays the result back at real speed |
| `web/e2e/film/guard.ts` | Every API call is stubbed or blocked; a capture that tries to submit ratings fails. The rating film never opts in |
| `film/build/facts.py` | Every figure a caption may quote, read from the data contract. A caption with any other figure fails the build |
| `film/build/films.json` | The edit decision list: beats, segments, speeds, captions (templates over the facts), cards |
| `film/build/overlay.html`, `render-overlays.mjs` | Captions, credit chips and cards as HTML in the site's own face, rendered to PNG |
| `film/build/edit.py` | Resamples the frames to 30 fps, overlays, concatenates and exports: films, SRT sidecars, a poster, a silent loop and contact sheets |
| `film/build/record-setup.mjs`, `setup-transcript.json`, `terminal.html` | A real `npm run setup` from a fresh clone of blindpanel, recorded with its timing, replayed in a terminal window for the blindpanel film |

Every clip on screen is credited with its model, taken from the videos actually in view during capture. The only audio is the narration (`film/build/voice.py`, read by a designed Hume Octave voice), set to −14 LUFS; there is no music.

`film/capture/`, `film/out/` and `film/build/out/` are generated and not committed.
