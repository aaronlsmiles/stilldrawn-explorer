// @vitest-environment node
import { describe, expect, it } from "vitest";
import { memoryStore } from "blindpanel/server";
import { allowedOrigins, handlers, loadStudy } from "./_lib.js";

const SITE = "https://stilldrawn.studionephele.com";

describe("api config", () => {
  it("allows the custom domain always and the deployment's own origins on previews only", () => {
    expect(allowedOrigins({})).toEqual([SITE]);
    expect(allowedOrigins({ VERCEL_ENV: "preview", VERCEL_URL: "x-abc.vercel.app", VERCEL_BRANCH_URL: "x-git-b.vercel.app" }))
      .toEqual([SITE, "https://x-abc.vercel.app", "https://x-git-b.vercel.app"]);
    expect(allowedOrigins({ VERCEL_ENV: "production", VERCEL_URL: "x-abc.vercel.app" })).toEqual([SITE]);
  });
  it("loads the same study the page serves", () => {
    expect(loadStudy().id).toBe("stilldrawn");
  });
  it("refuses to build a Supabase store without its env", () => {
    expect(() => handlers({})).toThrow(/SUPABASE_URL/);
  });
  it("wires submit (origin-checked), tally (cached) and keepwarm (bearer)", async () => {
    const h = handlers({ CRON_SECRET: "s" }, memoryStore());
    const bad = await h.submit(new Request(`${SITE}/api/submit`, {
      method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example" }, body: "{}",
    }));
    expect(bad.status).toBe(403);
    const t = await h.tally(new Request(`${SITE}/api/tally`));
    expect(t.status).toBe(200);
    expect(t.headers.get("cache-control")).toMatch(/s-maxage=300/);
    expect((await h.keepwarm(new Request(`${SITE}/api/keepwarm`))).status).toBe(401);
    expect((await h.keepwarm(new Request(`${SITE}/api/keepwarm`, { headers: { authorization: "Bearer s" } }))).status).toBe(200);
  });
});
