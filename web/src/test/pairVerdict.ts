// Tests only. Edit a masked.json so its registered cells (all cells, 32 px) agree with a Test 2 verdict word,
// so a test that shows each verdict never pairs a word with numbers that contradict it.
import type { Masked, MaskedVerdict } from "../data/types";

export function pairVerdict(m: Masked, verdict: MaskedVerdict): Masked {
  const a = m.test2.conditions.all.aaron.m32, b = m.test2.conditions.all.agent.m32;
  m.test2.verdict = verdict;
  const set = (c: typeof a, s: number | null, ci: [number, number] | null) => { c.s = s; c.s_ci95 = ci; };
  if (verdict === "supported") { set(a, 0.67, [0.6, 0.7]); set(b, 0.62, [0.5, 0.7]); }
  if (verdict === "mask-dependent") { set(a, 0.67, [0.6, 0.7]); set(b, 0.3, [0.2, 0.4]); }
  if (verdict === "killed") { set(a, 0.1, [0.0, 0.2]); set(b, 0.1, [0.0, 0.2]); }
  if (verdict === "not supported") { set(a, 0.67, [-0.1, 0.7]); set(b, 0.62, [0.5, 0.7]); }
  if (verdict === "not testable") for (const c of [a, b]) { c.ratio_whole = 1.5; c.ratio_masked = 1.2; set(c, null, null); }
  return m;
}
