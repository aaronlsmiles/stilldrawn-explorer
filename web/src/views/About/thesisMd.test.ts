import { describe, expect, test } from "vitest";
import { parseThesis } from "./thesisMd";

describe("parseThesis", () => {
  test("headings, paragraphs and inline runs", () => {
    const b = parseThesis("# Title\n\nA **bold** and *em* run with [a link](https://x.org/y).\n\n## Part\n\nNext.\n");
    expect(b).toEqual([
      { type: "h1", inlines: [{ t: "text", v: "Title" }] },
      {
        type: "p",
        inlines: [
          { t: "text", v: "A " }, { t: "strong", v: "bold" }, { t: "text", v: " and " }, { t: "em", v: "em" },
          { t: "text", v: " run with " }, { t: "link", v: "a link", href: "https://x.org/y" }, { t: "text", v: "." },
        ],
      },
      { type: "h2", inlines: [{ t: "text", v: "Part" }] },
      { type: "p", inlines: [{ t: "text", v: "Next." }] },
    ]);
  });

  test("an image followed by an italic Figure paragraph becomes one figure with its caption", () => {
    const b = parseThesis("![Alt text](web/public/thesis/scatter-light.png)\n\n*Figure 1. Caption with [a link](https://x.org).*\n");
    expect(b).toEqual([
      {
        type: "figure", alt: "Alt text", src: "web/public/thesis/scatter-light.png",
        caption: [{ t: "text", v: "Figure 1. Caption with " }, { t: "link", v: "a link", href: "https://x.org" }, { t: "text", v: "." }],
      },
    ]);
  });

  test("a list with bold leads", () => {
    const b = parseThesis("- **One.** first\n- **Two.** second\n");
    expect(b).toEqual([
      { type: "ul", items: [
        [{ t: "strong", v: "One." }, { t: "text", v: " first" }],
        [{ t: "strong", v: "Two." }, { t: "text", v: " second" }],
      ] },
    ]);
  });

  test("a list may follow its lead line without a blank line (CommonMark lets a list interrupt a paragraph)", () => {
    expect(parseThesis("**Limits**\n- one\n- two\n")).toEqual([
      { type: "p", inlines: [{ t: "strong", v: "Limits" }] },
      { type: "ul", items: [[{ t: "text", v: "one" }], [{ t: "text", v: "two" }]] },
    ]);
  });

  test("lines of one paragraph join with a space", () => {
    expect(parseThesis("one\ntwo\n")).toEqual([{ type: "p", inlines: [{ t: "text", v: "one two" }] }]);
  });

  test.each([
    ["a third-level heading", "### Deep\n"],
    ["HTML", "<div>x</div>\n"],
    ["a numbered list", "1. one\n"],
    ["a table", "| a | b |\n"],
    ["code", "`x`\n"],
    ["an unclosed bold", "a **b\n"],
    ["an image without a caption", "![a](b.png)\n\nNext.\n"],
  ])("throws on %s", (_name, md) => {
    expect(() => parseThesis(md)).toThrow();
  });
});
