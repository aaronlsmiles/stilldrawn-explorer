// Real paths, state in the query string, so every view deep-links.
// navigate() pushes a history entry; control changes replace the current one.
import { useCallback, useMemo, useSyncExternalStore, type MouseEvent } from "react";

const EVT = "sd:route";

function subscribe(cb: () => void) {
  addEventListener("popstate", cb);
  addEventListener(EVT, cb);
  return () => {
    removeEventListener("popstate", cb);
    removeEventListener(EVT, cb);
  };
}
const snapshot = () => location.pathname + location.search;

export function navigate(to: string, { replace = false } = {}) {
  if (to === snapshot()) return;
  history[replace ? "replaceState" : "pushState"](null, "", to);
  dispatchEvent(new Event(EVT));
}

export function useRoute() {
  const s = useSyncExternalStore(subscribe, snapshot, snapshot);
  return useMemo(() => {
    const u = new URL(s, "http://local");
    return { path: u.pathname.replace(/\/+$/, "") || "/", query: u.searchParams, href: s };
  }, [s]);
}

export type QueryPatch = Record<string, string | number | null | undefined>;

export function withQuery(path: string, patch: QueryPatch, base = location.search) {
  const q = new URLSearchParams(base);
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === "") q.delete(k);
    else q.set(k, String(v));
  }
  const s = q.toString();
  return path + (s ? `?${s}` : "");
}

export function useQuery() {
  const { query } = useRoute();
  const set = useCallback((patch: QueryPatch) => navigate(withQuery(location.pathname, patch), { replace: true }), []);
  return [query, set] as const;
}

/** For <a href> that routes in-app but stays a real link (new tab, copy link). */
export function onLinkClick(e: MouseEvent<HTMLAnchorElement>) {
  if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const href = e.currentTarget.getAttribute("href");
  if (!href || !href.startsWith("/")) return;
  e.preventDefault();
  navigate(href);
}
