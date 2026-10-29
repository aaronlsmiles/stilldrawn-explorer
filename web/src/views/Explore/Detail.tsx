import { Suspense, use, useEffect, useState, type KeyboardEvent } from "react";
import type { Clip, Core, SeriesKey } from "../../data/types";
import { loadSeries, retrySeries } from "../../data/load";
import { Boundary } from "../../ui/Boundary";
import { MOTION_WORDS, SERIES } from "../../data/metrics";
import { drawsOf } from "../../data/model";
import { isLiveHost } from "../../data/media";
import { basisRank } from "../../data/model";
import { fixed, norm, ordinal, px } from "../../lib/format";
import { Segmented } from "../../ui/Segmented";
import { Link } from "../../ui/Link";
import { usePlayer, type Player } from "./useFrameClock";
import { Media, Toolbar } from "./Player";
import { DriftCurve, SeriesTable, valueAtFrame, type CurveLine } from "./DriftCurve";
import { Readouts } from "./Readouts";
import { Provenance } from "./Provenance";

type Sel = { row: string; engine: string; vs: string | null; draw: string | null };
export type DetailProps = {
  core: Core; url: (p: string) => string; sel: Sel; a: Clip | undefined; b: Clip | undefined;
  engines: string[]; missingReason: string | null; series: Exclude<SeriesKey, "motion">; diff: boolean;
  set: (patch: Record<string, string | null>) => void; onBack: (() => void) | null; wide: boolean;
};

const DRAW_WORD = (d: string) => (d === "r1" ? "Main" : d === "r2" ? "Repeat" : d.toUpperCase());
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function Finding({ a, b, core }: { a: Clip; b?: Clip; core: Core }) {
  const name = (c: Clip) => core.engine(c.engine).name;
  const rank = (c: Clip) => {
    const r = basisRank(core.clips, c, "line");
    return r ? `${ordinal(r.rank)} steadiest of its ${r.of} cells` : null;
  };
  if (!b || a.h.line == null || b.h.line == null) {
    const r = rank(a);
    return <><strong>{name(a)}: line drift {a.h.line == null ? "not defined" : px(a.h.line)}</strong>{r ? `, ${r}` : ""}; motion {norm(a.motion.median_norm)}.</>;
  }
  // the contrast first: within-engine ranks side by side read as equal when the drift is not
  const [hi, lo] = a.h.line >= b.h.line ? [a, b] : [b, a];
  const ratio = hi.h.line! / lo.h.line!;
  const ra = rank(a), rb = rank(b);
  return (
    <>
      <strong>On this panel, {name(hi)} drifts {lo.h.line! > 0 && ratio >= 1.1 ? `${ratio.toFixed(1)}× as far as` : "about as far as"} {name(lo)}</strong>
      {" "}({fixed(hi.h.line!, 2)} against {px(lo.h.line!)}).
      {ra && rb ? ` ${name(a)} is the ${ra}, ${name(b)} the ${rb}` : ""}; motion {norm(a.motion.median_norm)} against {norm(b.motion.median_norm)}.
    </>
  );
}

