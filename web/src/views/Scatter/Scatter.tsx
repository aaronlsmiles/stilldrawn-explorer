// Motion vs drift: one point per clip on log axes, engine medians as labelled crosses.
// Engines are named, never coloured (docs/DESIGN.md); the chosen engine is the one gold.
import { useEffect, useMemo, useState } from "react";
import { useWidth } from "../../ui/useSize";
import { scaleLog } from "d3-scale";
import "./scatter.css";
import { useCore } from "../../data/core";
import { useQuery, navigate } from "../../router";
import { METRICS, type Metric } from "../../data/types";
import { HEADLINE } from "../../data/metrics";
import { ANALYSED, rowKeyOf } from "../../data/model";
import type { BasisRow } from "../../lib/lenses";
import { norm, pval, ratio, rho as fmtRho } from "../../lib/format";
import { Segmented } from "../../ui/Segmented";
import { Link } from "../../ui/Link";
import { points, medianCross, spreadLabels, type Pt, type Cross } from "./scatterModel";
import { fmtHeadline } from "../Explore/Readouts";

const EXTRA_ARMS = [
  { id: "repeat", label: "Repeat draws" }, { id: "hazard", label: "Hazard draws (H3)" },
  { id: "ground", label: "Ground variants" }, { id: "seedance", label: "Seedance (scout)" },
];
const M = { l: 56, r: 24, t: 16, b: 40 };

/** Log ticks at 1, 2 and 5 of each decade, thinned to fit. */
function logTicks(lo: number, hi: number, max: number) {
  const out: number[] = [];
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++)
    for (const m of [1, 2, 5]) { const v = m * 10 ** e; if (v >= lo && v <= hi) out.push(v); }
  if (out.length <= max) return out;
  const decades = out.filter((v) => Math.abs(Math.log10(v) % 1) < 1e-9);
  return decades.length >= 2 ? decades : out.filter((_, i) => i % Math.ceil(out.length / max) === 0);
}
const tickText = (v: number) => (v >= 1 ? String(+v.toPrecision(2)) : norm(v, 1));
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const href = (p: Pt) => `/explore?cell=${rowKeyOf(p.clip)}&e=${p.engine}${p.clip.draw !== "r1" ? `&draw=${p.clip.draw}` : ""}`;

