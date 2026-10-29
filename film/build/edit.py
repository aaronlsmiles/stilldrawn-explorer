"""Cuts the films from the capture (film/capture/, made by web/e2e/film.spec.ts) and films.json.

    python3 film/build/edit.py [p01|p10 ...] [--aspect 16x9|9x16]

Writes film/out/<film>-<aspect>.mp4 (30 fps, H.264, no audio), <film>-<aspect>.srt, <film>-poster.jpg (from 16:9),
<film>-loop.mp4 (16:9, no overlays), contact-<film>-<aspect>.jpg and report.json. Every caption is checked
against facts.json before anything is rendered.
"""
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

import facts as F

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
CAPTURE = ROOT / "film/capture"
OUT = ROOT / "film/out"
WORK = HERE / "out"
FPS = 30
SIZE = {"16x9": (1920, 1080), "9x16": (1080, 1920)}
SURFACE = "0xecebe7"
X264 = ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", str(FPS)]


def ff(*args):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *map(str, args)], check=True)


def pick(v, aspect):
    return v[aspect] if isinstance(v, dict) and aspect in v else v


class Capture:
    """One beat's frames, frame times and marks, in film time (seconds, divided by the capture's slow factor)."""

    def __init__(self, d: Path):
        t = json.loads((d / "times.json").read_text())
        self.dir, self.size, s = d, tuple(t["size"]), t["slow"]
        self.frames = [(f["i"], f["t"] / s) for f in t["frames"]]
        self.marks = [{**m, "t": m["t"] / s} for m in json.loads((d / "events.json").read_text())]
        self.end = self.frames[-1][1]

    def at(self, spec):
        """A capture time from a number or a mark reference ('name=value#n+off')."""
        if isinstance(spec, (int, float)):
            return float(spec)
        m = re.fullmatch(r"([a-z-]+?)(?:=([\w.]+))?(?:#(\d+))?([+-][\d.]+)?", spec)
        if not m:
            raise ValueError(f"bad time {spec!r}")
        name, val, nth, off = m.groups()
        if name == "end":
            base = self.end
        else:
            hits = [k for k in self.marks if k["name"] == name and (val is None or val in map(str, (k.get("data") or {}).values()))]
            if len(hits) < int(nth or 1):
                raise ValueError(f"no mark {spec!r} in {self.dir}")
            base = hits[int(nth or 1) - 1]["t"]
        return base + float(off or 0)

    def clip_names(self):
        """[(capture time, [engine names in view])] from the 'clip' marks."""
        return [(m["t"], m["data"]["names"]) for m in self.marks if m["name"] == "clip"]


class Beat:
    """Maps capture time to output time over a beat's segments, and output time back."""

    def __init__(self, cap, segs):
        self.cap, self.segs, t = cap, [], 0.0
        for s in segs:
            a, b, v = cap.at(s["in"]), cap.at(s["out"]), float(s.get("speed", 1))
            self.segs.append((a, b, v, t))
            t += (b - a) / v
        self.length = t

    def out(self, ct):
        for a, b, v, o in self.segs:
            if a <= ct <= b:
                return o + (ct - a) / v
        return None

    def rel(self, spec):
        """A caption time: a number is output time; a mark reference is mapped from capture time."""
        if isinstance(spec, (int, float)):
            return float(spec)
        if spec == "end":
            return self.length
        t = self.out(self.cap.at(spec))
        if t is None:
            raise ValueError(f"{spec!r} falls outside the beat's segments")
        return t


def credit_line(names, credit, note):
    if not names:
        return None
    s = ("Clip: " if len(names) == 1 else "Clips: ") + " · ".join(credit[n] for n in names)
    return f"{s} · {note}" if note else s


TEMPLATE = hashlib.sha1((HERE / "overlay.html").read_bytes()).hexdigest()


def overlay_id(o):
    """A content hash, the template's included, so a changed overlay.html never reuses a stale PNG."""
    return o["kind"] + "-" + hashlib.sha1((TEMPLATE + json.dumps(o, sort_keys=True)).encode()).hexdigest()[:12]


