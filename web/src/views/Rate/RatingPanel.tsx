import { useEffect, useRef, useState } from "react";
import { mountResults, mountSession, type ResultsController } from "blindpanel/ui";
import type { Reveal, Study } from "blindpanel";
import "blindpanel/ui/style.css";
import { navigate } from "../../router";
import { localiseReveal, studyRelative } from "./rateModel";

const storageKey = (s: Study) => `blindpanel:${s.id}:${s.instrument}`;

/**
 * blindpanel's framework-free UI inside React. One effect mounts the session and
 * destroys whatever it mounted on cleanup, so StrictMode's mount-unmount-mount
 * leaves exactly one session; progress survives the remount in localStorage.
 */
export function RatingPanel({ study, studyUrl }: { study: Study; studyUrl: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [epoch, setEpoch] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const el = host.current!;
    let disposed = false;
    let results: ResultsController | null = null;
    const session = mountSession(el, study);
    session.on("complete", async ({ submission }) => {
      let reveal: Reveal;
      try {
        const r = await fetch(studyRelative(studyUrl, study.endpoints.reveal));
        if (!r.ok) throw new Error(String(r.status));
        reveal = localiseReveal((await r.json()) as Reveal);
      } catch {
        if (disposed) return;
        const p = document.createElement("p");
        p.className = "bp rate-error";
        p.setAttribute("role", "alert");
        p.textContent = "The results could not be loaded. Your answers are kept; reload to try again.";
        el.append(p);
        return;
      }
      if (disposed) return;
      session.destroy();
      results = mountResults(el, {
        study,
        reveal,
        submission,
        onSubmit: async () => {
          const r = await fetch(study.endpoints.submit, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(submission),
          });
          return { ok: r.ok, status: r.status };
        },
        loadTally: async () => {
          const r = await fetch(study.endpoints.tally);
          if (!r.ok) throw new Error(String(r.status));
          return r.json();
        },
      });
      setDone(true);
    });
    // in-app links inside the kit's DOM (the reveal's "Open") route without a reload
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a");
      const href = a?.getAttribute("href");
      if (!href?.startsWith("/") || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      navigate(href);
    };
    el.addEventListener("click", onClick);
    return () => {
      disposed = true;
      el.removeEventListener("click", onClick);
      session.destroy();
      results?.destroy();
      el.querySelector(".rate-error")?.remove();
    };
  }, [study, studyUrl, epoch]);

  const again = () => {
    try { localStorage.removeItem(storageKey(study)); } catch { /* storage may be unavailable */ }
    setDone(false);
    setEpoch((n) => n + 1);
  };

  return (
    <>
      <div ref={host} className="rate-host" />
      {done && (
        <p className="rate-again">
          <button type="button" className="btn" onClick={again}>Start a new session</button>
        </p>
      )}
    </>
  );
}
