// The contact sheet: rows are cells (panel × motion class), columns are engines, each frame a poster at frame 96.
// Arrow keys move between frames (roving tabindex); the selection carries the gold keeper loop.
import { useRef, type KeyboardEvent } from "react";
import type { Core } from "../../data/types";
import type { GridRow } from "../../data/model";
import { MOTION_WORDS } from "../../data/metrics";
import { Keep } from "../../ui/Keep";
import { srcset } from "../../data/srcset";

export type Pick = (row: string, engine: string) => void;

const rowLabel = (r: GridRow) => (r.motion_class === "FLINT" ? r.key.replace(/^flint-/, "") : r.panel);

export function Grid({ rows, core, url, sel, onPick }: {
  rows: GridRow[]; core: Core; url: (p: string) => string; sel: { row: string | null; engine: string | null }; onPick: Pick;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cols = rows[0]?.cells.map((c) => c.engine) ?? [];
  const missing = new Map(core.index.missing_cells.map((m) => [m.cell, m.reason]));
  const v = core.index.variants;
  const selR = Math.max(0, rows.findIndex((r) => r.key === sel.row));
  const selC = Math.max(0, cols.indexOf(sel.engine ?? ""));
  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    const r = Number(t.dataset.r), c = Number(t.dataset.c);
    if (Number.isNaN(r)) return;
    const d: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    let next: [number, number] | null = null;
    if (e.key in d) next = [r + d[e.key][0], c + d[e.key][1]];
    if (e.key === "Home") next = [r, 0];
    if (e.key === "End") next = [r, cols.length - 1];
    if (!next) return;
    e.preventDefault();
    const [nr, nc] = [Math.max(0, Math.min(rows.length - 1, next[0])), Math.max(0, Math.min(cols.length - 1, next[1]))];
    ref.current?.querySelector<HTMLElement>(`[data-r="${nr}"][data-c="${nc}"]`)?.focus();
  };
  return (
    <div className="sheet" role="grid" aria-label="Contact sheet: cells by engine" data-testid="grid" ref={ref} onKeyDown={onKey}
      style={{ gridTemplateColumns: `minmax(max-content, 1.3fr) repeat(${cols.length}, minmax(0, 1fr))` }}>
      <div role="row" className="sheet-head">
        <div role="columnheader" className="sheet-corner"><span className="visually-hidden">Cell</span></div>
        {cols.map((e) => (
          <div role="columnheader" key={e} className={`sheet-eng${e === sel.engine ? " is-sel" : ""}`}>{core.engine(e).name}</div>
        ))}
      </div>
      {rows.map((row, r) => (
        <div role="row" key={row.key} className={`sheet-row${row.key === sel.row ? " is-sel" : ""}`} data-testid="grid-row">
          <div role="rowheader" className="sheet-label">
            <span className="sl-panel">{rowLabel(row)}</span>
            <span className="sl-motion faint">{MOTION_WORDS[row.motion_class] ?? row.motion_class}</span>
          </div>
          {row.cells.map((cell, c) => {
            const on = row.key === sel.row && cell.engine === sel.engine;
            const tab = r === selR && c === selC ? 0 : -1;
            const label = `${rowLabel(row)}, ${MOTION_WORDS[row.motion_class] ?? row.motion_class}, ${core.engine(cell.engine).name}`;
            if (!cell.clip) {
              const reason = [...missing.entries()].find(([k]) => k.startsWith(row.key + "_"))?.[1];
              return (
                <div role="gridcell" key={cell.engine} className="sheet-cell">
                  <button type="button" className={`frame-btn is-missing${on ? " keep" : ""}`} data-testid="cell-missing" data-r={r} data-c={c}
                    tabIndex={tab} aria-label={`${label}: not generated. ${reason ?? ""}`} aria-describedby="missing-note"
                    onClick={() => onPick(row.key, cell.engine)}>
                    <span aria-hidden="true">Not generated</span>
                    {on && <Keep />}
                  </button>
                </div>
              );
            }
            return (
              <div role="gridcell" key={cell.engine} className="sheet-cell" aria-selected={on}>
                <button type="button" className={`frame-btn${on ? " keep" : ""}`} data-r={r} data-c={c} tabIndex={tab}
                  aria-label={label + (cell.draws > 1 ? `, ${cell.draws} draws` : "")} aria-current={on ? "true" : undefined}
                  onClick={() => onPick(row.key, cell.engine)}>
                  <img src={url(cell.clip.media.poster)} srcSet={srcset(url, cell.clip.media.poster, v.poster_width, v.posters)} sizes="160px"
                    alt="" width={640} height={Math.round((640 * cell.clip.height) / cell.clip.width)} loading="lazy" decoding="async" />
                  {cell.draws > 1 && <span className="draws num" aria-hidden="true">{cell.draws}</span>}
                  {on && <Keep />}
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function PanelList({ rows, core, url, onPick }: { rows: GridRow[]; core: Core; url: (p: string) => string; onPick: Pick }) {
  return (
    <ul className="plist" data-testid="panel-list" aria-label="Cells">
      {rows.map((row) => {
        const first = row.cells.find((c) => c.clip);
        const panel = core.panel(row.panel);
        return (
          <li key={row.key} data-testid="panel-row">
            <button type="button" className="plist-btn" onClick={() => first && onPick(row.key, first.engine)}>
              {panel && <img src={url(panel.media.webp)} srcSet={srcset(url, panel.media.webp, panel.width, core.index.variants.panels)} sizes="96px"
                alt="" width={96} height={55} loading="lazy" decoding="async" />}
              <span className="plist-text">
                <span className="sl-panel">{rowLabel(row)}</span>
                <span className="faint">{MOTION_WORDS[row.motion_class] ?? row.motion_class} · {row.cells.filter((c) => c.clip).length} engines</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