def render(overlays):
    lst = WORK / "overlays.json"
    lst.write_text(json.dumps(overlays))
    subprocess.run(["node", str(HERE / "render-overlays.mjs"), str(lst), str(WORK / "png")], check=True)


def segment_video(cap, a, b, speed, aspect, dest):
    """Frames whose times fall in [a, b] → a 30 fps clip at real speed ÷ `speed`, padded to the film's frame."""
    fr = [(i, t) for i, t in cap.frames if a - 0.05 <= t <= b]
    lines = []
    for k, (i, t) in enumerate(fr):
        nxt = fr[k + 1][1] if k + 1 < len(fr) else b
        lines += [f"file '{cap.dir / f'{i:05d}.jpg'}'", f"duration {max(nxt - max(t, a), 0.001) / speed:.5f}"]
    lines.append(f"file '{cap.dir / f'{fr[-1][0]:05d}.jpg'}'")
    lst = dest.with_suffix(".txt")
    lst.write_text("\n".join(lines) + "\n")
    w, h = SIZE[aspect]
    vf = f"fps={FPS},scale={w}:-2:flags=lanczos,pad={w}:{h}:0:0:color={SURFACE},setsar=1"
    ff("-f", "concat", "-safe", "0", "-i", lst, "-vf", vf, *X264, "-crf", 12, "-preset", "veryfast", dest)


def still_video(png, seconds, dest):
    ff("-loop", 1, "-t", f"{seconds:.3f}", "-i", png, "-vf", f"fps={FPS},format=yuv420p", *X264, "-crf", 12, "-preset", "veryfast", dest)


