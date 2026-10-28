import { useEffect, useState } from "react";
import { useRoute } from "../router";
import { Link } from "../ui/Link";
import { Mark } from "../ui/Keep";
import { useCore } from "../data/core";

const NAV = [
  { href: "/explore", label: "Explore" },
  { href: "/scatter", label: "Motion vs drift" },
  { href: "/tax", label: "Stillness Tax" },
];

type Theme = "light" | "dark";
const systemTheme = (): Theme => (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme as Theme) || systemTheme());
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("sd-theme", theme); } catch { /* storage may be unavailable */ }
  }, [theme]);
  return [theme, setTheme] as const;
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
