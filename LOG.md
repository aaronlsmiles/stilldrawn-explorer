# Process log

Newest first. Written to be read in public: no account names, IDs or private repos.

## 2026-10-29 — rate it yourself, wired up

- The rating mode now runs inside the explorer. The rating kit arrives as a packed release file with its checksum and commit recorded beside it, so the site installs exactly what was tested, locally and on the host.
- The kit was built to be themed by its host, and its rules sit in a cascade layer so the host's styles win. That cut both ways. The explorer's own reset (buttons inherit their text colour) also beat the kit, and the main buttons rendered ink on ink: "Start" was invisible. The tests had passed because they find buttons by name, not by sight. The reset now sits in a layer below the kit's, the tests measure each button's contrast, and the kit's docs tell hosts to do the same.
- In the explorer's font the results were 425 px wide on a 390 px phone: four columns of figures that refused to wrap. The kit's own phone tests could never have caught it, because under mobile emulation the browser widens its layout to fit the overflow. Both are fixed in the kit: the figures wrap between value, count and interval, and the check measures against the real screen width.
- Opting in sends one row and nothing personal: a random session id, the answers, their order, whether autoplay and shortcuts were used, a duration rounded to ten seconds, and the day. The database refuses edits and deletes even to the site's own key. The public tally is cached for five minutes, so right after someone adds their ratings the page reads past the cache once, and the count includes them.
- The live test sent one real submission from the page, plus four scripted ones so the tally's five-rater threshold could be seen working. Then all six test rows were deleted. The tally starts at zero.

## 2026-10-29 — sizes that fit, and motion that waits for the pointer

- **Images at the size their slot needs.** The source panel came at 1,344 px everywhere, and the contact sheet showed 640 px posters in frames about 90 px wide (7 MB for one screen). Panels now also come at 320, 640 and 960 px and posters at 320 px. The data contract declares the widths once, and every image picks its own size: the default phone view's panel went from 422 KB to one fetch of the right copy, and a sheet frame from about 31 KB to 10.
- **A preload in the wrong place.** On `/explore` the panel now starts downloading with the page itself, not after the app has loaded. The first version ran before the page's viewport tag, when a phone still lays the page out 980 px wide, so it fetched one copy and the image then asked for another. A test now runs on Lighthouse's own phone profile.
- **What a slow phone still costs.** On Lighthouse's simulated mid-range phone (slow 4G, 4× CPU), Explore's largest paint went from 5.2 s to 3.6 s; the other views sit at 2.3 s and desktop under 1 s. Each 100 KB of panel costs about 0.65 s there: the same page with an 87 KB panel measured 2.9 s. Getting under 2.5 s would need a panel of about 30 KB, which blurs the screentone the view exists to show.
- **Motion that only answers a pointer.** A motion review found colour fades on state changes made from the keyboard: the difference toggle (D), the segmented switches and the rating keys 1–5. Colour now eases only while a pointer hovers; a key, a tap or an unhovered click changes it at once. One leaderboard row could also jump when a reorder landed exactly on its new place.
- **A measurement mistake.** Keeping the preview's access cookie between Lighthouse runs also kept the browser cache, so runs after the first could start warm. The script now clears the cache before each run; the numbers above are all cold.

## 2026-10-29 — the design pass

A design pass over all five surfaces, with the verification the plan asked for. What we learned:

- **Tabular figures that weren't.** Every decimal read "0 . 78". The font's `tnum` feature gives the full stop, comma, colon, per cent and × a digit's width (8.9 px against 3.4 px for the stop at 14 px). The site now serves its own copy of Schibsted Grotesk (OFL) whose `tnum` swaps digits only, built reproducibly from the upstream file by `tools/font/build_font.py`. A test measures it, and was itself caught passing for the wrong reason twice before it could fail.
- **A failure that hammered the server.** With one data file returning an error, the page asked for it again on every render: 1,779 requests in three seconds and no error message. The loaders now keep a failed load, the error screen says what failed and offers Retry, and the per-frame curve fails on its own without taking the clip with it.
- **Worst cases from the data itself.** The release already holds the extremes: a 21-character panel id, 103 px of drift, a screentone value of 5×10⁻⁹, a 26.8 MB clip, a cell with ten draws. They found a table 37 px too wide on a 320 px phone and a status chip that wouldn't wrap.
- **Local media can hide a broken host.** The full pass over all 170 primary clips passed in 27 seconds, even with the media host blocked: the dev server reads clips from a local folder. Run against a build that streams from the host, it fails when the host is blocked and passes when it isn't.
- **Charts that fill their row.** Both Stillness Tax charts and the scatter now take their height from the table beside them, so panels in a row end together under either lens.
- **What still misses.** On Lighthouse's simulated mid-range phone, Explore's largest paint (the 423 KB source panel) lands at about 5 s; the other views land at 2.2–2.3 s, and Explore on a desktop at 1.3 s.

