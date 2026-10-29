// Records a real `npm run setup` in a fresh clone of blindpanel, for the P10 film's terminal beat:
//   node film/build/record-setup.mjs <blindpanel repo> <scratch dir>
// Writes film/build/setup-transcript.json: the commit, then output chunks with their times. The clone's
// path is shown as ~/blindpanel, node's as `node` and the home directory as ~. Stops once the dev server prints its address.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const [repo, scratch] = process.argv.slice(2);
if (!repo || !scratch) throw new Error("usage: record-setup.mjs <blindpanel repo> <scratch dir>");
const dir = join(scratch, "blindpanel");
rmSync(dir, { recursive: true, force: true });
mkdirSync(scratch, { recursive: true });
execFileSync("git", ["clone", "--quiet", repo, dir]);
const commit = execFileSync("git", ["-C", dir, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();

// the node on PATH runs the setup; its absolute path (printed by each step) is shown as plain `node`
const nodeBin = execFileSync("node", ["-p", "process.execPath"], { encoding: "utf8" }).trim();
const nodeVersion = execFileSync("node", ["--version"], { encoding: "utf8" }).trim();
const scrub = (s) => s.split(nodeBin).join("node").split(dir).join("~/blindpanel").split(homedir()).join("~");
const chunks = [];
const t0 = performance.now();
const child = spawn("npm", ["run", "setup"], { cwd: dir, env: { ...process.env, NO_COLOR: "1", npm_config_color: "false" }, detached: true });
let stopping = false;
const take = (data) => {
  const text = scrub(data.toString());
  chunks.push({ t: +((performance.now() - t0) / 1000).toFixed(3), text });
  process.stdout.write(text);
  if (!stopping && /http:\/\/localhost:\d+/.test(text)) {
    stopping = true;
    setTimeout(() => process.kill(-child.pid, "SIGINT"), 800);
  }
};
child.stdout.on("data", take);
child.stderr.on("data", take);
child.on("exit", () => {
  const out = new URL("setup-transcript.json", import.meta.url);
  writeFileSync(out, JSON.stringify({ command: "npm run setup", cwd: "~/blindpanel", commit, node: nodeVersion, chunks }, null, 1) + "\n");
  console.error(`\nrecorded ${chunks.length} chunks over ${chunks.at(-1)?.t}s at ${commit}`);
});
