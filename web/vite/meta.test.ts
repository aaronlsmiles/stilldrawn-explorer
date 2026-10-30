// Link previews: what a recruiter's chat app shows for a shared link. The image ships with the
// site (public/og.png), never from the media host, whose bot blocking would hide it.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync("index.html", "utf8");
const meta = (attr: string, key: string) => html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]+)"`))?.[1];
const SITE = "https://stilldrawn.studionephele.com";

describe("index.html link preview", () => {
  it("has Open Graph and Twitter card tags pointing at the site's own image", () => {
    expect(meta("property", "og:title")).toBe("StillDrawn Explorer");
    expect(meta("property", "og:description")).toBe(meta("name", "description"));
    expect(meta("property", "og:url")).toBe(`${SITE}/`);
    expect(meta("property", "og:image")).toBe(`${SITE}/og.png`);
    expect(meta("property", "og:image:width")).toBe("1200");
    expect(meta("property", "og:image:height")).toBe("630");
    expect(meta("property", "og:image:alt")).toBeTruthy();
    expect(meta("name", "twitter:card")).toBe("summary_large_image");
  });
  it("the head names no model: it ships on /rate too, which must stay blind until the reveal", () => {
    const head = html.slice(0, html.indexOf("</head>"));
    expect(head).not.toMatch(/Gen-4|Turbo|Wan 2|LTX|MiniMax|\bH3\b|Runway|Lightricks|Seedance/);
  });
  it("the image exists at 1200x630", () => {
    const b = readFileSync("public/og.png");
    expect([b.readUInt32BE(16), b.readUInt32BE(20)]).toEqual([1200, 630]);
  });
  it("no static canonical (one tag would name every route as the home page)", () => {
    expect(html).not.toMatch(/rel="canonical"/);
  });
});
