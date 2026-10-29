import { useEffect } from "react";
import "./explore.css";
import { useCore } from "../../data/core";
import { rowKeyOf } from "../../data/model";
import { mediaUrl } from "../../data/media";
import { srcset } from "../../data/srcset";
import { MOTION_WORDS } from "../../data/metrics";
import { Link } from "../../ui/Link";

const AXIS: Record<string, string> = { register: "Register: is it still ink?", content: "Content: is it still the same picture?", framing: "Framing: is it still the same shot?" };

export default function FailureGallery() {
  const core = useCore();
  const url = (p: string) => mediaUrl(core.index.media_base, p);
  const v = core.index.variants;
  const modes = Object.entries(core.taxonomy);
  const axes = [...new Set(modes.map(([, m]) => m.axis))];
  useEffect(() => {
    document.title = "Failure modes · StillDrawn Explorer";
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, []);
  return (
    <main id="main" className="page gallery">
      <div className="title-row"><h1 tabIndex={-1}>Failure modes</h1></div>
      <p className="finding">The paper's taxonomy, with the clips it names as exemplars. These tags were made by hand on {
        new Set(modes.flatMap(([, m]) => m.clips)).size} clips; every other clip is untagged, not clean.</p>
      {axes.map((axis) => (
        <section key={axis} className="g-axis" aria-labelledby={`ax-${axis}`}>
          <h2 id={`ax-${axis}`}>{AXIS[axis] ?? axis}</h2>
          {modes.filter(([, m]) => m.axis === axis).map(([code, m]) => (
            <article key={code} id={code} className="g-mode">
              <div className="g-text">
                <h3><span className="g-code">{code}</span> {m.name} {m.candidate && <span className="chip">Candidate, one exemplar</span>}</h3>
                <p className="muted">{m.definition}</p>
              </div>
              <ul className="g-clips">
                {m.clips.map((id) => {
                  const c = core.clip(id);
                  if (!c) return null;
                  const href = `/explore?cell=${rowKeyOf(c)}&e=${c.engine}${c.draw !== "r1" ? `&draw=${c.draw}` : ""}`;
                  return (
                    <li key={id}>
                      <Link href={href} className="g-clip" data-testid="exemplar">
                        <img src={url(c.media.poster)} srcSet={srcset(url, c.media.poster, v.poster_width, v.posters)}
                          sizes="(max-width: 760px) calc(50vw - 24px), 240px" alt="" width={640} height={Math.round((640 * c.height) / c.width)}
                          loading="lazy" decoding="async" />
                        <span className="g-cap"><strong>{core.engine(c.engine).name}</strong> · {c.panel}, {(MOTION_WORDS[c.motion_class] ?? c.motion_class).toLowerCase()}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}
        </section>
      ))}
    </main>
  );
}