function Chart({ pts, crosses, metric, hl, names, onHover, hover }: {
  pts: Pt[]; crosses: Cross[]; metric: Metric; hl: string | null; names: (e: string) => string;
  onHover: (p: Pt | null, x?: number, y?: number) => void; hover: Pt | null;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const height = width < 600 ? 340 : 480;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x = scaleLog().domain([Math.min(...xs) * 0.9, Math.max(...xs) * 1.1]).range([M.l, Math.max(M.l + 10, width - (width < 600 ? 64 : 96))]);
  const y = scaleLog().domain([Math.min(...ys) * 0.8, Math.max(...ys) * 1.25]).range([height - M.b, M.t]);
  const [x0, x1] = x.domain(), [y0, y1] = y.domain();
  const labelY = spreadLabels(crosses.map((c) => y(c.y)), 14, M.t, height - M.b);
  const ordered = [...pts].sort((a, b) => Number(a.engine === hl) - Number(b.engine === hl));
  const yName = HEADLINE[metric].name + (HEADLINE[metric].unit ? ` (${HEADLINE[metric].unit})` : "");
  return (
    <div ref={ref} className="sc-chart">
      {width > 0 && (
        <svg width={width} height={height} role="img"
          aria-label={`Scatter of ${pts.length} clips: median optical flow against ${yName}, both on log scales. Engine medians: ${crosses
            .map((c) => `${names(c.engine)} motion ${norm(c.x)}, ${fmtHeadline(metric, c.y)}`).join("; ")}.`}
          onPointerLeave={() => onHover(null)}>
          {logTicks(y0, y1, 6).map((t) => (
            <g key={`y${t}`}><line className="grid" x1={M.l} x2={x.range()[1]} y1={y(t)} y2={y(t)} />
              <text className="tick" x={M.l - 8} y={y(t)} dy="0.32em" textAnchor="end">{tickText(t)}</text></g>
          ))}
          {logTicks(x0, x1, width < 600 ? 4 : 7).map((t) => (
            <text key={`x${t}`} className="tick" x={x(t)} y={height - M.b + 18} textAnchor="middle">{tickText(t)}</text>
          ))}
          <line className="base" x1={M.l} x2={x.range()[1]} y1={height - M.b} y2={height - M.b} />
          <text className="axis-label" x={x.range()[1]} y={height - 4} textAnchor="end">Motion: median optical flow, normalised (log)</text>
          <text className="axis-label" data-testid="y-label" x={M.l} y={M.t - 4}>{yName} (log)</text>
          <g>
            {ordered.map((p) => (
              <circle key={p.id} data-testid="pt" cx={x(p.x)} cy={y(p.y)} r={p.engine === hl ? 4.5 : 3.5}
                className={`pt${p.arm === "primary" ? "" : " pt-hollow"}${p.engine === hl ? " is-hl" : ""}${hover?.id === p.id ? " is-hover" : ""}`}
                onPointerEnter={(e) => onHover(p, e.clientX, e.clientY)} onClick={() => navigate(href(p))} />
            ))}
          </g>
          {crosses.map((c, i) => {
            const on = c.engine === hl;
            return (
              <g key={c.engine} className={`cross${on ? " is-hl" : ""}`}>
                <line x1={x(c.x25)} x2={x(c.x75)} y1={y(c.y)} y2={y(c.y)} />
                <line x1={x(c.x)} x2={x(c.x)} y1={y(c.y25)} y2={y(c.y75)} />
                <rect x={x(c.x) - 4} y={y(c.y) - 4} width={8} height={8} />
                <text x={x(c.x75) + 6} y={labelY[i]} dy="0.32em" className="cross-label">{names(c.engine)}</text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

export default function Scatter() {
  const core = useCore();
  const [q, set] = useQuery();
  const metric: Metric = METRICS.includes(q.get("y") as Metric) ? (q.get("y") as Metric) : "line";
  const arms = useMemo(() => new Set(["primary", ...(q.get("arms") ?? "").split(",").filter((a) => EXTRA_ARMS.some((x) => x.id === a))]), [q]);
  const hl = ANALYSED.includes(q.get("hl") as (typeof ANALYSED)[number]) ? q.get("hl") : null;
  const [table, setTable] = useState(false);
  const [hover, setHover] = useState<{ p: Pt; x: number; y: number } | null>(null);
  const basis = core.basis.map((b) => ({ ...b, drift: b.drift ?? NaN })) as BasisRow[];
  const pts = useMemo(() => points(core.clips, basis, metric, arms), [core.clips, core.basis, metric, arms]); // eslint-disable-line react-hooks/exhaustive-deps
  const crosses = ANALYSED.map((e) => medianCross(pts, e)).filter((c): c is Cross => !!c);
  const names = (e: string) => core.engine(e).name;
  const paper = core.paper;
  const er = paper.engine_rho_motion_drift.value;
  const within = paper.within_engine_rho.value;
  useEffect(() => { document.title = "Motion vs drift · StillDrawn Explorer"; }, []);
  const toggleArm = (id: string, on: boolean) => {
    const next = [...arms].filter((a) => a !== "primary" && a !== id);
    if (on) next.push(id);
    set({ arms: next.length ? next.sort().join(",") : null });
  };
  return (
    <main id="main" className="page scatter">
      <div className="title-row"><h1 tabIndex={-1}>Motion vs drift</h1><span className="chip">{cap(paper.status_motion.value)}</span></div>
      <p className="finding" data-testid="finding">
        The engines that move more drift more: across the {er.n_engines} engines, motion and line drift rank together
        with Spearman ρ = {fmtRho(er.rho)} (exact p = {er.p_exact_two_sided.toFixed(3)},
        {" "}{er.n_engines} engines). Gen-4.5 moves {ratio(paper.gen45_motion_vs_wan22.value)} as much as Wan 2.2
        {" "}and {ratio(paper.gen45_motion_vs_gen4_turbo.value)} as much as Gen-4 Turbo.
      </p>
      <div className="sc-controls">
        <Segmented label="Drift measure" value={metric} options={METRICS.map((m) => ({ value: m, label: HEADLINE[m].name }))}
          onChange={(m) => set({ y: m === "line" ? null : m })} />
        <fieldset className="sc-arms">
          <legend className="seg-label">Also show</legend>
          {EXTRA_ARMS.map((a) => (
            <label key={a.id} className="check"><input type="checkbox" checked={arms.has(a.id)} onChange={(e) => toggleArm(a.id, e.target.checked)} /> {a.label}</label>
          ))}
        </fieldset>
        <button type="button" className="btn" aria-pressed={table} onClick={() => setTable(!table)}>{table ? "Show as chart" : "Show as table"}</button>
      </div>
      <div className="sc-body">
        <section className="panel sc-plot" aria-label="Scatter">
          {table ? (
            <div className="sc-table-wrap">
              <table className="data">
                <thead><tr><th>Clip</th><th>Engine</th><th className="r">Motion</th><th className="r">{HEADLINE[metric].name}</th></tr></thead>
                <tbody>
                  {[...pts].sort((a, b) => a.engine.localeCompare(b.engine) || a.x - b.x).map((p) => (
                    <tr key={p.id}><td><Link href={href(p)}>{p.id}</Link></td><td>{names(p.engine)}</td>
                      <td className="num">{norm(p.x)}</td><td className="num">{fmtHeadline(metric, p.y)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Chart pts={pts} crosses={crosses} metric={metric} hl={hl} names={names} hover={hover?.p ?? null}
              onHover={(p, x, y) => setHover(p ? { p, x: x!, y: y! } : null)} />
          )}
          <p className="faint small sc-note">Filled points are the {crosses.reduce((s, c) => s + c.n, 0)} standard cells the paper analyses; hollow points are
            {arms.size > 1 ? " the other arms you added and" : ""} the six FLINT pairs, which no cross-engine comparison uses. Crosses mark each engine's median with its interquartile range. Click a point to open the clip.</p>
        </section>
        <section className="panel sc-side" aria-labelledby="sc-eng">
          <h2 id="sc-eng">Engines</h2>
          <fieldset className="sc-eng-list">
            <legend className="visually-hidden">Highlight an engine</legend>
            <table className="data">
              <thead><tr><th>Engine</th><th className="r">Motion</th><th className="r">{HEADLINE[metric].name}</th><th className="r">ρ within</th></tr></thead>
              <tbody>
                <tr><td colSpan={4}><label className="radio-row"><input type="radio" name="hl" checked={!hl} onChange={() => set({ hl: null })} /> None</label></td></tr>
                {crosses.map((c) => {
                  const w = within[c.engine]?.[metric];
                  return (
                    <tr key={c.engine} className={c.engine === hl ? "is-hl" : undefined}>
                      <td><label className="radio-row"><input type="radio" name="hl" checked={c.engine === hl} onChange={() => set({ hl: c.engine })} /> {names(c.engine)}</label></td>
                      <td className="num">{norm(c.x)}</td>
                      <td className="num">{fmtHeadline(metric, c.y)}</td>
                      <td className="num">{w ? <>{fmtRho(w.rho)}<span className="faint small"> p {pval(w.p)}</span></> : <span className="dash">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </fieldset>
          <p className="faint small">Medians over each engine's standard cells. ρ within is the paper's Spearman correlation of motion with this measure inside each engine, with its p.</p>
        </section>
      </div>
      {hover && !table && (
        <div className="sc-tip" role="tooltip" style={{ left: hover.x + 12, top: hover.y + 12 }}>
          <strong>{hover.p.id}</strong><br />{names(hover.p.engine)} · motion {norm(hover.p.x)} · {fmtHeadline(metric, hover.p.y)}
        </div>
      )}
    </main>
  );
}