function Curve({ a, b, core, series, player, set }: {
  a: Clip; b?: Clip; core: Core; series: Exclude<SeriesKey, "motion">; player: Player; set: DetailProps["set"];
}) {
  const sa = use(loadSeries(a.engine))[a.id];
  const sb = b ? use(loadSeries(b.engine))[b.id] : undefined;
  const [table, setTable] = useState(false);
  const hasTone = sa?.tone != null && (!b || sb?.tone != null);
  const key: Exclude<SeriesKey, "motion"> = series === "tone" && !hasTone ? "line" : series;
  if (!sa) return <p className="faint">No per-frame series for this clip.</p>;
  const name = (c: Clip) => core.engine(c.engine).name;
  const lines: CurveLine[] = [{ label: name(a), values: sa[key] as number[], emphasis: true }];
  if (b && sb) lines.push({ label: name(b), values: sb[key] as number[], emphasis: false });
  const motion: CurveLine[] = [{ label: name(a), values: sa.motion, emphasis: true }];
  if (b && sb) motion.push({ label: name(b), values: sb.motion, emphasis: false });
  const opts = (Object.keys(SERIES) as (keyof typeof SERIES)[])
    .filter((k) => k !== "tone" || hasTone)
    .map((k) => ({ value: k, label: SERIES[k].name }));
  const vt = (f: number) => {
    const parts = lines.map((l) => {
      const v = valueAtFrame(l.values, key, f);
      return `${l.label} ${v == null ? "not defined" : +v.toPrecision(3)}`;
    });
    if (f === 0 && lines.every((l) => valueAtFrame(l.values, key, 0) == null)) return `Frame 0 is the reference: ${SERIES[key].name} measures every later frame against it`;
    return `Frame ${f}, ${SERIES[key].name}: ${parts.join(", ")}`;
  };
  return (
    <section className="panel curve-panel" aria-labelledby="curve-h">
      <div className="panel-head">
        <h2 id="curve-h">Per frame</h2>
        <Segmented label="Series" hideLabel value={key} options={opts} onChange={(v) => set({ series: v === "line" ? null : v })} />
      </div>
      <p className="curve-read" aria-hidden="true">{vt(player.frame)}</p>
      <DriftCurve lines={lines} motion={motion} seriesKey={key} nFrames={a.n_frames} frame={player.frame}
        onSeek={(f) => { player.pause(); player.seekFrame(f); }} yLabel={SERIES[key].axis} valueText={vt} />
      <button type="button" className="btn-text small" aria-expanded={table} onClick={() => setTable(!table)}>
        {table ? "Hide values" : "Show values"}
      </button>
      {table && <SeriesTable lines={lines} seriesKey={key} />}
    </section>
  );
}

const CurveWaiting = () => <section className="panel curve-panel" aria-busy="true"><h2>Per frame</h2><div className="curve-skeleton" /></section>;

