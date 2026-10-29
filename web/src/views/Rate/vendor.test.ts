// @vitest-environment node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const at = (p: string) => new URL(`../../../${p}`, import.meta.url);
const sha = (p: string) => createHash("sha256").update(readFileSync(at(p))).digest("hex");

describe("vendored blindpanel", () => {
  const lock = JSON.parse(readFileSync(at("vendor/blindpanel.lock.json"), "utf8"));
  it("lock matches the tarball and the copied study", () => {
    expect(lock.version).toBe("0.1.0");
    expect(lock.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(sha(`vendor/blindpanel-${lock.version}.tgz`)).toBe(lock.tarball_sha256);
    expect(sha("public/data/blindpanel/stilldrawn/study.json")).toBe(lock.study.study_sha256);
    expect(sha("public/data/blindpanel/stilldrawn/reveal.json")).toBe(lock.study.reveal_sha256);
  });
  it("package.json installs the vendored tarball, and node_modules holds that version", () => {
    const pkg = JSON.parse(readFileSync(at("package.json"), "utf8"));
    expect(pkg.dependencies.blindpanel).toBe(`file:vendor/blindpanel-${lock.version}.tgz`);
    expect(JSON.parse(readFileSync(at("node_modules/blindpanel/package.json"), "utf8")).version).toBe(lock.version);
  });
  it("the banned-terms copy is test-only (not under public/)", () => {
    expect(existsSync(at("vendor/stilldrawn-banned-terms.txt"))).toBe(true);
    expect(existsSync(at("public/data/blindpanel/stilldrawn/banned-terms.txt"))).toBe(false);
  });
});
