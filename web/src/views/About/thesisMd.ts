// The thesis files' Markdown subset, parsed to blocks the page renders as React elements.
// Headings (# and ##), paragraphs, - lists, **bold**, *em*, [links](url), and images, each followed
// by an italic "*Figure …*" caption. Anything else throws, so a new construct can't render wrong
// without a failing build. Pure: the Vite plugin (vite/thesis.ts) and the tests both call it.

export type Inline =
  | { t: "text"; v: string }
  | { t: "strong"; v: string }
  | { t: "em"; v: string }
  | { t: "link"; v: string; href: string };

export type Block =
  | { type: "h1" | "h2" | "p"; inlines: Inline[] }
  | { type: "ul"; items: Inline[][] }
  | { type: "figure"; alt: string; src: string; caption: Inline[]; size?: Size; phone?: Size };

type Size = { width: number; height: number };

const TOKEN = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(s: string): Inline[] {
  if (/[<>`]/.test(s)) throw new Error(`unsupported markup in: ${s}`);
  const out: Inline[] = [];
  let at = 0;
  for (const m of s.matchAll(TOKEN)) {
    if (m.index > at) out.push({ t: "text", v: s.slice(at, m.index) });
    if (m[1] !== undefined) out.push({ t: "strong", v: m[1] });
    else if (m[2] !== undefined) out.push({ t: "em", v: m[2] });
    else out.push({ t: "link", v: m[3], href: m[4] });
    at = m.index + m[0].length;
  }
  if (at < s.length) out.push({ t: "text", v: s.slice(at) });
  for (const r of out) if (r.t === "text" && /\*|\[|\]\(/.test(r.v)) throw new Error(`unclosed markup in: ${s}`);
  return out;
}

const IMAGE = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;
const CAPTION = /^\*(Figure .+)\*$/;

export function parseThesis(md: string): Block[] {
  const paras = md.replace(/\r\n/g, "\n").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const blocks: Block[] = [];
  for (let i = 0; i < paras.length; i++) {
    const p = paras[i];
    const lines = p.split("\n");
    if (/^#{3,}\s/.test(p) || /^\d+\.\s/.test(p) || /^\|/.test(p)) throw new Error(`unsupported block: ${lines[0]}`);
    if (p.startsWith("# ")) blocks.push({ type: "h1", inlines: parseInline(p.slice(2)) });
    else if (p.startsWith("## ")) blocks.push({ type: "h2", inlines: parseInline(p.slice(3)) });
    else if (lines.every((l) => l.startsWith("- "))) blocks.push({ type: "ul", items: lines.map((l) => parseInline(l.slice(2))) });
    else if (lines.some((l) => l.startsWith("- "))) {
      // a list straight after its lead line (CommonMark lets a list interrupt a paragraph)
      const k = lines.findIndex((l) => l.startsWith("- "));
      if (!lines.slice(k).every((l) => l.startsWith("- "))) throw new Error(`text after a list without a blank line: ${lines[0]}`);
      blocks.push({ type: "p", inlines: parseInline(lines.slice(0, k).join(" ")) });
      blocks.push({ type: "ul", items: lines.slice(k).map((l) => parseInline(l.slice(2))) });
    }
    else if (IMAGE.test(p)) {
      const [, alt, src] = p.match(IMAGE)!;
      const cap = paras[i + 1]?.match(CAPTION);
      if (!cap) throw new Error(`image without a "*Figure …*" caption: ${src}`);
      blocks.push({ type: "figure", alt, src, caption: parseInline(cap[1]) });
      i++;
    } else blocks.push({ type: "p", inlines: parseInline(lines.join(" ")) });
  }
  return blocks;
}

/** Plain text of a run list (for tests and for headings' accessible names). */
export const plain = (xs: Inline[]) => xs.map((x) => x.v).join("");
