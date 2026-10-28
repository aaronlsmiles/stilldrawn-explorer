import { it, expect, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { Leaderboard } from "./Leaderboard";
import type { BoardRow } from "../../lib/lenses";

const row = (engine: string, rank: number): BoardRow => ({ engine, rank, ranked: true, score: rank, n: 33, drift_median_px: rank });
afterEach(cleanup);
const names = (e: string) => ({ wan22: "Wan 2.2", "gen4.5": "Gen-4.5" } as Record<string, string>)[e];

it("lists rows in board order and marks the leader", () => {
  render(<Leaderboard rows={[row("wan22", 1), row("gen4.5", 2)]} name={names} scoreLabel="Median drift" debounceMs={0} />);
  const rows = screen.getAllByTestId("board-row");
  expect(rows.map((r) => r.getAttribute("data-engine"))).toEqual(["wan22", "gen4.5"]);
  expect(rows[0].className).toContain("is-leader");
});

it("announces order changes only", async () => {
  const { rerender } = render(<Leaderboard rows={[row("wan22", 1), row("gen4.5", 2)]} name={names} scoreLabel="Score" debounceMs={0} />);
  expect(screen.getByRole("status").textContent).toBe("");
  rerender(<Leaderboard rows={[row("gen4.5", 1), row("wan22", 2)]} name={names} scoreLabel="Score" debounceMs={0} />);
  await act(() => new Promise((r) => setTimeout(r, 10)));
  expect(screen.getByRole("status").textContent).toBe("Gen-4.5 moves to 1st. Wan 2.2 moves to 2nd.");
});

it("shows the reason for an unranked engine", () => {
  const unranked: BoardRow = { engine: "gen4.5", n: 2, drift_median_px: 2.9, score: null, ranked: false, rank: null, reason: "too few clips (n = 2)" };
  render(<Leaderboard rows={[row("wan22", 1), unranked]} name={names} scoreLabel="Score" debounceMs={0} />);
  expect(screen.getByText(/too few \(n = 2\)/)).toBeTruthy();
});
