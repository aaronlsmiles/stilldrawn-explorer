import { use, useEffect } from "react";
import type { Study } from "blindpanel";
import "./rate.css";
import { RatingPanel } from "./RatingPanel";
import { STUDY_URL } from "./rateModel";
import { PlainNote } from "../../plainwords/PlainWords";

let pending: Promise<Study> | null = null;
const loadStudy = () => (pending ??= fetch(STUDY_URL).then((r) => {
  if (!r.ok) throw new Error("The rating study couldn't be loaded. Check your connection and try again.");
  return r.json() as Promise<Study>;
}));

export default function Rate() {
  const study = use(loadStudy());
  useEffect(() => { document.title = "Rate it yourself · StillDrawn Explorer"; }, []);
  return (
    <main id="main" className="page rate">
      <h1 tabIndex={-1}>Rate it yourself</h1>
      <p className="muted rate-lede">Score the source stills, then eight clips made from them, blind, as the paper's six raters did; then see where you land against them and against the automatic metrics.</p>
      <PlainNote id="rate.blind" />
      <RatingPanel study={study} studyUrl={STUDY_URL} />
    </main>
  );
}
