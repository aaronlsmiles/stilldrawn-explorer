// Stillness Tax: the reader sets the exchange rate between stability and motion that the paper
// declines to set. EXPLORATORY (pre-registration amendment A6). G4 (28 Oct): price of motion is the
// default, the matched-motion band the alternate; the motion floor and the three-lens compare layout
// are archived (tag g4-three-lenses).
import { useEffect, useMemo, type ReactNode } from "react";
import "./tax.css";
import { useCore } from "../../data/core";
import { useQuery } from "../../router";
import { MIN_N, pairwiseBands, priceCrossovers, summary, type BasisRow, type PairBand } from "../../lib/lenses";
import { onLowerHull, pareto } from "../../lib/pareto";
import { fixed, norm, px } from "../../lib/format";
import { ANALYSED } from "../../data/model";
import { Segmented } from "../../ui/Segmented";
import { PlainNote } from "../../plainwords/PlainWords";
import { Leaderboard } from "./Leaderboard";
import { ParetoChart, StripChart } from "./TaxCharts";
import { LENSES, P_MAX, boardFor, motionScale, parseState, stateToQuery, type LensId, type LensState } from "./taxModel";

type Derived = ReturnType<typeof useDerived>;
function useDerived(raw: { id: string; engine: string; motion: number; drift: number | null }[]) {
  return useMemo(() => {
    const basis = raw.map((b) => ({ ...b, drift: b.drift ?? NaN })) as BasisRow[];
    const summ = summary(basis);
    const front = pareto(summ);
    const pairs = pairwiseBands(basis, summ);
    const segs = priceCrossovers(summ, P_MAX);
    const scale = motionScale(basis);
    const neverLead = front.frontier.filter((e) => !onLowerHull(summ, e));
    return { basis, summ, front, pairs, segs, scale, neverLead };
  }, [raw]);
}

const defaultFor = (lens: LensId, d: Derived): LensState =>
  lens === "price" ? { lens, p: 0 }
  : (() => { const k = "gen4_turbo|ltx23"; return { lens, lo: d.pairs[k].lo, hi: d.pairs[k].hi, preset: k }; })();

