#!/usr/bin/env node
// Posts N valid, unflagged StillDrawn submissions to a preview's /api/submit, each extended to
// every clip, so the tally's n >= 5 rule can be seen live. Test rows: delete them afterwards.
// Usage (through op run, for VERCEL_BYPASS): PREVIEW_URL=https://… node e2e/live-seed.mjs 4
import { readFileSync } from "node:fs";
import { participantOrder } from "blindpanel";

const base = process.env.PREVIEW_URL?.replace(/\/+$/, "");
const n = Number(process.argv[2] ?? 4);
if (!base || !process.env.VERCEL_BYPASS) throw new Error("PREVIEW_URL and VERCEL_BYPASS must be set");
const study = JSON.parse(readFileSync(new URL("../public/data/blindpanel/stilldrawn/study.json", import.meta.url), "utf8"));
const qs = (part) => study.questions.filter((q) => q.part === part).map((q) => q.id);

for (let k = 0; k < n; k++) {
  const session = crypto.randomUUID();
  const order = await participantOrder(study, session);
  const baseline = order.blocks.flatMap((b) => b.baseline);
  const clips = order.blocks.flatMap((b) => b.clips);
  const answers = {
    baseline: Object.fromEntries(baseline.map((c, i) => [c, Object.fromEntries(qs("baseline").map((q) => [q, ((i + k) % 5) + 1]))])),
    clips: Object.fromEntries(clips.map((c, i) => [c, Object.fromEntries(qs("clips").map((q, j) => [q, ((i + j + k) % 5) + 1]))])),
  };
  const body = {
    format: "blindpanel/1", study: study.id, instrument: study.instrument, session,
    order: { baseline, clips }, answers,
    delivery: { autoplay: true, keyboard: false, duration_s: 600, ui: "blindpanel@0.1.0" },
  };
  const r = await fetch(`${base}/api/submit`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base, "x-vercel-protection-bypass": process.env.VERCEL_BYPASS },
    body: JSON.stringify(body),
  });
  console.log(`seed ${k + 1}/${n}: ${r.status} ${(await r.text()).slice(0, 120)}`);
  if (!r.ok) process.exit(1);
}
