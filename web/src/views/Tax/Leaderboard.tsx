// The shared leaderboard for all three lenses. Rows reorder with FLIP; rank changes go to a polite live region.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { BoardRow } from "../../lib/lenses";
import { fixed, px } from "../../lib/format";
import { flip, offsets } from "./flip";
import { announce } from "./taxModel";

export function Leaderboard({ rows, name, scoreLabel, debounceMs = 400, pair, showDoublings = false }: {
  rows: BoardRow[]; name: (e: string) => string; scoreLabel: string; debounceMs?: number;
  pair?: string[] | null; showDoublings?: boolean;
}) {
  const body = useRef<HTMLTableSectionElement>(null);
  const before = useRef<Map<string, number>>(new Map());
  const announced = useRef<BoardRow[]>(rows);
  const [message, setMessage] = useState("");
  const key = rows.map((r) => `${r.engine}:${r.rank ?? "-"}`).join(",");

  useLayoutEffect(() => {
    if (body.current) {
      flip(body.current, before.current);
      before.current = offsets(body.current);
    }
  }, [key]);

  useEffect(() => {
    const t = setTimeout(() => {
      const m = announce(announced.current, rows, name);
      announced.current = rows;
      if (m) setMessage(m);
    }, debounceMs);
    return () => clearTimeout(t);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="board">
      <table className="data board-table">
        <thead>
          <tr><th className="r">Rank</th><th>Engine</th><th className="r">{scoreLabel}</th>
            {showDoublings && <th className="r">Doublings</th>}<th className="r">Clips</th></tr>
        </thead>
        <tbody ref={body}>
          {rows.map((r) => (
            <tr key={r.engine} data-flip={r.engine} data-engine={r.engine} data-testid="board-row"
              className={[r.rank === 1 ? "is-leader" : "", r.ranked ? "" : "is-unranked", pair?.includes(r.engine) ? "is-pair" : ""].join(" ").trim()}>
              <td className="num rank-cell"><span className="rank-n">{r.rank ?? "–"}</span></td>
              <td className="eng-cell">{name(r.engine)}</td>
              <td className="num">
                {r.ranked && r.score != null ? (scoreLabel === "Score" ? fixed(r.score, 2) : px(r.score))
                  : <span className="faint">too few (n = {r.n})</span>}
              </td>
              {showDoublings && <td className="num">{r.doublings != null ? fixed(r.doublings, 2) : "—"}</td>}
              <td className="num">{r.n}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p role="status" aria-live="polite" className="visually-hidden">{message}</p>
    </div>
  );
}
