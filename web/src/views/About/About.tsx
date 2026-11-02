// /about: the thesis, "Stability ranks stillness", in two tellings of one argument.
// Finding first is the default; ?read=object switches. The text is THESIS.md and
// THESIS-object-first.md at the repo root, parsed at build time (vite/thesis.ts).
import { Fragment } from "react";
import { finding, object } from "virtual:thesis";
import { useQuery } from "../../router";
import { Link } from "../../ui/Link";
import { Segmented } from "../../ui/Segmented";
import { plain, type Block, type Inline } from "./thesisMd";
import "./about.css";
import { PlainNote } from "../../plainwords/PlainWords";
import { ABOUT_NOTES } from "../../plainwords/words";

type Read = "finding" | "object";
const TELLINGS: Record<Read, Block[]> = { finding, object };
const SITE = "https://stilldrawn.studionephele.com";

/** The Markdown links work on GitHub; on the page, the explorer's own links stay in the app. */
function route(href: string): { href: string; internal: boolean } {
  if (href === "THESIS.md") return { href: "/about", internal: true };
  if (href === "THESIS-object-first.md") return { href: "/about?read=object", internal: true };
  if (href === SITE || href.startsWith(SITE + "/")) {
    const path = href.slice(SITE.length);
    return { href: path === "" || path === "/" ? "/explore" : path, internal: true };
  }
  return { href, internal: false };
}

function Runs({ xs }: { xs: Inline[] }) {
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

/** One export per theme; CSS shows the one that matches (the reader's pick, else the system).
 *  Each has a phone version, the app's own 390 px layout, served under 761 px. The desktop
 *  exports are 2x, so a figure grows to half their pixel width (the chart at its own size). */
const PHONE = "(max-width: 760px)";
function Figure({ b }: { b: Extract<Block, { type: "figure" }> }) {
  const pic = (theme: "light" | "dark") => {
    const src = b.src.replace(/^web\/public/, "").replace(/-light\.png$/, `-${theme}.png`);
    return (
      <picture className={`fig-${theme}`}>
        {b.phone && <source media={PHONE} srcSet={src.replace(`-${theme}.png`, `-phone-${theme}.png`)} width={b.phone.width} height={b.phone.height} />}
        <img src={src} alt={b.alt} loading="lazy" decoding="async" width={b.size?.width} height={b.size?.height} />
      </picture>
    );
  };
  return (
    <figure className="thesis-fig" style={b.size ? { maxWidth: b.size.width / 2 } : undefined}>
      {pic("light")}
      {pic("dark")}
      <figcaption><Runs xs={b.caption} /></figcaption>
    </figure>
  );
}

function Body({ blocks }: { blocks: Block[] }) {
  let section = 0;
  return blocks.map((b, i) => {
    if (b.type === "h2") {
      const note = ABOUT_NOTES[section++];
      return <Fragment key={i}>{note && <PlainNote id={note} />}<h2><Runs xs={b.inlines} /></h2></Fragment>;
    }
    if (b.type === "p") return <p key={i}><Runs xs={b.inlines} /></p>;
    if (b.type === "ul") return <ul key={i}>{b.items.map((it, k) => <li key={k}><Runs xs={it} /></li>)}</ul>;
    if (b.type === "figure") return <Figure key={i} b={b} />;
    return null; // the h1 is drawn once, above the switch
  });
}

export default function About() {
  const [query, set] = useQuery();
  const read: Read = query.get("read") === "object" ? "object" : "finding";
  const blocks = TELLINGS[read];
  const h1 = blocks.find((b) => b.type === "h1");
  return (
    <main id="main" className="page about">
      <h1 tabIndex={-1}>{h1 && h1.type === "h1" ? plain(h1.inlines) : "Stability ranks stillness"}</h1>
      <Segmented<Read> label="Read it" value={read} className="about-read"
        options={[{ value: "finding", label: "Finding first" }, { value: "object", label: "Object first" }]}
        onChange={(v) => set({ read: v === "object" ? "object" : null })} />
      <article className="thesis" lang="en-GB">
        <Body blocks={blocks} />
      </article>
    </main>
  );
}
