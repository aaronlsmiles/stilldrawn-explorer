import { Suspense, lazy, useEffect, useRef } from "react";
import { CoreProvider } from "./data/core";
import { navigate, useRoute } from "./router";
import { TopBar } from "./shell/TopBar";
import { Link } from "./ui/Link";
import { Boundary } from "./ui/Boundary";

const Explore = lazy(() => import("./views/Explore/Explore"));
const FailureGallery = lazy(() => import("./views/Explore/FailureGallery"));
const Scatter = lazy(() => import("./views/Scatter/Scatter"));
const Tax = lazy(() => import("./views/Tax/Tax"));
const Rate = lazy(() => import("./views/Rate/Rate"));
const About = lazy(() => import("./views/About/About"));

// Retry reloads: the data loaders keep a failed load cached (re-requesting it on every render looped).
const LoadError = (error: Error) => (
  <main className="page"><div className="state-error" role="alert">
    <h1>Couldn't load the data</h1>
    <p className="muted">{error.message}</p>
    <button type="button" className="btn" onClick={() => location.reload()}>Retry</button>
  </div></main>
);

function NotFound() {
  return (
    <main className="page"><h1 tabIndex={-1}>Not found</h1>
      <p className="muted">There's nothing at this address. Try <Link href="/explore">Explore</Link>, <Link href="/scatter">Motion vs drift</Link>, <Link href="/tax">Stillness Tax</Link>, <Link href="/rate">Rate it yourself</Link> or <Link href="/about">About</Link>.</p>
    </main>
  );
}

function Routes() {
  const { path, query } = useRoute();
  const last = useRef(path);
  useEffect(() => {
    if (path === "/") navigate("/explore" + (query.size ? `?${query}` : ""), { replace: true });
  }, [path, query]);
  useEffect(() => {
    if (last.current === path) return;
    last.current = path;
    scrollTo(0, 0);
    document.querySelector<HTMLElement>("main h1")?.focus({ preventScroll: true });
  }, [path]);
  if (path === "/" || path === "/explore") return <Explore />;
  if (path === "/explore/failures") return <FailureGallery />;
  if (path === "/scatter") return <Scatter />;
  if (path === "/tax") return <Tax />;
  if (path === "/rate") return <Rate />;
  if (path === "/about") return <About />;
  return <NotFound />;
}

const Loading = () => <main className="page" aria-busy="true"><p className="muted">Loading the StillDrawn data…</p></main>;

export function App() {
  return (
    <Boundary fallback={LoadError}>
      <Suspense fallback={<Loading />}>
        <CoreProvider>
          <a className="skip" href="#main">Skip to content</a>
          <TopBar />
          <Boundary fallback={LoadError}>
            <Suspense fallback={<Loading />}><Routes /></Suspense>
          </Boundary>
        </CoreProvider>
      </Suspense>
    </Boundary>
  );
}
