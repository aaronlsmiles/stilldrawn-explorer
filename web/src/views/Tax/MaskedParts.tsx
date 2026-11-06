// The parts of the masked-drift page (P46 sub-plan D). EXPLORATORY and post-hoc (amendment A9): every
// figure sits under the "Exploratory, post-hoc · A9" chip. Engines are named, never coloured; gold marks only the
// selected engine; text sizes are 12, 14, 16 and 24 (docs/DESIGN.md).
import { Fragment, useId } from "react";
import { useBox, textWidth } from "../../ui/useSize";
import { Link } from "../../ui/Link";
import type { Core, Masked, MaskedRow, MaskedTest1, MaskSet } from "../../data/types";
import { mediaUrl } from "../../data/media";
import { srcset, variant } from "../../data/srcset";
import { fixed, pval, ratio } from "../../lib/format";
import { Runs } from "../About/Runs";
import type { Block } from "../About/thesisMd";
import {
  MARGINS, MASK_LABEL, MASK_SETS, condOf, fitLabel, frameMapper, galleryStroke, marginKey, marginStroke, panelMapper, pxr, regionPath, regionState, slope,
  test1View, type EngineRate, type LeagueRow, type MaskedState, type Mapper, type Pt, type RaterView,
} from "./maskedModel";

export const A9_CHIP = "Exploratory, post-hoc · A9";
export const Chip = () => <span className="chip">{A9_CHIP}</span>;

const NO_VALUE = <span className="faint">no value</span>;
const cell = (v: number | null) => (v === null ? NO_VALUE : pxr(v));

