// The plain-words layer: the invite, each page's chapter band (above <main>) and the notes pinned
// in the views. Nothing renders inside a view unless the reader has turned the layer on.
import { useRoute } from "../router";
import { Link } from "../ui/Link";
import { usePlainWords } from "./state";
import { CHAPTERS, NOTES, SIDE_ROOMS, UI, type NoteId } from "./words";
import "./plainwords.css";

/** The blue-pencil mark that signs the voice (the same path as studionephele.com's). */
export function Pencil() {
  return (
    <svg className="pw-mark" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M2.5 13.5 3.4 10 11 2.4a1.4 1.4 0 0 1 2 0l.6.6a1.4 1.4 0 0 1 0 2L6 12.6ZM9.6 3.8l2.6 2.6M3.4 10l2.6 2.6"
        fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** The chapter (or side room) a path belongs to, if any. */
function chapterAt(path: string) {
  const at = path === "/" ? "/explore" : path;
  const i = CHAPTERS.findIndex((c) => c.path === at);
  return { i, side: SIDE_ROOMS[at], chapter: i >= 0 ? CHAPTERS[i] : SIDE_ROOMS[at] };
}

const BAND_ID = "plain-words";

/** Where focus goes when the layer is put away: the switch that brings it back (inside Menu on phones). */
function focusSwitch() {
  requestAnimationFrame(() => {
    const sw = document.querySelector<HTMLElement>(".plain-btn");
    (sw && sw.offsetParent ? sw : document.querySelector<HTMLElement>(".bar-menu"))?.focus({ preventScroll: true });
  });
}

/** "Skip to content" lands on the chapter band for a reader who has the layer on: it is where their page starts. */
export function SkipLink() {
  const { path } = useRoute();
  const { mode } = usePlainWords();
  const band = mode === "on" && chapterAt(path).chapter;
  return <a className="skip" href={band ? `#${BAND_ID}` : "#main"}>Skip to content</a>;
}

export function PlainBand() {
  const { path } = useRoute();
  const { mode, set, later } = usePlainWords();
  const { i, side, chapter } = chapterAt(path);
  if (!chapter || mode === "off") return null;

  if (mode === "unset") {
    return (
      <aside className="pw-invite" aria-label={UI.label}>
        <div className="pw-inner">
          <Pencil />
          <span className="pw-lead">{UI.invite}</span>
          <button type="button" className="pw-btn"
            onClick={() => { set("on"); requestAnimationFrame(() => document.getElementById(BAND_ID)?.focus({ preventScroll: true })); }}>
            {UI.follow} <span aria-hidden="true">→</span>
          </button>
          <button type="button" className="pw-quiet" onClick={() => { later(); focusSwitch(); }}>{UI.notNow}</button>
        </div>
      </aside>
    );
  }

  const next = i >= 0 ? CHAPTERS[i + 1] : CHAPTERS.find((c) => c.path === side.next);
  return (
    <aside className="pw-band" id={BAND_ID} aria-label={UI.label} tabIndex={-1} data-chapter={i >= 0 ? i + 1 : "side"}>
      <div className="pw-inner">
        <div className="pw-head">
          <h2 className="pw-title"><Pencil />{chapter.title}</h2>
          <p className="pw-pos">{UI.label}, {i >= 0 ? `chapter ${i + 1} of ${CHAPTERS.length}` : UI.side}</p>
        </div>
        <div className="pw-text">
          {chapter.band.map((t, k) => <p key={k}>{t}</p>)}
        </div>
        <p className="pw-foot">
          {next
            ? <Link className="pw-next" href={next.path}>{i >= 0 ? UI.next : UI.back}: {next.title} <span aria-hidden="true">→</span></Link>
            : <Link className="pw-next" href={CHAPTERS[0].path}>{UI.again} <span aria-hidden="true">→</span></Link>}
          <button type="button" className="pw-quiet" onClick={() => { set("off"); focusSwitch(); }}>{UI.hide}</button>
        </p>
        <nav className="pw-map" aria-label={`${UI.label}: ${UI.story.toLowerCase()}`}>
          <ol>
            {CHAPTERS.map((c, k) => (
              <li key={c.path}>
                <Link href={c.path} aria-current={k === i ? "step" : undefined}>
                  <span className="pw-n">{k + 1}</span>{c.title}{k === i && <Ring />}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      </div>
    </aside>
  );
}

/** The explorer's grease-pencil loop (gold rings a selection), drawn in blue pencil around the chapter you're on. */
function Ring() {
  return (
    <svg className="pw-ring" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="M58 3.2C30 1.6 4.5 6 3.2 15.4 2 25.6 26 29.6 52 29 80 28.4 97.4 23.4 96.8 14.6 96.2 5.8 74 1.8 41 4.6"
        fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** A note before the part of the page it explains; nothing at all while the layer is off. */
export function PlainNote({ id }: { id: NoteId }) {
  const { mode } = usePlainWords();
  if (mode !== "on") return null;
  return (
    <div className="pw-note" role="note" data-note={id}>
      <Pencil />
      <div className="pw-text">
        <span className="visually-hidden">{UI.label}: </span>
        {NOTES[id].map((t, k) => <p key={k}>{t}</p>)}
      </div>
    </div>
  );
}
