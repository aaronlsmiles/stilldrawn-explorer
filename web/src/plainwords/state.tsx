import { createContext, use, useState, type ReactNode } from "react";
import { navigate, withQuery } from "../router";

/** unset: the invite shows on every page; on: bands and notes; off: only the top-bar switch. */
export type PlainMode = "unset" | "on" | "off";
const KEY = "sd-plain";
/** "Not now" puts the invite away for this visit only; the next visit asks again. */
const LATER = "sd-plain-later";

function store(m: "on" | "off") {
  try { localStorage.setItem(KEY, m); } catch { /* storage may be unavailable */ }
}

/** ?plain=1 or ?plain=0 wins (a link sent to someone), then the stored choice, then "Not now" for this visit. */
function initial(): PlainMode {
  const q = new URLSearchParams(location.search).get("plain");
  const asked = q === "1" ? "on" : q === "0" ? "off" : null;
  if (asked) { store(asked); return asked; }
  try {
    const v = localStorage.getItem(KEY);
    if (v === "on" || v === "off") return v;
    if (sessionStorage.getItem(LATER)) return "off";
  } catch { /* storage may be unavailable: the choice lasts for this visit */ }
  return "unset";
}

type Plain = { mode: PlainMode; set: (m: "on" | "off") => void; later: () => void };
const Ctx = createContext<Plain>({ mode: "unset", set: () => {}, later: () => {} });

/** A reader's own click settles it: drop ?plain= from the address, so a reload keeps what they chose. */
function dropParam() {
  if (new URLSearchParams(location.search).has("plain")) navigate(withQuery(location.pathname, { plain: null }), { replace: true });
}

export function PlainWordsProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<PlainMode>(initial);
  const set = (m: "on" | "off") => { setMode(m); store(m); dropParam(); };
  const later = () => {
    setMode("off");
    try { sessionStorage.setItem(LATER, "1"); } catch { /* the invite then stays away until a reload */ }
    dropParam();
  };
  return <Ctx value={{ mode, set, later }}>{children}</Ctx>;
}

export const usePlainWords = () => use(Ctx);
