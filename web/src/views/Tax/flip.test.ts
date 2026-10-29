// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { flip } from "./flip";

afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });

/** A row at a given layout offset, optionally caught mid-animation at a translateY. */
function row(id: string, top: number, inFlight = 0) {
  const r = document.createElement("tr");
  r.dataset.flip = id;
  Object.defineProperty(r, "offsetTop", { value: top });
  const animate = vi.fn();
  Object.assign(r, { animate, getAnimations: () => [{ cancel: vi.fn() }] });
  r.dataset.inflight = String(inFlight);
  return { r, animate };
}

test("a reorder that lands mid-flight starts from where the row is on screen, not from its old slot", () => {
  const body = document.createElement("tbody");
  const a = row("a", 41, 10);   // was at 0, 10 px into a running move; now laid out at 41
  const b = row("b", 0);        // was at 41, now at 0, at rest
  body.append(a.r, b.r);
  document.body.append(body);
  vi.spyOn(window, "getComputedStyle").mockImplementation((el) =>
    ({ transform: Number((el as HTMLElement).dataset.inflight) ? `matrix(1, 0, 0, 1, 0, ${(el as HTMLElement).dataset.inflight})` : "none" }) as CSSStyleDeclaration);
  flip(body, new Map([["a", 0], ["b", 41]]));
  expect(a.animate.mock.calls[0][0][0]).toEqual({ transform: "translateY(-31px)" });   // 0 + 10 − 41
  expect(b.animate.mock.calls[0][0][0]).toEqual({ transform: "translateY(41px)" });
});
