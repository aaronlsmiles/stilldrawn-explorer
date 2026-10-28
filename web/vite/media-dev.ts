// Dev only: serve pipeline/out/media at /media/, laid out as on the media host.
// Range-aware so <video> can seek; follows the clip symlinks into the release.
import { createReadStream, statSync } from "node:fs";
import { resolve, sep, extname } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const TYPES: Record<string, string> = { ".mp4": "video/mp4", ".png": "image/png", ".webp": "image/webp" };

export function mediaHandler(root: string) {
  const top = resolve(root);
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = decodeURIComponent((req.url ?? "").split("?")[0]);
    if (!url.startsWith("/media/")) return next();
    const file = resolve(top, "." + url.slice("/media".length));
    if (!file.startsWith(top + sep)) return next();
    let size: number;
    try {
      const st = statSync(file);
      if (!st.isFile()) return next();
      size = st.size;
    } catch {
      return next();
    }
    res.setHeader("Content-Type", TYPES[extname(file)] ?? "application/octet-stream");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "no-cache");
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
    if (m && (m[1] || m[2])) {
      const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
      const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
      if (start > end || start >= size) {
        res.statusCode = 416;
        res.setHeader("Content-Range", `bytes */${size}`);
        return void res.end();
      }
      res.statusCode = 206;
      res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
      res.setHeader("Content-Length", String(end - start + 1));
      return void createReadStream(file, { start, end }).pipe(res);
    }
    res.setHeader("Content-Length", String(size));
    createReadStream(file).pipe(res);
  };
}

export function mediaDev(root: string): Plugin {
  return {
    name: "media-dev",
    apply: "serve",
    configureServer: (server) => void server.middlewares.use(mediaHandler(root)),
    configurePreviewServer: (server) => void server.middlewares.use(mediaHandler(root)),
  };
}
