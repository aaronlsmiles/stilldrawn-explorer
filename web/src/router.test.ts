import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRoute, useQuery, navigate } from "./router";

beforeEach(() => history.replaceState(null, "", "/explore?cell=act-tone-2_campush&e=gen4.5"));

describe("router", () => {
  it("reads path and query", () => {
    const { result } = renderHook(() => useRoute());
    expect(result.current.path).toBe("/explore");
    expect(result.current.query.get("e")).toBe("gen4.5");
  });
  it("useQuery patches the query with replaceState and keeps other keys", () => {
    const { result } = renderHook(() => useQuery());
    const before = history.length;
    act(() => result.current[1]({ vs: "wan22" }));
    expect(location.search).toBe("?cell=act-tone-2_campush&e=gen4.5&vs=wan22");
    act(() => result.current[1]({ vs: null }));
    expect(location.search).toBe("?cell=act-tone-2_campush&e=gen4.5");
    expect(history.length).toBe(before);
  });
  it("navigate pushes and notifies", () => {
    const { result } = renderHook(() => useRoute());
    act(() => navigate("/tax?lens=price&p=1.25"));
    expect(result.current.path).toBe("/tax");
    expect(result.current.query.get("p")).toBe("1.25");
  });
  it("trailing slash is ignored", () => {
    history.replaceState(null, "", "/scatter/");
    const { result } = renderHook(() => useRoute());
    expect(result.current.path).toBe("/scatter");
  });
});
