import { useEffect, useMemo, useState } from "react";
import "./explore.css";
import { useCore } from "../../data/core";
import { useQuery } from "../../router";
import { ARM_VIEWS, clipFor, gridRows, isArmView, type ArmView } from "../../data/model";
import { mediaUrl } from "../../data/media";
import type { SeriesKey } from "../../data/types";
import { SERIES } from "../../data/metrics";
import { Segmented } from "../../ui/Segmented";
import { Link } from "../../ui/Link";
import { Grid, PanelList } from "./Grid";
import { Detail, DetailEmpty } from "./Detail";

// The default deep link: the site concept's drift test.
const DEFAULT = { cell: "act-tone-2_campush", e: "gen4.5", vs: "wan22" };

export function useMedia(q: string) {
  const [m, setM] = useState(() => matchMedia(q).matches);
  useEffect(() => {
    const mq = matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [q]);
  return m;
}

export default function Explore() {
  const core = useCore();
  const [q, set] = useQuery();
  const phone = useMedia("(max-width: 760px)");
  const explicit = q.has("cell") || q.has("arm");
  const arm: ArmView = isArmView(q.get("arm")) ? (q.get("arm") as ArmView) : "standard";
  const rows = useMemo(() => gridRows(core.clips, arm), [core.clips, arm]);
  const row = q.get("cell") ?? (explicit ? null : DEFAULT.cell);
  const rowObj = rows.find((r) => r.key === row);
  const engines = rowObj?.cells.map((c) => c.engine) ?? [];
  const engine = row ? (q.get("e") ?? (explicit ? rowObj?.cells.find((c) => c.clip)?.engine : DEFAULT.e) ?? null) : null;
  const vsRaw = q.get("vs") ?? (explicit ? null : DEFAULT.vs);
  const vs = vsRaw && vsRaw !== engine && engines.includes(vsRaw) ? vsRaw : null;
  const draw = q.get("draw");
  const seriesQ = q.get("series") as SeriesKey | null;
  const series = seriesQ && seriesQ in SERIES ? (seriesQ as Exclude<SeriesKey, "motion">) : "line";
  const diff = q.get("diff") === "1";
  const a = row && engine ? clipFor(core.clips, row, engine, draw) : undefined;
  const b = row && vs ? clipFor(core.clips, row, vs) : undefined;
  const url = (p: string) => mediaUrl(core.index.media_base, p);

  const missing = core.index.missing_cells[0];
  const missingEngine = missing && core.clips.find((c) => c.id.endsWith("_" + missing.cell.split("_").pop()))?.engine;
  const missingReason = row && engine && !a && missing && missing.cell.startsWith(row + "_") ? missing.reason : null;

  // Materialise defaults so every state is a real link, then patch the query.
  const patch = (p: Record<string, string | null>) => {
    const base = explicit ? {} : { cell: DEFAULT.cell, e: DEFAULT.e, vs: DEFAULT.vs };
    set({ ...base, ...p });
  };
  const pick = (r: string, e: string) => set({ arm: arm === "standard" ? null : arm, cell: r, e, vs: vs && vs !== e ? vs : null, draw: null });
  const back = () => set({ arm, cell: null, e: null, vs: null, draw: null, diff: null, series: null });

  useEffect(() => {
    document.title = a ? `${a.panel} · ${core.engine(a.engine).name} · StillDrawn Explorer` : "Explore · StillDrawn Explorer";
  }, [a, core]);

  const showDetail = !!row && !!engine;
  const sheet = (
    <section className="sheet-pane" aria-labelledby="sheet-h">
      <div className="sheet-top">
        {phone ? <h1 id="sheet-h" tabIndex={-1}>Contact sheet</h1> : <h2 id="sheet-h">Contact sheet</h2>}
        <Segmented label="Which clips" hideLabel value={arm} options={ARM_VIEWS.map((v) => ({ value: v.id, label: v.label }))}
          onChange={(v) => set({ arm: v, cell: null, e: null, vs: null, draw: null })} />
        <p className="sheet-links"><Link href="/explore/failures">Failure modes and their exemplar clips</Link></p>
      </div>
      {phone ? <PanelList rows={rows} core={core} url={url} onPick={pick} />
        : <Grid rows={rows} core={core} url={url} sel={{ row, engine }} onPick={pick} />}
      {arm === "standard" && missing && (
        <p className="faint small sheet-note" id="missing-note" data-testid="missing-note">
          One cell was never generated: {core.engine(missingEngine ?? "")?.name ?? "one engine"} on {missing.cell.split("_").slice(0, 2).join(" ")}. {missing.reason}.
        </p>
      )}
      <p className="faint small sheet-note">A number on a frame counts the cell's draws: the main draw plus its repeat and hazard draws. Pick one under the player.</p>
    </section>
  );

  return (
    <main id="main" className={`page explore${phone ? (showDetail ? " show-detail" : " show-list") : ""}`}>
      {(!phone || !showDetail) && sheet}
      {(!phone || showDetail) && (
        <div className="detail-pane">
          {showDetail
            ? <Detail core={core} url={url} sel={{ row: row!, engine: engine!, vs, draw }} a={a} b={b} engines={engines}
                missingReason={missingReason} series={series} diff={diff} set={patch} onBack={phone ? back : null} wide={!phone} />
            : <DetailEmpty />}
        </div>
      )}
    </main>
  );
}
