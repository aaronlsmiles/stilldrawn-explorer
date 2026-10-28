// Two small charts for the lenses. Pareto: engine medians with the price's iso-score line.
// Strips: every basis clip by motion, one row per engine, with the counted range shaded.
import { scaleLinear, scaleLog } from "d3-scale";
import type { BasisRow, Summary } from "../../lib/lenses";
import { priceLines } from "../../lib/pareto";
import { norm } from "../../lib/format";
import { useWidth } from "../../ui/useSize";
import { spreadLabels } from "../Scatter/scatterModel";

export function ParetoChart({ summ, front, dominatedBy, p, leader, name, compact = false }: {
  summ: Summary; front: string[]; dominatedBy: Record<string, string[]>; p: number; leader: string;
  name: (e: string) => string; compact?: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const L = priceLines(summ, "wan22");
  const es = Object.keys(L);
  const h = compact ? 220 : 300, m = { l: 44, r: compact ? 16 : 24, t: 12, b: 36 };
  const xs = es.map((e) => L[e].x), ys = es.map((e) => L[e].drift);
  const x = scaleLinear().domain([Math.min(0, ...xs) - 0.2, Math.max(...xs) + 0.4]).range([m.l, Math.max(m.l + 10, width - m.r)]);
  const y = scaleLinear().domain([0, Math.max(...ys) * 1.15]).nice(4).range([h - m.b, m.t]);
  const frontPts = front.map((e) => L[e]).sort((a, b) => a.x - b.x);
  const lead = L[leader];
  const [x0, x1] = x.domain();
  const iso = (xx: number) => lead.drift + p * (xx - lead.x);
  const labelY = spreadLabels(es.map((e) => y(L[e].drift)), 13, m.t, h - m.b);
  return (
    <div ref={ref} className="tax-chart">
      {width > 0 && (
        <svg width={width} height={h} role="img"
          aria-label={`Engine medians: doublings of motion over Wan 2.2 against median line drift. ${es.map((e) =>
            `${name(e)} ${L[e].x.toFixed(2)} doublings, ${L[e].drift.toFixed(2)} px`).join("; ")}. The Pareto front is ${front.map(name).join(", ")}.`}>
          <defs><clipPath id={`clip-${compact ? "c" : "f"}`}><rect x={m.l} y={m.t} width={x.range()[1] - m.l} height={h - m.b - m.t} /></clipPath></defs>
          {y.ticks(4).map((t) => (
            <g key={t}><line className={t === 0 ? "base" : "grid"} x1={m.l} x2={x.range()[1]} y1={y(t)} y2={y(t)} />
              <text className="tick" x={m.l - 6} y={y(t)} dy="0.32em" textAnchor="end">{t}</text></g>
          ))}
          {x.ticks(compact ? 3 : 5).filter(Number.isInteger).map((t) => (
            <text key={t} className="tick" x={x(t)} y={h - m.b + 16} textAnchor="middle">{t}</text>
          ))}
          <text className="axis-label" x={x.range()[1]} y={h - 4} textAnchor="end">Doublings of motion over Wan 2.2</text>
          <text className="axis-label" x={m.l} y={m.t - 2}>Median line drift (px)</text>
          <polyline className="front" points={frontPts.map((q) => `${x(q.x)},${y(q.drift)}`).join(" ")} />
          {p > 0 && <line className="iso" clipPath={`url(#clip-${compact ? "c" : "f"})`} x1={x(x0)} y1={y(iso(x0))} x2={x(x1)} y2={y(iso(x1))} />}
          {es.map((e, i) => {
            const dom = dominatedBy[e]?.length ? ` (dominated by ${dominatedBy[e].map(name).join(", ")})` : "";
            return (
              <g key={e} className={`eng${e === leader ? " is-leader" : ""}${front.includes(e) ? "" : " is-dominated"}`}>
                <rect x={x(L[e].x) - 4.5} y={y(L[e].drift) - 4.5} width={9} height={9} />
                <text x={x(L[e].x) + 9} y={labelY[i]} dy="0.32em">{name(e)}{compact ? "" : dom}</text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

export function StripChart({ basis, engines, lo, hi, name, scaleMin, scaleMax, compact = false }: {
  basis: BasisRow[]; engines: string[]; lo: number; hi: number; name: (e: string) => string;
  scaleMin: number; scaleMax: number; compact?: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const row = compact ? 26 : 32, m = { l: compact ? 78 : 92, r: 56, t: 8, b: 30 };
  const h = m.t + engines.length * row + m.b;
  const x = scaleLog().domain([scaleMin * 0.95, scaleMax * 1.05]).range([m.l, Math.max(m.l + 10, width - m.r)]);
  const inside = (v: number) => v >= lo && v <= hi;
  const ticks = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1].filter((t) => t >= scaleMin && t <= scaleMax);
  const shownTicks = compact ? ticks.filter((t) => [0.001, 0.01, 0.1].includes(t)) : ticks;
  return (
    <div ref={ref} className="tax-chart">
      {width > 0 && (
        <svg width={width} height={h} role="img"
          aria-label={`Each engine's standard clips by motion; clips with motion from ${norm(lo)} to ${norm(hi)} count. ${engines
            .map((e) => `${name(e)}: ${basis.filter((b) => b.engine === e && inside(b.motion)).length} of ${basis.filter((b) => b.engine === e).length}`).join("; ")}.`}>
          <rect className="span" x={x(Math.max(lo, x.domain()[0]))} y={m.t} height={engines.length * row}
            width={Math.max(0, x(Math.min(hi, x.domain()[1])) - x(Math.max(lo, x.domain()[0])))} />
          {engines.map((e, i) => {
            const own = basis.filter((b) => b.engine === e);
            const n = own.filter((b) => inside(b.motion)).length;
            const cy = m.t + i * row + row / 2;
            return (
              <g key={e}>
                <text className="row-label" x={m.l - 8} y={cy} dy="0.32em" textAnchor="end">{name(e)}</text>
                <line className="grid" x1={m.l} x2={x.range()[1]} y1={cy} y2={cy} />
                {own.map((b) => (
                  <circle key={b.id} cx={x(b.motion)} cy={cy} r={compact ? 2.5 : 3} className={inside(b.motion) ? "dot in" : "dot"} />
                ))}
                <text className={`tick n${n < 5 ? " is-thin" : ""}`} x={x.range()[1] + 8} y={cy} dy="0.32em">n = {n}</text>
              </g>
            );
          })}
          {shownTicks.map((t) => (
            <text key={t} className="tick" x={x(t)} y={h - m.b + 16} textAnchor="middle">{norm(t, 1)}</text>
          ))}
          <text className="axis-label" x={x.range()[1]} y={h - 2} textAnchor="end">Motion, normalised (log)</text>
        </svg>
      )}
    </div>
  );
}
