// The drift curve: the chosen per-frame series, with the motion series in its own strip
// underneath (one axis per chart), a gold playhead, and scrubbing by pointer or keyboard.
import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { useWidth } from "../../ui/useSize";
import { scaleLinear } from "d3-scale";
import { line as d3line } from "d3-shape";
import type { SeriesKey } from "../../data/types";
import { seriesFrames, valueAtFrame } from "./curve";

export type CurveLine = { label: string; values: number[]; emphasis: boolean };

const M = { l: 44, r: 72, t: 8, b: 22 };

function Plot({ lines, seriesKey, nFrames, frame, width, height, yLabel, ticks = 4, showX, endLabels = true }: {
  lines: CurveLine[]; seriesKey: SeriesKey; nFrames: number; frame: number; width: number; height: number;
  yLabel: string; ticks?: number; showX: boolean; endLabels?: boolean;
}) {
  const { start, step } = seriesFrames(seriesKey);
  const all = lines.flatMap((l) => l.values).filter(Number.isFinite);
  const lo = Math.min(0, ...all), hi = Math.max(...all, 1e-9);
  const x = scaleLinear().domain([0, nFrames - 1]).range([M.l, width - M.r]);
  const y = scaleLinear().domain([lo, hi]).nice(ticks).range([height - M.b, M.t]);
  const path = d3line<number>().x((_, i) => x(start + i * step)).y((v) => y(v));
  const xt = x.ticks(Math.max(2, Math.min(6, Math.floor(width / 110)))).filter((t) => Number.isInteger(t));
  return (
    <svg width={width} height={height} aria-hidden="true" className="plot">
      {y.ticks(ticks).map((t) => (
        <g key={t}>
          <line x1={M.l} x2={width - M.r} y1={y(t)} y2={y(t)} className={t === 0 ? "base" : "grid"} />
          <text x={M.l - 6} y={y(t)} dy="0.32em" textAnchor="end" className="tick">{+t.toPrecision(3)}</text>
        </g>
      ))}
      {showX && xt.map((t) => (
        <text key={t} x={x(t)} y={height - 6} textAnchor="middle" className="tick">{t}</text>
      ))}
      {[...lines].sort((p, q) => Number(p.emphasis) - Number(q.emphasis)).map((l) => {
        const lastI = l.values.length - 1;
        return (
          <g key={l.label} className={l.emphasis ? "ln ln-main" : "ln ln-other"}>
            <path d={path(l.values) ?? ""} />
            {endLabels && lines.length > 1 && (
              <text x={x(start + lastI * step) + 6} y={y(l.values[lastI])} dy="0.32em" className="end-label">{l.label}</text>
            )}
          </g>
        );
      })}
      <line x1={x(frame)} x2={x(frame)} y1={M.t} y2={height - M.b} className="playhead" />
      {/* drawn last, with a halo, so the playhead and the lines pass under it */}
      <text x={M.l} y={M.t + 2} dy="0.7em" className="axis-label" transform="translate(4,0)">{yLabel}</text>
    </svg>
  );
}

export function DriftCurve({ lines, motion, seriesKey, nFrames, frame, onSeek, yLabel, valueText }: {
  lines: CurveLine[]; motion: CurveLine[]; seriesKey: SeriesKey; nFrames: number; frame: number;
  onSeek: (f: number) => void; yLabel: string; valueText: (f: number) => string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const dragging = useRef(false);
  const toFrame = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    const t = (clientX - r.left - M.l) / (r.width - M.l - M.r);
    return Math.round(Math.max(0, Math.min(1, t)) * (nFrames - 1));
  };
  const onDown = (e: PointerEvent) => { dragging.current = true; (e.target as Element).setPointerCapture?.(e.pointerId); onSeek(toFrame(e.clientX)); };
  const onMove = (e: PointerEvent) => { if (dragging.current) onSeek(toFrame(e.clientX)); };
  const onUp = () => { dragging.current = false; };
  const onKey = (e: KeyboardEvent) => {
    const k: Record<string, number> = { ArrowLeft: frame - 1, ArrowRight: frame + 1, ArrowDown: frame - 1, ArrowUp: frame + 1,
      PageDown: frame - 10, PageUp: frame + 10, Home: 0, End: nFrames - 1 };
    if (e.key in k) { e.preventDefault(); onSeek(Math.max(0, Math.min(nFrames - 1, k[e.key]))); }
  };
  return (
    <div ref={ref} className="curve" role="slider" tabIndex={0} aria-label="Drift curve, frame"
      aria-valuemin={0} aria-valuemax={nFrames - 1} aria-valuenow={frame} aria-valuetext={valueText(frame)}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey}>
      {width > 0 && (
        <>
          <Plot lines={lines} seriesKey={seriesKey} nFrames={nFrames} frame={frame} width={width} height={188} yLabel={yLabel} showX={false} />
          <Plot lines={motion} seriesKey="motion" nFrames={nFrames} frame={frame} width={width} height={84} yLabel="Optical flow (px)" ticks={2} showX endLabels={false} />
        </>
      )}
    </div>
  );
}

export function SeriesTable({ lines, seriesKey }: { lines: CurveLine[]; seriesKey: SeriesKey }) {
  const { start, step } = seriesFrames(seriesKey);
  const n = Math.max(...lines.map((l) => l.values.length));
  const rows = Array.from({ length: n }, (_, i) => i).filter((i) => i % 8 === 0 || i === n - 1);
  return (
    <table className="data series-table">
      <thead><tr><th className="r">Frame</th>{lines.map((l) => <th key={l.label} className="r">{l.label}</th>)}</tr></thead>
      <tbody>
        {rows.map((i) => (
          <tr key={i}><td className="num">{start + i * step}</td>
            {lines.map((l) => <td key={l.label} className="num">{l.values[i] == null ? "—" : +l.values[i].toPrecision(4)}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

export { valueAtFrame };
