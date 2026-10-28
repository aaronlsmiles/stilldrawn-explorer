import { createContext, use, type ReactNode } from "react";
import { loadCore } from "./load";
import type { Core } from "./types";

const Ctx = createContext<Core | null>(null);

export function CoreProvider({ children }: { children: ReactNode }) {
  const core = use(loadCore());
  return <Ctx value={core}>{children}</Ctx>;
}

export function useCore(): Core {
  const c = use(Ctx);
  if (!c) throw new Error("useCore outside CoreProvider");
  return c;
}
