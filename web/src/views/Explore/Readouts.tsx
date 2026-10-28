import type { Clip, Core, Metric } from "../../data/types";
import { METRICS } from "../../data/types";
import { HEADLINE } from "../../data/metrics";
import { basisRank } from "../../data/model";
import { fixed, norm, ordinal, px, sig } from "../../lib/format";
import { Link } from "../../ui/Link";

export const fmtHeadline = (m: Metric, v: number | null) => (v == null ? null : HEADLINE[m].dp === "px" ? px(v) : sig(v, 3));

function Value({ clip, m, core }: { clip: Clip; m: Metric; core: Core }) {
  const v = fmtHeadline(m, clip.h[m]);
  if (v == null) return <span className="dash" title="Not defined for this clip">—</span>;
  const r = basisRank(core.clips, clip, m);
  return (
    <>
      <span className="num">{v}</span>
      {r && <span className="rank faint">{ordinal(r.rank)} lowest of {r.of}</span>}
    </>
  );
}

export function Readouts({ clips, core }: { clips: Clip[]; core: Core }) {
  const threshold = core.paper.departure_threshold_px.value;
  const name = (c: Clip) => core.engine(c.engine).name;
  return (
    <section className="panel readouts" data-testid="readouts" aria-labelledby="readouts-h">
      <h2 id="readouts-h">Readouts</h2>
      <table className="data" data-testid={clips.length > 1 ? "compare-table" : undefined}>
        <thead><tr><th>Headline</th>{clips.map((c) => <th key={c.id} className="num">{name(c)}</th>)}</tr></thead>
        <tbody>
          {METRICS.map((m) => (
            <tr key={m}>
              <th scope="row"><span className="rd-name">{HEADLINE[m].name}</span><span className="rd-what faint">{HEADLINE[m].what}</span></th>
              {clips.map((c) => <td key={c.id} className="num"><Value clip={c} m={m} core={core} /></td>)}
            </tr>
          ))}
          <tr>
            <th scope="row"><span className="rd-name">Motion</span><span className="rd-what faint">Median optical flow, px and normalised</span></th>
            {clips.map((c) => (
              <td key={c.id} className="num"><span className="num">{fixed(c.motion.median_px, 2)} px</span><span className="rank faint">{norm(c.motion.median_norm)}</span></td>
            ))}
          </tr>
        </tbody>
      </table>
      {clips.map((c) => (
        <div key={c.id} className="flags">
          {clips.length > 1 && <span className="flags-name">{name(c)}</span>}
          {c.departed
            ? <span className="pill-neg">Departed: line drift over {threshold} px</span>
            : <span className="faint small">Stayed under the {threshold} px departure line</span>}
          {c.tags.map((t) => (
            <Link key={t} className="pill" href={`/explore/failures#${t}`} title={core.taxonomy[t]?.definition}>
              {t} · {core.taxonomy[t]?.name}
            </Link>
          ))}
        </div>
      ))}
    </section>
  );
}