function Loaded({ core, url, a, b, sel, engines, series, diff, set, onBack, wide }: DetailProps & { a: Clip }) {
  const big = !wide && a.bytes > 10e6;   // phones: large clips wait for an explicit play
  // phones: the source panel is the largest paint; the clips (autoplay, posters) and the curve's data
  // wait for it, or 2.5 s at most, so they don't share a slow connection with it
  const [painted, setPainted] = useState(wide);
  useEffect(() => {
    if (wide) return setPainted(true);
    setPainted(false);
    const t = setTimeout(() => setPainted(true), 2500);
    return () => clearTimeout(t);
  }, [a.panel, wide]);
  const player = usePlayer({ fps: a.fps, nFrames: a.n_frames, clipKey: a.id + (b?.id ?? ""), autoplay: !big && !reducedMotion() && painted });
  const draws = drawsOf(core.clips, a.cell);
  const others = engines.filter((e) => e !== sel.engine);
  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest("input, select, textarea")) return;
    if (e.key === "k" || (e.key === " " && !t.closest("button, a, [role=slider]"))) { e.preventDefault(); player.toggle(); }
    else if (e.key === ",") { e.preventDefault(); player.step(-1); }
    else if (e.key === ".") { e.preventDefault(); player.step(1); }
    else if (e.key === "d") { e.preventDefault(); set({ diff: diff ? null : "1" }); }
  };
  const panel = core.panel(a.panel);
  const live = isLiveHost(core.index.media_base);
  return (
    <section className="detail" data-testid="player" onKeyDown={onKey} aria-labelledby="detail-h">
      {onBack && <button type="button" className="btn-text back" onClick={onBack}>All cells</button>}
      <div className="title-row">
        <h1 id="detail-h" tabIndex={-1}>
          {a.panel} · {MOTION_WORDS[a.motion_class] ?? a.motion_class} · {core.engine(a.engine).name}
          {b && <> <span className="muted">vs</span> {core.engine(b.engine).name}</>}
        </h1>
        {a.arm !== "primary" && <span className="chip">{a.arm === "seedance" ? "Scout, not analysed" : a.arm}</span>}
      </div>
      <p className="finding">
        <Finding a={a} b={b} core={core} />
      </p>
      <div className="detail-controls">
        <Segmented label="Engine" value={sel.engine} options={engines.map((e) => ({ value: e, label: core.engine(e).name }))}
          onChange={(e) => set({ e, vs: sel.vs === e ? null : sel.vs, draw: null })} />
        {others.length > 0 && (
          <label className="ctl">
            <span className="field-label">Compare with</span>
            <select className="select" value={sel.vs ?? ""} onChange={(ev) => set({ vs: ev.target.value || null })}>
              <option value="">Nothing</option>
              {others.map((e) => <option key={e} value={e}>{core.engine(e).name}</option>)}
            </select>
          </label>
        )}
        {draws.length > 1 && (
          <Segmented label="Draw" value={a.draw} options={draws.map((d) => ({ value: d.draw, label: DRAW_WORD(d.draw) }))}
            onChange={(d) => set({ draw: d === "r1" ? null : d })} />
        )}
      </div>
      <Media panel={panel} a={a} b={b} engines={core.engine} url={url} player={player} diff={diff} lazyBig={!wide}
        deferred={!painted} onPanelLoad={() => setPainted(true)}
        panelOriginal={live && panel ? url(panel.media.png) : null} />
      <Toolbar player={player} nFrames={a.n_frames} diff={diff} setDiff={(d) => set({ diff: d ? "1" : null })} big={big} bytes={a.bytes} />
      <p className="faint small keys-hint">With the player focused: K or Space plays and pauses, comma and full stop step a frame, D shows the difference.</p>
      {diff && <p className="faint small diff-note">Each clip minus its own first frame. Black means unchanged; line drift measures this against frame 0.</p>}
      <Boundary key={`${a.id}|${b?.id ?? ""}`} onRetry={() => retrySeries(a.engine, ...(b ? [b.engine] : []))}
        fallback={(_, retry) => (
          <section className="panel curve-panel"><h2>Per frame</h2>
            <p className="muted" role="alert">Couldn't load the per-frame series. <button type="button" className="btn-text" onClick={retry}>Retry</button></p>
          </section>
        )}>
        <Suspense fallback={<CurveWaiting />}>
          {painted ? <Curve a={a} b={b} core={core} series={series} player={player} set={set} /> : <CurveWaiting />}
        </Suspense>
      </Boundary>
      <div className="detail-foot">
        <Readouts clips={b ? [a, b] : [a]} core={core} />
        <div className="prov-col">
          <Provenance clip={a} core={core} open={wide} />
          {b && <Provenance clip={b} core={core} open={false} />}
        </div>
      </div>
    </section>
  );
}

export function Detail(props: DetailProps) {
  const { a, core, sel, onBack, missingReason } = props;
  if (!a) {
    return (
      <section className="detail" data-testid="player" aria-labelledby="detail-h">
        {onBack && <button type="button" className="btn-text back" onClick={onBack}>All cells</button>}
        <h1 id="detail-h" tabIndex={-1}>{sel.row.replace(/_/g, " · ")} · {core.engine(sel.engine)?.name ?? sel.engine}</h1>
        <p className="finding">Not generated. {missingReason}</p>
        <div className="frame-media is-empty" style={{ aspectRatio: "16 / 9" }} />
      </section>
    );
  }
  return <Loaded {...props} a={a} />;
}

export function DetailEmpty() {
  return (
    <section className="detail detail-empty" data-testid="player-empty">
      <h1 tabIndex={-1}>Contact sheet</h1>
      <p className="finding">Pick a frame on the sheet to play it beside its source, or start with the drift test:
        {" "}<Link href="/explore?cell=act-tone-2_campush&e=gen4.5&vs=wan22">act-tone-2, camera push, Gen-4.5 against Wan 2.2</Link>.</p>
    </section>
  );
}