function PriceControls({ s, d, set, name }: { s: Extract<LensState, { lens: "price" }>; d: Derived; set: (s: LensState) => void; name: (e: string) => string }) {
  return (
    <div className="lens-controls">
      <label className="slider">
        <span className="field-label">Price of motion: <strong className="val">{fixed(s.p, 2)} px</strong> of drift per doubling</span>
        <input type="range" min={0} max={P_MAX} step={0.01} value={s.p} aria-label="Price of motion, pixels of drift per doubling of motion"
          aria-valuetext={`${fixed(s.p, 2)} px per doubling`} onChange={(e) => set({ lens: "price", p: Number(e.target.value) })} />
        <span className="ticks" aria-hidden="true">
          {d.segs.slice(1).map((g) => <i key={g.p_from} style={{ left: `${(g.p_from / P_MAX) * 100}%` }} />)}
        </span>
      </label>
      <ul className="segs" aria-label="Who leads at which price">
        {d.segs.map((g) => {
          const on = s.p >= g.p_from && (s.p < g.p_to || (g.p_to === P_MAX && s.p <= P_MAX));
          return (
            <li key={g.p_from}>
              <button type="button" className={`seg-jump${on ? " is-on" : ""}`} onClick={() => set({ lens: "price", p: +((g.p_from + g.p_to) / 2).toFixed(2) })}>
                {name(g.leader)} leads <span className="faint">{fixed(g.p_from, 2)}–{fixed(g.p_to, 2)} px</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BandControls({ s, d, set, name }: { s: Extract<LensState, { lens: "band" }>; d: Derived; set: (s: LensState) => void; name: (e: string) => string }) {
  const lo = d.scale.toStep(s.lo), hi = d.scale.toStep(s.hi);
  return (
    <div className="lens-controls band-controls">
      <label className="ctl">
        <span className="field-label">Preset: the paper's pairwise bands</span>
        <select className="select" value={s.preset ?? ""} onChange={(e) => {
          const k = e.target.value;
          if (!k) return set({ ...s, preset: null });
          set({ lens: "band", lo: d.pairs[k].lo, hi: d.pairs[k].hi, preset: k });
        }}>
          <option value="">Custom band</option>
          {Object.entries(d.pairs).map(([k, v]) => {
            const [a, b] = k.split("|");
            return <option key={k} value={k} disabled={!v.overlaps}>{name(a)} and {name(b)}{v.overlaps ? "" : " (no overlap)"}</option>;
          })}
        </select>
      </label>
      <div className="band-sliders">
        <label className="slider">
          <span className="field-label">From <strong className="val">{norm(s.lo)}</strong></span>
          <input type="range" min={0} max={d.scale.steps} value={lo} aria-label="Band lower edge" aria-valuetext={`motion from ${norm(s.lo)}`}
            onChange={(e) => set({ lens: "band", lo: d.scale.toValue(Math.min(Number(e.target.value), hi)), hi: s.hi, preset: null })} />
        </label>
        <label className="slider">
          <span className="field-label">To <strong className="val">{norm(s.hi)}</strong></span>
          <input type="range" min={0} max={d.scale.steps} value={hi} aria-label="Band upper edge" aria-valuetext={`motion up to ${norm(s.hi)}`}
            onChange={(e) => set({ lens: "band", lo: s.lo, hi: d.scale.toValue(Math.max(Number(e.target.value), lo)), preset: null })} />
        </label>
      </div>
    </div>
  );
}

function BandResult({ k, rec, d, name }: { k: string; rec: PairBand; d: Derived; name: (e: string) => string }) {
  const [a, b] = k.split("|");
  const nA = (rec[a] as { n: number; drift_median: number | null } | undefined), nB = (rec[b] as typeof nA);
  if (!rec.usable || !nA || !nB) {
    return <p className="band-result" data-testid="band-result">Too few clips in this band to compare {name(a)} with {name(b)}
      {nA && nB ? ` (n = ${nA.n} and ${nB.n})` : ""}: the paper needs {MIN_N} each.</p>;
  }
  const w = rec.winner_in_band!;
  const W = w === a ? nA : nB, Lr = w === a ? nB : nA;
  const leagueWinner = d.summ[a].drift_median_px < d.summ[b].drift_median_px ? a : b;
  return (
    <p className="band-result" data-testid="band-result" data-winner={w}>
      In {name(a)} and {name(b)}'s shared motion range, <strong>{name(w)}</strong> drifts less: {px(W.drift_median!)} against {px(Lr.drift_median!)}
      {" "}(n = {W.n} and {Lr.n}). Over all its clips {name(leagueWinner)} drifts less, so {rec.reverses_league ? <strong>this reverses the league</strong> : "this agrees with the league"}.
    </p>
  );
}

function finding(s: LensState, d: Derived, rows: ReturnType<typeof boardFor>, name: (e: string) => string) {
  const lead = rows[0];
  const thin = rows.filter((r) => !r.ranked).length;
  if (s.lens === "price") {
    const g = d.segs.find((x) => s.p >= x.p_from && s.p <= x.p_to) ?? d.segs[0];
    const never = d.neverLead.length ? ` ${d.neverLead.map(name).join(" and ")} never leads: it is on the Pareto front but above the line joining its neighbours.` : "";
    return `At ${fixed(s.p, 2)} px per doubling, ${name(lead.engine)} leads, as it does from ${fixed(g.p_from, 2)} to ${fixed(g.p_to, 2)} px.${never}`;
  }
  const range = `clips with motion from ${norm(s.lo)} to ${norm(s.hi)}`;
  if (!lead?.ranked) return `No engine has five ${range}.`;
  return `Among ${range}, ${name(lead.engine)} has the lowest median line drift (${px(lead.score!)}, n = ${lead.n}).${thin ? ` ${thin} of ${rows.length} engines ${thin === 1 ? "has" : "have"} too few clips to rank.` : ""}`;
}

function LensPanel({ s, set, d, name, paperCard }: {
  s: LensState; set: (s: LensState) => void; d: Derived; name: (e: string) => string;
  paperCard: ReactNode;
}) {
  const rows = useMemo(() => boardFor(d, s), [d, s]);
  const meta = LENSES.find((l) => l.id === s.lens)!;
  const pair = s.lens === "band" && s.preset ? s.preset.split("|") : null;

  return (
    <section className="lens-panel" data-testid="lens-panel" aria-label={meta.name}>
      <p className="lens-sentence">{meta.sentence}</p>
      {s.lens === "price" && <PlainNote id="tax.slider" />}
      {s.lens === "price" && <PriceControls s={s} d={d} set={set} name={name} />}
      {s.lens === "band" && <BandControls s={s} d={d} set={set} name={name} />}
      <p className="lens-finding" aria-live="off">{finding(s, d, rows, name)}</p>
      <div className="lens-body">
        <div className="panel board-panel">
          <Leaderboard rows={rows} name={name} scoreLabel={s.lens === "price" ? "Score" : "Median drift"} pair={pair} showDoublings={s.lens === "price"} />
          {s.lens === "band" && s.preset && d.pairs[s.preset] && <BandResult k={s.preset} rec={d.pairs[s.preset]} d={d} name={name} />}
          {s.lens === "band" && paperCard}
        </div>
        <div className="panel chart-panel">
          {s.lens === "price"
            ? <ParetoChart summ={d.summ} front={d.front.frontier} dominatedBy={d.front.dominated_by} p={s.p} leader={rows[0].engine} name={name} />
            : <StripChart basis={d.basis} engines={[...ANALYSED]} lo={s.lo} hi={s.hi} name={name} scaleMin={d.scale.min} scaleMax={d.scale.max} />}
        </div>
      </div>
    </section>
  );
}

export default function Tax() {
  const core = useCore();
  const [q, set] = useQuery();
  const d = useDerived(core.basis);
  const name = (e: string) => core.engine(e).name;
  // a bare ?lens=band (no edges, no preset) means the lens's default, as choosing the lens does
  const bare = q.get("lens") === "band" && !q.has("lo") && !q.has("hi") && !q.has("preset");
  const parsed = bare ? defaultFor("band", d) : parseState(q);
  // A preset's band is the pair's exact IQR overlap, never a value read back from the URL.
  const s: LensState = parsed.lens === "band" && parsed.preset && d.pairs[parsed.preset]?.overlaps
    ? { ...parsed, lo: d.pairs[parsed.preset].lo, hi: d.pairs[parsed.preset].hi } : parsed;
  const pb = core.paper.pairwise_bands.value;
  const status = core.paper.status_motion.value;
  useEffect(() => { document.title = "Stillness Tax · StillDrawn Explorer"; }, []);
  const paperCard = (
    <p className="paper-card" data-testid="paper-card">
      In the paper: {pb.overlapping} of {Object.keys(d.pairs).length} pairs overlap in motion, {pb.usable} are usable (n ≥ {pb.min_n} each),
      and {pb.reversals.length} reverse the league ({pb.reversals.map((k) => k.split("|").map(name).join(" and ")).join("; ")}).
    </p>
  );
  return (
    <main id="main" className="page tax">
      <div className="title-row">
        <h1 tabIndex={-1}>Stillness Tax</h1>
        <span className="chip">{status.charAt(0).toUpperCase() + status.slice(1)}</span>
      </div>
      <p className="finding">The paper reports a Pareto front and declines to set an exchange rate between stability and motion. Set one here.
        Gen-4.5's rank changes because it moves more, not because it looks better.</p>
      <div className="lens-switch">
        <Segmented label="Lens" value={s.lens} options={LENSES.map((l) => ({ value: l.id, label: l.name }))}
          onChange={(lens: LensId) => set({ ...stateToQuery(defaultFor(lens, d)) })} />
      </div>
      <LensPanel s={s} set={(v) => set(stateToQuery(v))} d={d} name={name} paperCard={paperCard} />
    </main>
  );
}