def cut(film_id, film, aspect, facts, credit):
    W = WORK / film_id / aspect
    W.mkdir(parents=True, exist_ok=True)
    fill = lambda s: s.format(**facts)
    plan, overlays, srt = [], [], []
    t_film = 0.0
    for beat in film["beats"]:
        name = beat["name"]
        if "capture" in beat:
            cap = Capture(CAPTURE / film_id / aspect / beat["capture"])
            b = Beat(cap, [{k: pick(v, aspect) for k, v in seg.items()} for seg in pick(beat["segments"], aspect)])
            caps = []
            for c in beat.get("captions", []):
                text = fill(pick(c["text"], aspect))
                F.check_caption(text, facts)
                caps.append((b.rel(pick(c["from"], aspect)), b.rel(pick(c["to"], aspect)), text))
            chips = [(b.out(t) if b.out(t) is not None else (0.0 if t < b.segs[0][0] else None), n) for t, n in cap.clip_names()]
            chips = sorted([(t, n) for t, n in chips if t is not None], key=lambda x: x[0])
            # band states: piecewise constant between every caption, chip and segment boundary
            cuts = sorted({0.0, b.length, *[x for c in caps for x in c[:2]], *[t for t, _ in chips], *[s[3] for s in b.segs]})
            bands = []
            for lo, hi in zip(cuts, cuts[1:]):
                if hi - lo < 1e-3:
                    continue
                mid = (lo + hi) / 2
                cap_text = next((c[2] for c in caps if c[0] <= mid < c[1]), None)
                names = next((n for t, n in reversed(chips) if t <= mid), [])
                speed = next((s[2] for s in b.segs if s[3] <= mid < s[3] + (s[1] - s[0]) / s[2]), 1)
                o = {"kind": "band", "aspect": aspect}
                if pick(beat.get("band"), aspect) and aspect == "16x9":
                    o["pos"] = pick(beat["band"], aspect)
                chip = credit_line(names, credit, film.get("chip_note"))
                if chip:
                    o["chip"] = chip
                if speed != 1:
                    o["badge"] = f"×{speed:g}"
                if cap_text:
                    o["caption"] = cap_text
                if any(k in o for k in ("chip", "badge", "caption")):
                    o["id"] = overlay_id(o)
                    overlays.append(o)
                    if bands and bands[-1][2] == o["id"] and abs(bands[-1][1] - lo) < 1e-6:
                        bands[-1] = (bands[-1][0], hi, o["id"])
                    else:
                        bands.append((lo, hi, o["id"]))
            for lo, hi, text in caps:
                srt.append((t_film + lo, t_film + hi, text))
            plan.append({"name": name, "kind": "capture", "cap": cap, "beat": b, "bands": bands, "start": t_film, "length": b.length, "captions": caps})
            t_film += b.length
        else:
            spec = beat.get("card") or beat["end"]
            o = {"kind": "card" if "card" in beat else "end", "aspect": aspect}
            for k, v in spec.items():
                o[k] = [fill(x) for x in v] if isinstance(v, list) else fill(v)
            for text in [o.get("title", ""), o.get("sub", ""), o.get("eyebrow", ""), *o.get("lines", [])]:
                F.check_caption(text, facts)
            o["id"] = overlay_id(o)
            overlays.append(o)
            plan.append({"name": name, "kind": "card", "png": o["id"], "start": t_film, "length": beat["seconds"], "text": o})
            t_film += beat["seconds"]
    render(overlays)

    parts = []
    for k, p in enumerate(plan):
        dest = W / f"{k:02d}-{p['name']}.mp4"
        if p["kind"] == "card":
            still_video(WORK / "png" / f"{p['png']}.png", p["length"], dest)
        else:
            segs = []
            for j, (a, b_, v, _) in enumerate(p["beat"].segs):
                s = W / f"{k:02d}-{p['name']}-s{j}.mp4"
                segment_video(p["cap"], a, b_, v, aspect, s)
                segs.append(s)
            raw = W / f"{k:02d}-{p['name']}-raw.mp4"
            if len(segs) == 1:
                segs[0].replace(raw)
            else:
                (W / "segs.txt").write_text("".join(f"file '{s}'\n" for s in segs))
                ff("-f", "concat", "-safe", "0", "-i", W / "segs.txt", "-c", "copy", raw)
            ins, chain, last = ["-i", raw], [], "0:v"
            for n, (lo, hi, oid) in enumerate(p["bands"], 1):
                ins += ["-i", WORK / "png" / f"{oid}.png"]
                chain.append(f"[{last}][{n}:v]overlay=0:0:enable='between(t,{lo:.3f},{hi - 1e-3:.3f})'[v{n}]")
                last = f"v{n}"
            if chain:
                ff(*ins, "-filter_complex", ";".join(chain), "-map", f"[{last}]", "-t", f"{p['length']:.3f}", *X264, "-crf", 12, "-preset", "veryfast", dest)
            else:
                ff("-i", raw, "-t", f"{p['length']:.3f}", *X264, "-crf", 12, "-preset", "veryfast", dest)
        parts.append(dest)
    (W / "parts.txt").write_text("".join(f"file '{p}'\n" for p in parts))
    OUT.mkdir(exist_ok=True)
    final = OUT / f"{film_id}-{aspect}.mp4"
    ff("-f", "concat", "-safe", "0", "-i", W / "parts.txt", *X264, "-crf", 18, "-preset", "slow", "-movflags", "+faststart", "-an", final)
    (OUT / f"{film_id}-{aspect}.srt").write_text(to_srt(srt))
    contact(final, plan, OUT / f"contact-{film_id}-{aspect}.jpg", aspect)
    return final, plan


def ts(t):
    ms = round(t * 1000)
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def to_srt(items):
    return "".join(f"{k}\n{ts(a)} --> {ts(b)}\n{text}\n\n" for k, (a, b, text) in enumerate(items, 1))