/** Engines in league order; the masked median always sits beside the whole-frame median on the same cells. */
export function LeagueTable({ rows, selected, onSelect }: { rows: LeagueRow[]; selected: string | null; onSelect: (engine: string | null) => void }) {
  return (
    <div className="table-frame" tabIndex={0} role="region" aria-label="Median drift by engine, scrollable">
      <table className="data league-table" aria-label="Median drift on the same cells, whole frame and outside the allowed region">
        <thead>
          <tr><th>Engine</th><th className="r">Clips</th><th className="r">Whole-frame median</th><th className="r">Masked median</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.engine} data-testid="league-row" data-engine={r.engine} className={r.engine === selected ? "is-selected" : undefined}>
              <td className="eng-cell">
                <button type="button" className="btn-text" aria-pressed={r.engine === selected} title={r.name}
                  onClick={() => onSelect(r.engine === selected ? null : r.engine)}>{r.name}</button>
              </td>
              <td className="num">{r.n}</td>
              <td className="num">{cell(r.whole)}</td>
              <td className="num">{cell(r.masked)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const FALLBACK_W = 520;
/** Two columns on one shared scale: the whole frame on the left, outside the allowed region on the right. */
export function Slopegraph({ rows, selected }: { rows: LeagueRow[]; selected: string | null }) {
  const [ref, measured, boxH] = useBox<HTMLDivElement>();
  const width = measured || FALLBACK_W;                 // jsdom and the first paint have no box yet
  const h = Math.max(260, boxH);
  const top = 28;                                       // room for the column heads
  // a long name loses its end, never the figure; the full text sits in a <title>
  const cap = Math.max(60, width * 0.38 - 16);
  const tw0 = (s: string) => textWidth(s.replace(/\d/g, "0"), "600 12px 'Geist'");   // tabular figures are as wide as the zero
  const lab = (r: LeagueRow, v: number | null) => fitLabel(r.name, v === null ? ": no value" : ` ${fixed(v, 2)}`, cap, tw0);
  const ml = Math.ceil(Math.max(...rows.map((r) => tw0(lab(r, r.whole).text)))) + 16;
  const mr = Math.ceil(Math.max(...rows.map((r) => tw0(lab(r, r.masked).text)))) + 16;
  const xl = Math.min(ml, width * 0.4), xr = Math.max(width - mr, width * 0.6);
  const s = slope(rows, h - top);
  const aria = `Median drift on the same cells, whole frame to outside the allowed region, in pixels. ${rows.map((r) =>
    `${r.name} ${r.whole === null ? "no value" : pxr(r.whole)} to ${r.masked === null ? "no value" : pxr(r.masked)}`).join("; ")}.`;
  return (
    <div ref={ref} className="masked-chart">
      <svg width={width} height={h} role="img" aria-label={aria}>
        <text className="axis-label" x={0} y={12}>Whole frame</text>
        <text className="axis-label" x={width} y={12} textAnchor="end">Outside the allowed region</text>
        <line className="col" x1={xl} x2={xl} y1={top} y2={h - 4} />
        <line className="col" x1={xr} x2={xr} y1={top} y2={h - 4} />
        {s.map((p, i) => {
          const r = rows[i], on = r.engine === selected;
          return (
            <g key={p.engine} className={`eng${on ? " is-selected" : ""}`} data-engine={p.engine}>
              {p.line && <line className="slope" x1={xl} y1={p.yl + top} x2={xr} y2={p.yr! + top} />}
              {r.whole !== null && <>
                <circle cx={xl} cy={p.yl + top} r={3.5} />
                <text x={xl - 8} y={p.ly + top} dy="0.32em" textAnchor="end">{lab(r, r.whole).text}<title>{lab(r, r.whole).full}</title></text>
              </>}
              {r.masked !== null && <>
                <circle cx={xr} cy={p.yr! + top} r={3.5} />
                <text x={xr + 8} y={p.ry! + top} dy="0.32em">{lab(r, r.masked).text}<title>{lab(r, r.masked).full}</title></text>
              </>}
              {r.masked === null && <text className="faint" x={xr + 8} y={top + h / 2} dy="0.32em">{lab(r, null).text}<title>{lab(r, null).full}</title></text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** "Show as table": every condition of the chosen cells, each engine's two medians side by side. */
export function GridTable({ m, state, name }: { m: Masked; state: MaskedState; name: (e: string) => string }) {
  const conds = MASK_SETS.flatMap((set) => MARGINS.map((margin) => ({ set, margin, c: condOf(m, { masks: set, margin, split: state.split }) })));
  return (
    <div className="table-frame" tabIndex={0} role="region" aria-label="All six conditions, scrollable">
      <table className="data grid-table" aria-label={`All six conditions for ${state.split === "all" ? "all cells" : state.split + " cells"}: whole-frame to masked median`}>
        <thead>
          <tr><th>Mask set, margin</th>{m.engine_order.map((e) => <th key={e} className="r">{name(e)}</th>)}<th className="r">Gen-4.5/Wan</th></tr>
        </thead>
        <tbody>
          {conds.map(({ set, margin, c }) => (
            <tr key={`${set}${margin}`}>
              <td>{MASK_LABEL[set as MaskSet]}, {margin} px</td>
              {m.engine_order.map((e) => (
                <td key={e} className="num">{c.D_whole_px[e] == null ? "no value" : pxr(c.D_whole_px[e]!)} → {c.D_masked_px[e] == null ? "no value" : pxr(c.D_masked_px[e]!)}</td>
              ))}
              <td className="num">{c.ratio_whole == null ? "n/a" : ratio(c.ratio_whole)} → {c.ratio_masked == null ? "n/a" : ratio(c.ratio_masked)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------ the masks gallery
/** A mask drawn over a panel or a frame: the measured region shaded, the "may move" outline dashed.
 *  `stroke` is the margin's dilation as a stroke width in the overlay's own units (round joins). */
function Overlay({ w, h, polys, map, stroke }: { w: number; h: number; polys: Pt[][]; map: Mapper; stroke: number }) {
  const id = useId().replace(/:/g, "");
  const d = regionPath(polys, map);
  return (
    <svg className="mk-overlay" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" x={0} y={0} width={w} height={h}>
          <rect width={w} height={h} fill="#fff" />
          {d && <path d={d} fill="#000" stroke="#000" strokeWidth={stroke} strokeLinejoin="round" strokeLinecap="round" />}
        </mask>
      </defs>
      <rect className="mk-shade" width={w} height={h} mask={`url(#${id})`} />
      {d && <path className="mk-allowed" d={d} />}
    </svg>
  );
}

const rowLabel = (r: MaskedRow) => `${r.panel} ${r.motion}`;
const NOTHING = "Nothing may move here, so the whole frame is measured";
const LEFT_OUT = "Left out: too few line pixels in the measured region";
const WHOLE = "Nothing left to measure";

function caption(r: MaskedRow, set: MaskSet): string | null {
  if (!r.eligible) return LEFT_OUT;
  const s = regionState(r, set);
  return s === "nothing-allowed" ? NOTHING : s === "whole-panel" ? WHOLE : null;
}

export function Gallery({ core, m, state, onSelect }: { core: Core; m: Masked; state: MaskedState; onSelect: (row: string | null) => void }) {
  const url = (p: string) => mediaUrl(core.index.media_base, p);
  return (
    <div className="mk-gallery">
      <p className="faint small">Drawn on the panel; each engine's frame maps it slightly differently (see the row). Shaded: measured. Clear, dashed outline: where the
        prompt lets the drawing move, widened by the margin.</p>
      <ul className="mk-grid">
        {m.rows.map((r) => {
          const panel = core.panel(r.panel);
          const on = state.row === r.row, cap = caption(r, state.masks);
          const W = panel?.width ?? r.panel_px[0], H = panel?.height ?? r.panel_px[1];
          return (
            <li key={r.row}>
              <button type="button" className={`mk-tile${on ? " is-on" : ""}${r.eligible ? "" : " is-out"}`} data-testid="mk-tile" data-row={r.row} data-eligible={r.eligible}
                aria-pressed={on} aria-label={cap ? undefined : `${rowLabel(r)}, eligible`}   /* a caption makes the name come from the visible text */
                onClick={() => onSelect(r.row)}>
                <span className="mk-frame" style={{ aspectRatio: `${W} / ${H}` }}>
                  {panel && <img src={url(panel.media.webp)} srcSet={srcset(url, panel.media.webp, panel.width, core.index.variants.panels)}
                    sizes="(max-width: 640px) 45vw, 200px" width={W} height={H} loading="lazy" alt="" />}
                  <Overlay w={W} h={H} polys={r.polygons[state.masks]} map={panelMapper([W, H])} stroke={galleryStroke(state.margin, W, H)} />
                </span>
                <span className="mk-cap"><span className="mk-name" title={r.row}>{rowLabel(r)}</span>
                  {cap && <span id={`cap-${r.row}`} className="faint">{cap}</span>}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function RowDetail({ core, m, state, postersOff = false }: { core: Core; m: Masked; state: MaskedState; postersOff?: boolean }) {
  const r = m.rows.find((x) => x.row === state.row);
  if (!r) return null;
  const url = (p: string) => mediaUrl(core.index.media_base, p);
  const key = marginKey(state.margin);
  const legend = caption(r, state.masks);
  const suffix = new Map(core.clips.map((c) => [c.engine, c.id.slice(c.id.lastIndexOf("_") + 1)]));
  if (!r.eligible) {
    return (
      <section className="panel mk-detail" aria-label={`${rowLabel(r)}, left out`} data-a9>
        <div className="panel-head"><h2>{rowLabel(r)}</h2><Chip /></div>
        <p>This row is left out of Test 2: too few line pixels fall in the measured region to score it, so none of its clips count toward a median.</p>
      </section>
    );
  }
  return (
    <section className="panel mk-detail" aria-label={`${rowLabel(r)}, by engine`} data-a9>
      <div className="panel-head"><h2>{rowLabel(r)}</h2><Chip /></div>
      <p className="faint small">Frame 96 is shown; the region applies to every frame. {MASK_LABEL[state.masks]}, {state.margin} px.</p>
      {legend && <p data-testid="mk-legend">{legend}</p>}
      <ul className="mk-posters">
        {m.engine_order.map((e) => {
          const c = r.clips[e], name = core.engine(e).name;
          if (!c) {
            const missing = core.index.missing_cells.find((x) => x.cell === `${r.row}_${suffix.get(e)}`);
            return (
              <li key={e} data-testid="mk-engine" data-engine={e} className="mk-engine is-missing">
                <h3>{name}</h3><p>Not generated</p>{missing && <p className="faint small">{missing.reason}</p>}
              </li>
            );
          }
          const clip = core.clip(c.clip), cell = c.masked[state.masks][key];
          const W = clip?.width ?? r.panel_px[0], H = clip?.height ?? r.panel_px[1];
          return (
            <li key={e} data-testid="mk-engine" data-engine={e} className="mk-engine">
              <h3>{name}</h3>
              {!postersOff && clip && (
                <span className="mk-frame" style={{ aspectRatio: `${W} / ${H}` }}>
                  <img src={url(variant(clip.media.poster, 320))} width={W} height={H} loading="lazy" alt="" />
                  <Overlay w={W} h={H} polys={r.polygons[state.masks]} map={frameMapper(r.panel_px as Pt, [W, H], c.mapping)} stroke={marginStroke(state.margin)} />
                </span>
              )}
              <dl className="mk-vals">
                <div><dt>Whole frame</dt><dd className="num">{c.whole_unscorable || c.whole_px === null ? NO_VALUE : pxr(c.whole_px)}</dd></div>
                <div><dt>Masked</dt><dd className="num">{cell.unscorable || cell.px === null ? NO_VALUE : pxr(cell.px)}</dd></div>
              </dl>
              {cell.f0 < m.test2.min_f0_line_px_in_R && <p className="faint small">Left out of the medians: too few line pixels in the measured region.</p>}
              <Link className="small" href={`/explore?cell=${r.row}&e=${e}`}>Open in Explore</Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ------------------------------------------------------------------ Test 1
const f2 = (v: number | null) => (v === null ? "n/a" : fixed(v, 2));
const num = (v: number | null, dp = 2) => <span className="num">{v === null ? "n/a" : fixed(v, dp)}</span>;
const pnum = (v: number | null) => <span className="num">{v === null ? "n/a" : pval(v)}</span>;

function RateTable({ label, rows, name }: { label: string; rows: EngineRate[]; name: (e: string) => string }) {
  return (
    <div className="table-frame" tabIndex={0} role="region" aria-label={`${label}, scrollable`}>
      <table className="data" aria-label={label}>
        <thead><tr><th>Engine</th><th className="r">n</th><th className="r">Misses</th><th className="r">Miss rate</th><th className="r">Wilson 95 % interval</th><th className="r">Steadiness</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.engine} data-engine={r.engine}>
              <td className="eng-cell">{name(r.engine)}</td>
              <td className="num">{r.n}</td><td className="num">{r.misses}</td><td className="num">{f2(r.rate)}</td>
              <td className="num">{f2(r.lo)} to {f2(r.hi)}</td><td className="num">{r.steadiness === null ? "n/a" : pxr(r.steadiness)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One dot (the miss rate) and one bar (its Wilson interval) per engine, on a 0 to 1 axis. */
function RatePlot({ rater, name }: { rater: RaterView; name: (e: string) => string }) {
  const [ref, measured] = useBox<HTMLDivElement>();
  const w = measured || 360, lab = 110, r = 16, row = 22, top = 4, h = top + rater.engines.length * row + 24;
  const x = (v: number) => lab + v * (w - lab - r);
  const fit = (s: string) => fitLabel(s, "", lab - 12, (t) => textWidth(t, "600 12px 'Geist'"));   // a long engine name loses its end
  const aria = `${rater.id}: miss rate by engine with its Wilson 95 % interval. ${rater.engines.map((e) =>
    `${name(e.engine)} ${f2(e.rate)}, interval ${f2(e.lo)} to ${f2(e.hi)}`).join("; ")}.`;
  return (
    <div ref={ref} className="mk-plot">
      <svg width={w} height={h} role="img" aria-label={aria}>
        {[0, 0.5, 1].map((t) => <g key={t}><line className="col" x1={x(t)} x2={x(t)} y1={top} y2={h - 20} />
          <text className="axis-label" x={x(t)} y={h - 4} textAnchor={t === 0 ? "start" : t === 1 ? "end" : "middle"}>{t === 0 ? "0" : t === 1 ? "1" : "0.5"}</text></g>)}
        {rater.engines.map((e, i) => {
          const y = top + i * row + row / 2;
          return (
            <g key={e.engine} className="eng">
              <text x={lab - 8} y={y} dy="0.32em" textAnchor="end">{fit(name(e.engine)).text}<title>{name(e.engine)}</title></text>
              <line className="slope" x1={x(e.lo)} x2={x(e.hi)} y1={y} y2={y} />
              <circle cx={x(e.rate)} cy={y} r={4} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Rater({ rater, name }: { rater: RaterView; name: (e: string) => string }) {
  return (
    <div className="mk-rater" data-rater={rater.id}>
      <div className="mk-rater-head"><h3>{rater.id}</h3>{rater.tag && <span className="chip">{rater.tag}</span>}</div>
      <p>Spearman ρ between drift and miss rate {num(rater.rho)}; exact one-sided p {pnum(rater.p)}.</p>
      <RateTable label={`${rater.id}: miss rate by engine`} rows={rater.engines} name={name} />
      <RatePlot rater={rater} name={name} />
    </div>
  );
}

export function Test1({ core, t, order }: { core: Core; t: MaskedTest1; order: string[] }) {
  const v = test1View(t, order);
  const name = (e: string) => core.engine(e).name;
  return (
    <section className="panel mk-test1" data-a9 aria-labelledby="mk-t1-h">
      <div className="panel-head"><h2 id="mk-t1-h">Test 1: do the steadiest engines fail to do the requested motion?</h2><Chip /></div>
      <p><span className="chip mk-state">{v.chip}</span></p>
      <p className="muted">Raters, blind to the engine, scored whether each clip did the motion its prompt asked for. A miss is a {v.miss}.
        A negative ρ means the steadier the engine, the more often it misses. {v.attainable}</p>
      {v.verdict ? <p>Verdict: <strong data-testid="test1-verdict">{v.verdict}</strong></p>
        : v.reading ? <p><strong>{v.reading}</strong>. No verdict.</p>
        : <p>No verdict until the second rater's ratings arrive.</p>}
      <p className="faint">{v.rule}</p>
      {v.kappa && <p>Agreement between the raters (quadratic kappa): {v.kappa.map((k, i) => <span key={k.study}>{i ? ", " : ""}{k.study} {num(k.value)}</span>)}.</p>}
      {v.state !== "two-rater" && <p className="faint">Second rater's deadline: {v.deadline}.</p>}
      {v.partialNote && <p>{v.partialNote}</p>}
      <div className="mk-raters">{v.raters.map((r) => <Rater key={r.id} rater={r} name={name} />)}</div>
      {v.r7Note && <p className="faint small" data-testid="r7-note">{v.r7Note}</p>}
      <details className="mk-more">
        <summary>More</summary>
        {v.raters.map((r) => (
          <div key={r.id} className="mk-more-body">
            <p className="mk-more-who">{r.id}</p>
            {r.more.sensitivity && <p>Sensitivity, a miss is a {r.more.sensitivity.miss}: ρ {num(r.more.sensitivity.rho)}, exact one-sided p {pnum(r.more.sensitivity.p)}.
              Miss rates: {r.more.sensitivity.engines.map((e) => `${name(e.engine)} ${f2(e.rate)}`).join("; ")}.</p>}
            {r.more.withinRow && <p>Within-row check: mean ρ {num(r.more.withinRow.meanRho)} over {r.more.withinRow.nRowsDefined} of {r.more.withinRow.nRows} rows
              with a defined value; one-sided p {pnum(r.more.withinRow.p)}.</p>}
            {r.more.auc.length > 0 && <ul className="mk-auc">{r.more.auc.map((a) => (
              <li key={a.study}>Motion AUC, {a.study}: {num(a.auc)} ({a.nMiss} misses, {a.nNonmiss} others). <strong>{a.reading}</strong></li>))}</ul>}
          </div>
        ))}
      </details>
    </section>
  );
}

// ------------------------------------------------------------------ the write-up (MASKED-DRIFT.md)
/** The write-up's blocks (h2, paragraphs, lists) and its four links; the h1 is the page's own. A figure is a bug: there are none in v1. */
export function Writeup({ blocks, repo }: { blocks: Block[]; repo: string }) {
  return (
    <section className="panel mk-writeup" data-a9 aria-labelledby="mk-writeup-h">
      <div className="panel-head"><h2 id="mk-writeup-h">What this means</h2><Chip /></div>
      <article className="thesis" lang="en-GB">
        {blocks.map((b, i) => {
          if (b.type === "h2") return <h3 key={i}><Runs xs={b.inlines} /></h3>;
          if (b.type === "p") return <p key={i}><Runs xs={b.inlines} /></p>;
          if (b.type === "ul") return <ul key={i}>{b.items.map((it, k) => <li key={k}><Runs xs={it} /></li>)}</ul>;
          if (b.type === "figure") throw new Error("the masked-drift write-up has no figures in v1");
          return <Fragment key={i} />;   // the h1 is drawn once, above
        })}
      </article>
      <p className="small">
        <a href={`${repo}/blob/a9-registered/docs/PREREGISTRATION.md`} rel="noopener">The registered plan (A9)</a>{" · "}
        <a href={`${repo}/blob/main/docs/PREREGISTRATION.md`} rel="noopener">The results record</a>{" · "}
        <a href={`${repo}/blob/a9-registered/metrics/masked.py`} rel="noopener">The code</a>{" · "}
        <a href={`${repo}/blob/main/analysis/out/a9_masked_drift.json`} rel="noopener">The data</a>
      </p>
    </section>
  );
}
