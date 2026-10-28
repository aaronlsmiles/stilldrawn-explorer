// One place for rounding, so every surface shows the same figure the same way.
const MINUS = "−";
const sign = (s: string) => (s.startsWith("-") ? MINUS + s.slice(1) : s);

export const fixed = (v: number, dp: number) => sign(v.toFixed(dp));
export const px = (v: number, dp = 2) => `${fixed(v, dp)} px`;
export const ratio = (v: number) => `${v.toFixed(1)}×`;
/** Two significant figures in fixed notation: 0.00080, 0.0073. */
export function norm(v: number, sig = 2): string {
  if (v === 0) return "0";
  const dp = Math.max(0, sig - 1 - Math.floor(Math.log10(Math.abs(v))));
  return fixed(v, dp);
}
export const sig = (v: number, s = 3) => (Math.abs(v) >= 1 ? fixed(v, Math.max(0, s - 1 - Math.floor(Math.log10(Math.abs(v))))) : norm(v, s));
export function ordinal(n: number): string {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}
export const mb = (bytes: number) => `${(bytes / 1e6).toFixed(1)} MB`;
export const rho = (v: number) => fixed(v, 2);
export const pval = (v: number) => (v < 0.001 ? "< 0.001" : v.toFixed(3));
