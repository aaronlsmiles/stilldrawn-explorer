"""Writes film/narration.md, the narration transcript, from films.json and the facts (the one source).

    python3 film/build/transcript.py
"""
import json
from pathlib import Path

import facts as F

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / "film/narration.md"
TITLES = {"p01": "StillDrawn Explorer (P01)", "p10": "blindpanel (P10)"}


def cell(v):
    return v.replace("|", "\\|")


def main():
    cfg = json.loads((HERE / "films.json").read_text())
    facts = F.build()
    v = cfg["voice"]
    md = ["# Narration", "",
          "Generated from `film/build/films.json` by `film/build/transcript.py`; edit the list, not this file. Each line is read by the film's voice and, unless marked *spoken only*, shown as the subtitle. Every figure comes from the data contract (`film/build/facts.py`). Lines play in order from their marks; the picture runs on if a line needs longer.", "",
          f"**Voice:** {v['name']} ({'saved, id in films.json' if v.get('id') else 'not yet designed'}). Design prompt: \"{v['design']}\" Acting direction: \"{v['acting']}\"", ""]
    for fid, film in cfg["films"].items():
        md += [f"## {TITLES.get(fid, fid)}", "", "| Beat | Spoken | Subtitle |", "|---|---|---|"]
        chars = 0
        for beat in film["beats"]:
            for c in beat.get("captions", []):
                say = (c.get("say") or c.get("text"))
                say = say["16x9"] if isinstance(say, dict) else say
                text = c.get("text")
                text = text["16x9"] if isinstance(text, dict) else text
                say_f = say.format(**facts) if say else ""
                sub = "*spoken only*" if c.get("show") is False or not text else text.format(**facts)
                chars += len(say_f)
                md.append(f"| {beat['name']} | {cell(say_f)} | {cell(sub)} |")
        md += ["", f"About {chars} characters (16:9 wording).", ""]
    OUT.write_text("\n".join(md))
    print(OUT)


if __name__ == "__main__":
    main()
