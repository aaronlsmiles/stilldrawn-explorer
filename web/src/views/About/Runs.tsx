// Inline runs of the thesis Markdown subset as React: shared by the About page and the /tax/masked write-up.
import { Link } from "../../ui/Link";
import type { Inline } from "./thesisMd";

const SITE = "https://stilldrawn.studionephele.com";

/** The Markdown links work on GitHub; on the page, the explorer's own links stay in the app. */
export function route(href: string): { href: string; internal: boolean } {
  if (href === "THESIS.md") return { href: "/about", internal: true };
  if (href === "THESIS-object-first.md") return { href: "/about?read=object", internal: true };
  if (href === SITE || href.startsWith(SITE + "/")) {
    const path = href.slice(SITE.length);
    return { href: path === "" || path === "/" ? "/explore" : path, internal: true };
  }
  return { href, internal: false };
}

export function Runs({ xs }: { xs: Inline[] }) {
  return xs.map((x, i) => {
    if (x.t === "strong") return <strong key={i}>{x.v}</strong>;
    if (x.t === "em") return <em key={i}>{x.v}</em>;
    if (x.t === "link") {
      const r = route(x.href);
      return r.internal ? <Link key={i} href={r.href}>{x.v}</Link> : <a key={i} href={r.href} rel="noopener">{x.v}</a>;
    }
    return x.v;
  });
}
