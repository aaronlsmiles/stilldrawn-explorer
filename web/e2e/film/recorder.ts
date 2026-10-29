// Records a beat for the films: JPEG screenshots at device pixels in a loop, each with its time, plus timed
// marks for what is on screen (film/build/edit.py resamples to 30 fps from the times, so the pace is real).
// Not Playwright's video (VP9 smears the screentone) nor a CDP screencast (CSS pixels only, headless).
import type { Page } from "@playwright/test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { SLOW } from "./slow";

export type Mark = { t: number; name: string; data?: unknown };

/** Width and height from a JPEG's first SOF marker. */
export function jpegSize(b: Buffer): [number, number] {
  for (let i = 2; i < b.length - 9; ) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + b.readUInt16BE(i + 2);
  }
  throw new Error("no SOF marker");
}

export class Recorder {
  private frames: { i: number; t: number }[] = [];
  private marks: Mark[] = [];
  private running = false;
  private loop?: Promise<void>;
  private t0 = 0;
  size: [number, number] = [0, 0];

  constructor(private page: Page, readonly dir: string) {}

  private now() { return (performance.now() - this.t0) / 1000; }

  async start() {
    rmSync(this.dir, { recursive: true, force: true });
    mkdirSync(this.dir, { recursive: true });
    this.t0 = performance.now();
    this.running = true;
    this.loop = (async () => {
      while (this.running) {
        const a = this.now();
        const buf = await this.page.screenshot({ type: "jpeg", quality: 92, scale: "device" });
        const b = this.now();
        const i = this.frames.length;
        if (i === 0) this.size = jpegSize(buf);
        writeFileSync(`${this.dir}/${String(i).padStart(5, "0")}.jpg`, buf);
        this.frames.push({ i, t: (a + b) / 2 });
      }
    })();
  }

  mark(name: string, data?: unknown) { this.marks.push({ t: this.now(), name, data }); }

  async stop() {
    this.mark("end");
    this.running = false;
    await this.loop;
    const seconds = this.frames.at(-1)!.t - this.frames[0].t;
    writeFileSync(`${this.dir}/times.json`, JSON.stringify({ size: this.size, slow: SLOW, frames: this.frames }));
    writeFileSync(`${this.dir}/events.json`, JSON.stringify(this.marks, null, 1));
    return { frames: this.frames.length, seconds: seconds / SLOW, fps: ((this.frames.length - 1) / seconds) * SLOW, size: this.size };
  }
}
