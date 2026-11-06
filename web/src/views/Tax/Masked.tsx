// /tax/masked: A9 for what it is, exploratory and post-hoc. Test 2 first (does Gen-4.5's gap to Wan 2.2
// shrink when drift is measured only where the prompt lets the drawing move?), then Test 1 and the
// gallery. The contract loads lazily and on its own (data/load.ts loadMasked); the page suspends on it.
import { masked as writeup } from "virtual:thesis";
import { use, useEffect, useMemo, useRef, useState } from "react";
import "./tax.css";
import "./masked.css";
import { useCore } from "../../data/core";
import { loadMasked } from "../../data/load";
import { useQuery } from "../../router";
import { Link } from "../../ui/Link";
import { Segmented } from "../../ui/Segmented";
import { PlainNote } from "../../plainwords/PlainWords";
import {
  MARGINS, MASK_LABEL, MASK_SETS, SPLITS, SPLIT_LABEL, announcement, condOf, headlineViews, leagueRows, parseState, queryPatch,
  verdictFor, viewStatus, type MaskedState,
} from "./maskedModel";
import { Chip, Gallery, GridTable, LeagueTable, RowDetail, Slopegraph, Test1, Writeup } from "./MaskedParts";

export const TITLE = "Drift where nothing should move";

function Unpublished() {
  return (
    <main id="main" className="page masked">
      <div className="title-row"><h1 tabIndex={-1}>{TITLE}</h1></div>
      <p className="finding">These results are not published yet. <Link href="/tax">Back to Stillness Tax</Link></p>
    </main>
  );
}

function Loaded({ debounceMs }: { debounceMs: number }) {
  const core = useCore();
  const m = use(loadMasked());
  const [q, set] = useQuery();
  const state = useMemo(() => parseState(q), [q]);
  const change = (patch: Partial<MaskedState>) => set(queryPatch({ ...state, ...patch }));
  const name = (e: string) => core.engine(e).name;
  const cond = condOf(m, state);
  const rows = useMemo(() => leagueRows(m, cond, name), [m, cond]);   // eslint-disable-line react-hooks/exhaustive-deps
  const verdict = verdictFor(m);
  const { registered } = viewStatus(state);
  const [selected, setSelected] = useState<string | null>(null);

  // after a control changes, say the new headline figures once, politely
  const key = `${state.masks}|${state.margin}|${state.split}`;
  const spoken = useRef(key);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (spoken.current === key) return;
    const t = setTimeout(() => { spoken.current = key; setMessage(announcement(state, cond)); }, debounceMs);
    return () => clearTimeout(t);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main id="main" className="page masked">
      <div className="title-row">
        <h1 tabIndex={-1}>{TITLE}</h1>
        <Chip />
      </div>
      <p className="finding">Does Gen-4.5's gap to Wan 2.2 shrink when drift is measured only where the prompt lets the drawing move?
        That is Test 2. Test 1, further down, asks whether the steadiest engines fail to do the motion they were asked for.</p>

      <div className="lens-switch masked-controls">
        <Segmented label="Masks" value={state.masks} options={MASK_SETS.map((v) => ({ value: v, label: MASK_LABEL[v] }))} onChange={(masks) => change({ masks })} />
        <Segmented label="Margin" value={String(state.margin)} options={MARGINS.map((v) => ({ value: String(v), label: v === 32 ? "32 px (registered)" : `${v} px` }))}
          onChange={(v) => change({ margin: Number(v) as MaskedState["margin"] })} />
        <Segmented label="Cells" value={state.split} options={SPLITS.map((v) => ({ value: v, label: SPLIT_LABEL[v] }))} onChange={(split) => change({ split })} />
      </div>

      <div className="headlines" data-a9>
        {headlineViews(m, state).map((h) => (
          <div key={h.key} className="headline-row">
            <span className="chip" data-testid="headline-label">{h.label}</span>
            <p className="lens-finding headline" data-testid="headline" data-set={h.key}>{h.text}</p>
          </div>
        ))}
      </div>
      {!registered && <p className="sens" data-testid="sensitivity">Sensitivity view: no verdict for this view. The registered view is 32 px on all cells, which shows both
        mask sets' headlines; the verdict below reads those cells only.</p>}

      <section className="panel verdict" data-testid="verdict" data-a9 aria-label="Verdict on the registered cells">
        <div className="panel-head"><h2>Verdict</h2><Chip /></div>
        <p className="verdict-line">{verdict.sentence}</p>
        <p className="faint small">Read from the registered cells only: all cells, 32 px, both mask sets. Eligible rows: {m.test2.n_eligible_rows}.</p>
      </section>
      {verdict.verdict === "killed" && <PlainNote id="masked.verdict.killed" />}

      <PlainNote id="masked.slope" />
      <div className="lens-body masked-body" data-a9>
        <div className="panel">
          <div className="panel-head"><h2>Median drift, same cells</h2><Chip /></div>
          <LeagueTable rows={rows} selected={selected} onSelect={setSelected} />
        </div>
        <div className="panel chart-panel">
          <div className="panel-head">
            <h2>{state.table ? "All six conditions" : "Whole frame to outside the allowed region"}</h2><Chip />
            <button type="button" className="btn" aria-pressed={state.table} onClick={() => change({ table: !state.table })}>Show as table</button>
          </div>
          {state.table ? <GridTable m={m} state={state} name={name} /> : <Slopegraph rows={rows} selected={selected} />}
        </div>
      </div>

      <section className="mk-section" data-a9 aria-labelledby="mk-gallery-h">
        <div className="panel-head"><h2 id="mk-gallery-h">Where the prompt lets the drawing move</h2><Chip /></div>
        <PlainNote id="masked.gallery" />
        <Gallery core={core} m={m} state={state} onSelect={(row) => change({ row: row === state.row ? null : row })} />
        <RowDetail core={core} m={m} state={state} />
      </section>
      <PlainNote id="masked.test1" />
      {m.test1.state === "pending" && <PlainNote id="masked.test1.pending" />}
      {m.test1.state === "fallback" && <PlainNote id="masked.test1.fallback" />}
      {m.test1.state === "two-rater" && m.test1.verdict === "not supported" && <PlainNote id="masked.test1.not-supported" />}
      <Test1 core={core} t={m.test1} order={m.engine_order} />
      {writeup && <Writeup blocks={writeup} repo={core.index.source.repo} />}
      <p role="status" aria-live="polite" className="visually-hidden">{message}</p>
    </main>
  );
}

export default function Masked({ debounceMs = 400 }: { debounceMs?: number }) {
  const core = useCore();
  useEffect(() => { document.title = `${TITLE} · StillDrawn Explorer`; }, []);
  // the file is requested only when the build says it is real
  return core.index.masked ? <Loaded debounceMs={debounceMs} /> : <Unpublished />;
}