def contact(video, plan, dest, aspect):
    """One frame per caption (or per card), in order, tiled."""
    times = []
    for p in plan:
        if p["kind"] == "card":
            times.append(p["start"] + p["length"] / 2)
        else:
            times += [p["start"] + (a + b) / 2 for a, b, _ in p["captions"]] or [p["start"] + p["length"] / 2]
    frames = []
    for k, t in enumerate(times):
        f = dest.parent / f".{dest.stem}-{k:02d}.jpg"
        ff("-ss", f"{t:.3f}", "-i", video, "-frames:v", 1, "-q:v", 3, f)
        frames.append(f)
    cols = 4 if aspect == "16x9" else 6
    w = 640 if aspect == "16x9" else 360
    rows = (len(frames) + cols - 1) // cols
    ins = sum([["-i", f] for f in frames], [])
    fc = "".join(f"[{k}]scale={w}:-2[s{k}];" for k in range(len(frames))) + "".join(f"[s{k}]" for k in range(len(frames)))
    ff(*ins, "-filter_complex", f"{fc}concat=n={len(frames)}:v=1:a=0,tile={cols}x{rows}:padding=8:color=0xe2e2de", "-frames:v", 1, "-q:v", 3, dest)
    for f in frames:
        f.unlink()


def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,r_frame_rate", "-of", "json", str(path)], capture_output=True, text=True, check=True)
    j = json.loads(r.stdout)
    v = [s for s in j["streams"] if s["codec_type"] == "video"][0]
    return {"seconds": round(float(j["format"]["duration"]), 2), "size": f"{v['width']}x{v['height']}", "fps": v["r_frame_rate"],
            "audio": "none" if not any(s["codec_type"] == "audio" for s in j["streams"]) else "present"}


def extras(film_id, film, plan16):
    """Poster (1280×720) and silent loop (no overlays) from the 16:9 capture."""
    p = next(x for x in plan16 if x["name"] == film["poster"]["beat"])
    video = OUT / f"{film_id}-16x9.mp4"
    ff("-ss", f"{p['start'] + film['poster']['at']:.3f}", "-i", video, "-frames:v", 1, "-vf", "scale=1280:720:flags=lanczos", "-q:v", 2, OUT / f"{film_id}-poster.jpg")
    lp = film["loop"]
    cap = next(x for x in plan16 if x["kind"] == "capture" and x["cap"].dir.name == lp["beat"])["cap"]
    a = cap.at(lp["from"])
    tmp = WORK / film_id / "loop-raw.mp4"
    segment_video(cap, a, min(a + lp["seconds"], cap.end), 1, "16x9", tmp)
    ff("-i", tmp, "-vf", "scale=1280:720:flags=lanczos", *X264, "-crf", 20, "-preset", "slow", "-movflags", "+faststart", "-an", OUT / f"{film_id}-loop.mp4")


def main(argv):
    aspects = [argv[argv.index("--aspect") + 1]] if "--aspect" in argv else ["16x9", "9x16"]
    cfg = json.loads((HERE / "films.json").read_text())
    ids = [a for a in argv if a in cfg["films"]] or list(cfg["films"])
    WORK.mkdir(exist_ok=True)
    facts = F.build()
    (WORK / "facts.json").write_text(json.dumps(facts, indent=1) + "\n")
    report_path = OUT / "report.json"
    report = json.loads(report_path.read_text()) if report_path.exists() else {}
    for fid in ids:
        film = cfg["films"][fid]
        for aspect in aspects:
            final, plan = cut(fid, film, aspect, facts, cfg["credit"])
            r = probe(final)
            lo, hi = film["target"]
            r["in_target"] = lo <= r["seconds"] <= hi
            r["beats"] = [{"name": p["name"], "start": round(p["start"], 2), "seconds": round(p["length"], 2)} for p in plan]
            report[f"{fid}-{aspect}"] = r
            print(f"{final.name}: {r['seconds']} s, {r['size']}, {r['fps']} fps, audio {r['audio']}, target {lo}–{hi} s: {'ok' if r['in_target'] else 'MISS'}")
            if aspect == "16x9":
                extras(fid, film, plan)
    report_path.write_text(json.dumps(report, indent=1) + "\n")


if __name__ == "__main__":
    main(sys.argv[1:])
