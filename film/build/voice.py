"""Narration for the films with Hume's Octave TTS: design a voice, save it, then read every line.

Run under op run so the key never sits in a file (it reads HUME_API_KEY):
    op run --env-file=$HOME/projects/studio/tools/hume.env.op -- python3 film/build/voice.py <command>

Commands (each prints the characters it would send and stops unless --yes is given; characters are what Hume bills):
    design                  one candidate voice per "voice.variants" entry (shared "voice.design" + the variant), or
                            --n N from "voice.design" alone; reads "voice.audition"; writes film/vo/design/<label>.wav
                            and design.json (prompts, generation ids)
    save <generation_id>    save that candidate to the account's voice library as "voice.name"; records its id in
                            films.json
    lines [p01 p10]         read every narration line not yet read with the saved voice; writes
                            film/vo/<film>/<key>.wav and lines.json (text, generation id, duration, characters)

A line's key is a hash of its spoken text, the voice id and the acting direction, so editing a line reads only
that line again. film/vo/ is not committed (the reads are paid; keep a copy).
"""
import base64
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import facts as F

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
VO = ROOT / "film/vo"
API = "https://api.hume.ai/v0/tts"


def post(url, body):
    key = os.environ.get("HUME_API_KEY")
    if not key:
        sys.exit("HUME_API_KEY is not set: run under op run with the studio's tools/hume.env.op")
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                 headers={"X-Hume-Api-Key": key, "Content-Type": "application/json"})
    for attempt in range(7):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            # 429 is a per-minute request quota, not a character limit: wait and try again
            if e.code == 429 and attempt < 6:
                wait = 15 * (attempt + 1)
                print(f"  rate-limited by Hume; waiting {wait} s", flush=True)
                time.sleep(wait)
                continue
            sys.exit(f"Hume {e.code}: {e.read().decode(errors='replace')[:500]}")


def wav_of(gen):
    return base64.b64decode(gen["audio"])


def narration(cfg, film_id, facts):
    """Every spoken line of a film, in order: (key, spoken text). Lines are the captions' "say" (or "text")."""
    out, seen = [], set()
    for beat in cfg["films"][film_id]["beats"]:
        for c in beat.get("captions", []):
            for aspect in ("16x9", "9x16"):  # a line that differs by aspect is read once per wording
                say = c.get("say", c.get("text"))
                say = say.get(aspect) if isinstance(say, dict) else say
                if not say:
                    continue
                say = say.format(**facts)
                F.check_caption(say, facts)
                k = line_key(cfg, say)
                if k not in seen:
                    seen.add(k)
                    out.append((k, say))
    return out


def line_key(cfg, say):
    v = cfg["voice"]
    return hashlib.sha1(json.dumps([say, v.get("id"), v.get("acting", ""), v.get("speed", 1)]).encode()).hexdigest()[:12]


def gate(chars, what):
    print(f"{what}: {chars} characters")
    if "--yes" not in sys.argv:
        print("not sent: add --yes to spend them")
        sys.exit(0)


def design(cfg):
    """One candidate per variant in "voice.variants" (the shared "voice.design" plus the variant's own line), or N
    candidates from "voice.design" alone when there are no variants."""
    v = cfg["voice"]
    variants = v.get("variants") or [{"label": str(k), "description": ""} for k in range(1, 1 + (int(sys.argv[sys.argv.index("--n") + 1]) if "--n" in sys.argv else 3))]
    gate(len(v["audition"]) * len(variants), f"design: {len(variants)} candidate voices reading the audition line")
    out = VO / "design"
    out.mkdir(parents=True, exist_ok=True)
    log = []
    for var in variants:
        prompt = " ".join(x for x in (var["description"], v["design"]) if x)
        g = post(API, {"utterances": [{"text": v["audition"], "description": prompt}], "format": {"type": "wav"}})["generations"][0]
        (out / f"{var['label']}.wav").write_bytes(wav_of(g))
        log.append({"label": var["label"], "prompt": prompt, "generation_id": g["generation_id"], "duration": g["duration"]})
        print(f"{var['label']}: film/vo/design/{var['label']}.wav ({g['duration']:.1f} s) generation {g['generation_id']}")
    (out / "design.json").write_text(json.dumps({"audition": v["audition"], "candidates": log}, indent=1) + "\n")


def save(cfg, gen_id):
    gate(0, f"save generation {gen_id} as \"{cfg['voice']['name']}\"")
    r = post(API + "/voices", {"generation_id": gen_id, "name": cfg["voice"]["name"]})
    cfg["voice"]["id"] = r["id"]
    (HERE / "films.json").write_text(json.dumps(cfg, indent=1, ensure_ascii=False) + "\n")
    print(f"saved voice {r['name']} ({r['provider']}) id {r['id']} into films.json")


def lines(cfg, ids):
    v = cfg["voice"]
    if not v.get("id"):
        sys.exit("no saved voice yet: run design, listen, then save <generation_id>")
    facts = F.build()
    todo = []
    for fid in ids:
        d = VO / fid
        for k, say in narration(cfg, fid, facts):
            if not (d / f"{k}.wav").exists():
                todo.append((fid, k, say))
    gate(sum(len(s) for *_, s in todo), f"lines: {len(todo)} to read")
    context = {}
    for fid, k, say in todo:
        d = VO / fid
        d.mkdir(parents=True, exist_ok=True)
        log_path = d / "lines.json"
        log = json.loads(log_path.read_text()) if log_path.exists() else {}
        utt = {"text": say, "voice": {"id": v["id"], "provider": "CUSTOM_VOICE"}}
        if v.get("acting"):
            utt["description"] = v["acting"]
        if v.get("speed"):
            utt["speed"] = v["speed"]
        body = {"utterances": [utt], "format": {"type": "wav"}}
        # the picked candidate's audition sets the delivery for every line (else the film's first read does)
        first = v.get("context_generation") or context.get(fid) or next((x["generation_id"] for x in log.values()), None)
        if first:  # the film's first read sets the delivery the rest follow
            body["context"] = {"generation_id": first}
        g = post(API, body)["generations"][0]
        (d / f"{k}.wav").write_bytes(wav_of(g))
        context.setdefault(fid, g["generation_id"])
        log[k] = {"text": say, "generation_id": g["generation_id"], "duration": g["duration"], "characters": len(say)}
        log_path.write_text(json.dumps(log, indent=1, ensure_ascii=False) + "\n")
        print(f"{fid} {k} {g['duration']:.2f} s  {say}")


def main():
    cfg = json.loads((HERE / "films.json").read_text())
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "design":
        design(cfg)
    elif cmd == "save" and len(sys.argv) > 2:
        save(cfg, sys.argv[2])
    elif cmd == "lines":
        lines(cfg, [a for a in sys.argv[2:] if a in cfg["films"]] or list(cfg["films"]))
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
