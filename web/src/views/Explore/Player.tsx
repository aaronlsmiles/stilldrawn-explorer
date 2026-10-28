// Source panel beside the clip (and a second engine in compare mode), muted and looping,
// with the difference view: the clip over its own frame 0, blended by difference.
import { useState, type Ref } from "react";
import type { Clip, Engine, Panel } from "../../data/types";
import { mb } from "../../lib/format";
import { Segmented } from "../../ui/Segmented";
import type { Player } from "./useFrameClock";

const BIG = 10e6;

function ClipFrame({ clip, engine, url, videoRef, diff, testid, pinned, lazyBig }: {
  clip: Clip; engine: Engine; url: (p: string) => string; videoRef: Ref<HTMLVideoElement>;
  diff: boolean; testid: string; pinned?: boolean; lazyBig: boolean;
}) {
  const big = lazyBig && clip.bytes > BIG;
  const [failed, setFailed] = useState(false);
  const ratio = `${clip.width} / ${clip.height}`;
  return (
    <figure className="frame" data-testid={testid}>
      <div className={`frame-media${diff ? " is-diff" : ""}`} style={{ aspectRatio: ratio }}>
        {diff && !failed && (
          <img data-testid="frame0" crossOrigin="anonymous" src={url(clip.media.frame0)} width={clip.width} height={clip.height} alt="" decoding="async" />
        )}
        {failed ? (
          <img src={url(clip.media.poster)} alt={`${engine.name}, frame 96 of ${clip.id}`} width={clip.width} height={clip.height} />
        ) : (
          <video key={clip.id} ref={videoRef} data-testid="clip-video" src={url(clip.media.mp4)} poster={url(clip.media.poster)}
            muted loop playsInline preload={big ? "none" : "auto"} width={clip.width} height={clip.height}
            aria-label={`${engine.name} clip ${clip.id}, muted`} onError={() => setFailed(true)} crossOrigin="anonymous" />
        )}
      </div>
      <figcaption className={pinned ? "cap cap-pinned" : "cap"}>
        <span className="cap-name">{engine.name}</span>
        {failed ? <span className="faint">This clip streams once the media host is live.</span>
          : big ? <span className="faint num">{mb(clip.bytes)}</span> : null}
      </figcaption>
    </figure>
  );
}

export function Media({ panel, a, b, engines, url, player, diff, panelOriginal, lazyBig }: {
  panel: Panel | undefined; a: Clip; b?: Clip; engines: (id: string) => Engine; url: (p: string) => string;
  player: Player; diff: boolean; panelOriginal: string | null; lazyBig: boolean;
}) {
  return (
    <div className={`media ${b ? "media-3" : "media-2"}`}>
      <figure className="frame">
        <div className="frame-media" style={{ aspectRatio: panel ? `${panel.width} / ${panel.height}` : "16 / 9" }}>
          {panel && <img src={url(panel.media.webp)} alt={panel.alt} width={panel.width} height={panel.height} decoding="async" />}
        </div>
        <figcaption className="cap">
          <span className="cap-name">Source panel</span>
          {panelOriginal && <a className="faint" href={panelOriginal}>PNG original</a>}
        </figcaption>
      </figure>
      <ClipFrame clip={a} engine={engines(a.engine)} url={url} videoRef={player.a} diff={diff} testid="clip-a" lazyBig={lazyBig} />
      {b && <ClipFrame clip={b} engine={engines(b.engine)} url={url} videoRef={player.b} diff={diff} testid="clip-b" pinned lazyBig={lazyBig} />}
    </div>
  );
}

export function Toolbar({ player, nFrames, diff, setDiff, big, bytes }: {
  player: Player; nFrames: number; diff: boolean; setDiff: (d: boolean) => void; big: boolean; bytes: number;
}) {
  const speeds = [0.25, 0.5, 1];
  return (
    <div className="toolbar" role="group" aria-label="Playback">
      <button type="button" className="btn btn-play" onClick={player.toggle} aria-keyshortcuts="k">
        {player.playing ? "Pause" : big ? `Play (${mb(bytes)})` : "Play"}
      </button>
      <button type="button" className="btn" onClick={() => player.step(-1)} aria-label="Previous frame" aria-keyshortcuts=",">‹</button>
      <button type="button" className="btn" onClick={() => player.step(1)} aria-label="Next frame" aria-keyshortcuts=".">›</button>
      <span className="frame-readout num" data-testid="frame-readout" aria-live="off">Frame {player.frame} <span className="faint">/ {nFrames - 1}</span></span>
      <Segmented label="Speed" hideLabel value={String(player.rate)} options={speeds.map((s) => ({ value: String(s), label: `${s}×` }))}
        onChange={(v) => player.setRate(Number(v))} />
      <button type="button" className="btn" aria-pressed={diff} onClick={() => setDiff(!diff)} aria-keyshortcuts="d">Difference</button>
    </div>
  );
}
