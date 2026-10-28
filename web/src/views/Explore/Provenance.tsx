import { useState } from "react";
import type { Clip, Core } from "../../data/types";
import { mb } from "../../lib/format";

const NOTICE = "https://github.com/aaronlsmiles/stilldrawn/blob/main/NOTICE-PROVIDERS.md";

export function Provenance({ clip, core, open }: { clip: Clip; core: Core; open: boolean }) {
  const engine = core.engine(clip.engine);
  const panel = core.panel(clip.panel);
  const doi = core.paper.doi_version.value;
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard?.writeText(clip.sha256).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }, () => undefined);
  return (
    <details className="panel provenance" data-testid="provenance" open={open}>
      <summary><h2>Provenance · {engine.name}</h2></summary>
      <dl>
        <dt>File</dt><dd>{clip.id}.mp4 · {clip.width}×{clip.height}, {clip.n_frames} frames at {clip.fps} fps · {mb(clip.bytes)}</dd>
        <dt>SHA-256</dt>
        <dd className="sha"><code title={clip.sha256}>{clip.sha256}</code>
          <button type="button" className="btn-text small" onClick={copy}>{copied ? "Copied" : "Copy"}</button></dd>
        <dt>Integrity</dt>
        <dd>Byte-identical to the release{clip.c2pa ? "; C2PA Content Credentials intact" : ""}</dd>
        <dt>Model</dt><dd>{engine.model_version ?? engine.name}</dd>
        <dt>Archive</dt><dd><a href={`https://doi.org/${doi}`}>{doi}</a> · {engine.zip}</dd>
        <dt>Licence</dt><dd>CC BY 4.0, StillDrawn dataset (Aaron Smiles, 2026)</dd>
      </dl>
      {(engine.notice || panel?.notice) && (
        <p className="notice" data-testid="notice-badge">
          <span className="pill">Provider notice</span>
          <span>Please don't use this {engine.notice ? "clip" : "panel"} to train generative models. <a href={NOTICE}>Why</a></span>
        </p>
      )}
    </details>
  );
}