## 2026-10-28 — the clips go up

- All 373 clips are now on the studio's own media host, byte for byte as released, so the 288 with signed content credentials keep them. The upload hashes every clip against the release's published list before sending anything, and stops if one differs; a second run sends nothing because every object's size and hash already match. Spot checks through the public address get partial-content responses (so video can seek) and the exact released bytes.
- The player no longer asks the media host for cross-origin permission. Nothing on the page reads pixels back from the video, so plain cross-origin video and images are enough, and the media host needs no extra configuration.

## 2026-10-28 — choosing the lens

- Of the three ways to price motion, the slider that charges a price per doubling of motion became the default: it is the one a reader can explain after one go, and it carries the main finding (the leader changes as the price rises). The matched-motion band stays as the alternate because it reproduces the paper's own result, two pairs whose order flips once motion is matched. The motion floor was cut: it reshuffles a lot, but its rankings soon rest on six clips or fewer. Its code is archived, not deleted.

## 2026-10-28 — the views

- The engines carry no colour. A colourblind-safety check on every five-colour palette we could find or search for (60,000 candidates) failed the moment all five engines share one scatter: at least one pair always sat too close even for full colour vision. So engines are named everywhere, data is ink, context is grey, and the one gold marks whatever the reader has selected. The constraint became the look: ink on paper, with a grease-pencil circle.
- The contact sheet shows each clip at frame 96, four seconds in, not frame 0. Frame 0 is just the panel again; frame 96 is where the drift shows, so a glance across a row already tells the story before anything is clicked.
- The difference view (the clip over its own first frame, blended by difference) only works if the reference frame is decoded exactly as the browser decodes the video. The clips carry no colour tags; browsers assume BT.709 for HD while the usual extraction default is BT.601. Extracting as BT.709 makes frame 0 cancel to near-black (mean difference under 2 of 255), and a test now holds it there.
- The price-of-motion lens has a near-tie hiding in it: Wan 2.2, LTX-2.3 and Gen-4.5 sit almost on one straight line in (doublings of motion, median drift). That is why LTX-2.3 leads for only 0.04 px of price, and why one slider position can flip three places at once.
- Every lens board is computed in the browser by a port of the pipeline's code and checked against the pipeline's own outputs: ranks exactly, values to 1e-9. Two traps found on the way: JavaScript's locale-aware sort puts "_" before ".", unlike Python, so ties broke differently until the comparison used code points; and rounding a band edge in the URL can drop the one clip that sits exactly on it, so URLs carry exact values and a preset always uses the pair's computed edges.
- The matched-motion band ranks all five engines inside a pair's band, not just the pair. The paper's reversals still reproduce within each pair (H3 beats Gen-4 Turbo, 2.46 against 2.88 px; LTX-2.3 beats Gen-4 Turbo, 1.83 against 2.88 px), and the board shows what else lives in that band.

## 2026-10-28 — pipeline

- The data contract builds from the public release alone: 373 clips in 2.2 MB of JSON, with per-frame series loaded per engine.
- Every number the page will quote is reproduced from the paper's own outputs before anything is drawn: league medians, motion medians, the exact engine-level ρ = 0.9 (p = 1/12), the Pareto front, the matched-motion bands (8 overlap, 5 usable, 2 reverse), and the raters' agreement (α 0.209 and 0.478).
- First result of the price-of-motion lens: Wan 2.2 leads until a doubling of motion is worth 1.23 px of line drift. LTX-2.3 then leads for a sliver, and from 1.27 px Gen-4.5 leads. Gen-4 Turbo sits on the Pareto front but never leads at any price: it lies off the front's convex hull.
- Failure tags are transcribed by hand from the taxonomy, and a test checks each one against its source text, so none can be invented.

## 2026-10-28 — planning

- Decided where the clips live: a bucket under the studio's own domain, all 373 served byte-exact. Re-encoding would have broken the C2PA signatures on 288 clips, and the release asks people not to. That also retired the card's "60–100 clip subset", which existed only to keep hosting costs down.
- Metrics come pre-computed from the released per-clip outputs. Per-frame series already exist for every clip, so nothing is re-run and the page can't drift from the paper's numbers.
- A correction caught while reading the data: the "9×" headline holds only against Wan 2.2. Against Gen-4 Turbo, Gen-4.5 moves 3.8× as much. The page says both.
- The paper reports a Pareto front but deliberately declines to set an exchange rate between stability and motion. The Stillness Tax tab will try three ways of handing that choice to the reader (price of motion, motion floor, matched-motion band), and the clearest one wins.
- The rating mode becomes the live demo of an open kit, blindpanel, built alongside.
