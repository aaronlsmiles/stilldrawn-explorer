import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { mediaHandler } from "./media-dev";

let base = "";
let srv: Server;
beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "media-"));
  mkdirSync(join(dir, "clips/wan22"), { recursive: true });
  const real = join(dir, "real.mp4");
  writeFileSync(real, Buffer.from("0123456789"));
  symlinkSync(real, join(dir, "clips/wan22/x.mp4"));
  const h = mediaHandler(dir);
  srv = createServer((req, res) => h(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
});
afterAll(() => srv.close());

describe("media dev server", () => {
  it("serves a symlinked clip with the right type", async () => {
    const r = await fetch(`${base}/media/clips/wan22/x.mp4`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("video/mp4");
    expect(await r.text()).toBe("0123456789");
  });
  it("answers a Range request with 206", async () => {
    const r = await fetch(`${base}/media/clips/wan22/x.mp4`, { headers: { Range: "bytes=2-5" } });
    expect(r.status).toBe(206);
    expect(r.headers.get("content-range")).toBe("bytes 2-5/10");
    expect(await r.text()).toBe("2345");
  });
  it("refuses path traversal", async () => {
    const r = await fetch(`${base}/media/..%2F..%2Fetc%2Fpasswd`);
    expect(r.status).toBe(404);
  });
});
