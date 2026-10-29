import { useEffect, useState } from "react";
import { useRoute } from "../router";
import { Link } from "../ui/Link";
import { Mark } from "../ui/Keep";
import { useCore } from "../data/core";

const NAV = [
  { href: "/explore", label: "Explore" },
  { href: "/scatter", label: "Motion vs drift" },
  { href: "/tax", label: "Stillness Tax" },
  { href: "/rate", label: "Rate it yourself" },
];

type Theme = "light" | "dark";
const systemTheme = (): Theme => (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

/** Follows the system until the reader picks a theme; only an explicit pick is stored. */
function useTheme() {
  const [picked, setPicked] = useState<Theme | null>(() => (document.documentElement.dataset.theme as Theme) || null);
  const [system, setSystem] = useState<Theme>(systemTheme);
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = () => setSystem(mq.matches ? "dark" : "light");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const pick = (t: Theme) => {
    setPicked(t);
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem("sd-theme", t); } catch { /* storage may be unavailable */ }
  };
  return [picked ?? system, pick] as const;
}

export function TopBar() {
  const { path } = useRoute();
  const { paper } = useCore();
  const [theme, setTheme] = useTheme();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const doi = paper.doi_version.value;
  const next = theme === "dark" ? "light" : "dark";
  return (
    <header className="bar">
      <Link className="brand" href="/explore"><Mark /><span>StillDrawn Explorer</span></Link>
      <button className="bar-menu" type="button" aria-expanded={open} aria-controls="bar-nav" onClick={() => setOpen(!open)}>
        Menu
      </button>
      <div id="bar-nav" className={`bar-nav${open ? " is-open" : ""}`}>
        <nav aria-label="Views">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={path.startsWith(n.href) ? "page" : undefined}>{n.label}</Link>
          ))}
        </nav>
        <div className="bar-end">
          <a href={`https://doi.org/${doi}`} rel="noopener">Dataset<span className="visually-hidden"> on Zenodo (opens doi.org)</span></a>
          <button type="button" className="theme-btn" onClick={() => setTheme(next)}>{next === "dark" ? "Dark" : "Light"} theme</button>
        </div>
      </div>
    </header>
  );
}
