// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { flip } from "./flip";

afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });

/** A row at a given layout offset, optionally caught mid-animation at a translateY. It also carries
 *  an unrelated running animation (a colour transition, say), which a reorder must leave alone. */
function row(id: string, top: number, inFlight = 0) {
  const r = document.createElement("tr");
  r.dataset.flip = id;
  Object.defineProperty(r, "offsetTop", { value: top });
  const animate = vi.fn();
  const move = { id: "flip", cancel: vi.fn() };
  const other = { id: "", cancel: vi.fn() };
  Object.assign(r, { animate, getAnimations: () => (inFlight ? [move, other] : [other]) });
  r.dataset.inflight = String(inFlight);
  return { r, animate, move, other };
}

function mount(...rows: HTMLElement[]) {
  const body = document.createElement("tbody");
  body.append(...rows);
  document.body.append(body);
  vi.spyOn(window, "getComputedStyle").mockImplementation((el) =>
    ({ transform: Number((el as HTMLElement).dataset.inflight) ? `matrix(1, 0, 0, 1, 0, ${(el as HTMLElement).dataset.inflight})` : "none" }) as CSSStyleDeclaration);
  return body;
}

test("a reorder that lands mid-flight starts from where the row is on screen, not from its old slot", () => {
  const a = row("a", 41, 10);   // was at 0, 10 px into a running move; now laid out at 41
  const b = row("b", 0);        // was at 41, now at 0, at rest
  flip(mount(a.r, b.r), new Map([["a", 0], ["b", 41]]));
  expect(a.animate.mock.calls[0][0][0]).toEqual({ transform: "translateY(-31px)" });   // 0 + 10 − 41
  expect(b.animate.mock.calls[0][0][0]).toEqual({ transform: "translateY(41px)" });
  expect(a.move.cancel).toHaveBeenCalled();
});

test("a row caught exactly over its new slot drops its old move instead of jumping by it", () => {
  const a = row("a", 40, -40);  // was laid out at 80, 40 px up a running move: on screen at 40, its new slot
  flip(mount(a.r), new Map([["a", 80]]));
  expect(a.move.cancel).toHaveBeenCalled();
  expect(a.animate).not.toHaveBeenCalled();
});

test("a reorder cancels only the rows' own moves, never their other animations", () => {
  const a = row("a", 41, 10);
  flip(mount(a.r), new Map([["a", 0]]));
  expect(a.other.cancel).not.toHaveBeenCalled();
  expect(a.animate.mock.calls[0][1]).toMatchObject({ id: "flip" });
});
