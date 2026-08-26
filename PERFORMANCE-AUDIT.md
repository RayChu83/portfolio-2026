# Mobile Performance Audit & Remediation Proposal

**Repo:** `personal/portfolio` · **Branch:** `main` @ `504bff0`
**Date:** 2026-08-25
**Scope:** every component on the `/` route, the two animation systems driving them, and the assets they pull.
**Premise:** the site is treated as *completely unusable* on mobile. This document explains why that is the expected outcome given the current code, not a mystery.

---

## 1. Verdict up front

The site is not slow because of "too many animations." It is slow because of **five specific constructs**, four of which would tank a desktop too and are simply being absorbed there by a 10× faster CPU and 30× more GPU memory.

Ranked by how much of the problem each one owns:

| # | Cause | Where | Est. cost on a mid-tier 2020 phone |
|---|---|---|---|
| **P0-1** | `createMap()` runs synchronously on the client and blocks the main thread | `dotted-map.tsx:79` ← `HeroHeadshot.tsx:1275` | **1.5–7 s of frozen UI**, measured 388–863 ms warm on an M-series Mac |
| **P0-2** | A 7680×4320 / 1.65 MB JPEG is loaded as a raw CSS `background-image`, bypassing `next/image` | `Work.tsx:954` | **~130 MB decoded bitmap**, multi-second decode or renderer OOM |
| **P0-3** | Per-frame animated `blur()` + two `mask-composite` layers + `feTurbulence` per carousel card | `Work.tsx:274–334, 648–661` | Frame time **10–20× budget**; carousel is unusable |
| **P0-4** | The tilt spring runs a permanent rAF loop on touch devices and never stops, even off-screen | `useTilt.ts` + `useIsTiltableDevice.ts` | A permanent 60 fps tax on the whole page |
| **P0-5** | Animated `mask-image` gradient + `border-radius` on the hero photo, on every scroll tick, for 250–400 dvh of pinned scroll | `HeroHeadshot.tsx:493, 933–936, 1386` | Non-compositable repaint of a full-screen element per tick |

Fixing P0-1 through P0-3 alone should take the page from "inaccessible" to "usable." Everything after that is refinement.

The codebase is unusually well-reasoned — the comments show someone who already thought hard about compositor layers, `will-change` scoping, layout thrash, and reduced motion. The problems below are almost all cases where **a mitigation was written for the wrong layer**, or where a single un-audited line undoes an otherwise careful design.

---

## 2. What was actually measured

Everything in this section is a real number from this machine, not an estimate.

**JavaScript shipped to the client (production build, Next 16.3.1 / Turbopack):**

```
total gzipped JS on first load:   310 KB
largest chunk (gsap + motion):    132 KB gz  (383 KB raw)
next chunk:                        72 KB gz
next chunk:                        47 KB gz
next chunk:                        39 KB gz
```

310 KB gzipped is roughly **1.2 MB of JavaScript to parse and compile**. On a 2020-era mid-range phone that is ~1–2 s of main-thread work before a single animation frame runs. Two full animation libraries ship (`gsap` + `motion`), plus `svg-dotted-map` (53 KB of module, containing an embedded world raster).

**`createMap()` — the single most expensive call in the app.** Measured directly against the installed package on an Apple-silicon Mac in Node:

```
mapSamples: 10000  →  3,649 points   863 ms  (warm) / 1,764 ms (cold)
mapSamples:  4500  →  1,603 points   388 ms  (warm) /   827 ms (cold)
```

This is *synchronous, blocking, single-threaded* work. Mobile Safari / Chrome on a Snapdragon 700-series or an A12 is conservatively **4–8× slower** on this kind of tight numeric loop. That puts the compact (mobile) path at **1.5–3 s of a completely frozen tab**, and the desktop path at **3.5–7 s**. And it produces 1,603–3,649 React elements that then have to be reconciled, laid out, and painted through an SVG mask.

**Raw asset bytes fetched at page load, outside `next/image`:**

```
public/blitz.jpg               1,651,384 B   7680 × 4320
public/SyllabusToCalendar.png    487,603 B   1920 × 1000
public/Unlevered.png             102,312 B   1920 × 1000
                               ───────────
                               2,241,299 B
```

These are fetched *in addition to* the optimized versions `next/image` requests for the same three files. See P0-2.

**Fonts:** 8 Aeonik `.otf` faces at ~53 KB each (436 KB total), plus Google Inter, plus 232 KB of Chillax `.otf` that is **referenced nowhere in `src/`**. `.otf` is the wrong wire format — WOFF2 would cut each face by ~60%.

**Dead weight in `public/`:** `Dark Version.jpg` (1.0 MB), `kawaii_headshot.png` (797 KB), `kawaii_headshot_colored.png` (1.16 MB), and two unused `.jpeg` variants are committed and unreferenced.

---

## 3. Direct answer: is anything animating off-screen?

**Yes — four separate things.**

### 3.1 The tilt spring never stops, and is never gated on visibility

`useTilt.ts` runs a `requestAnimationFrame` loop integrating a damped spring at a fixed 1/240 s step. It parks itself when settled — good. But on a touch device it is driven by `deviceorientation` (`useTilt.ts`, the `isTiltable` branch), and **a real accelerometer never produces two identical readings.** Sensor noise re-arms the target on essentially every event, so `setTarget` calls `frame ??= requestAnimationFrame(render)` continuously and the loop **never parks**.

Consequences:

- The spring runs at 60 Hz **for the entire session**, including while the visitor is reading the Work carousel three screens below and the hero is nowhere near the viewport.
- Every frame writes `--tilt-x` / `--tilt-y` onto `sceneRef`, which invalidates the `calc()`-based `transform` on `HeroHeadshot.tsx:1352–1356`.
- On the non-compact path it *also* invalidates `FOREGROUND_SHADOW` (`HeroHeadshot.tsx:57`), a `drop-shadow` whose offsets are `calc()` over those same properties — forcing a filter re-rasterisation of a full-size layer every frame. The code already recognises this and freezes the shadow under `COMPACT` (`FOREGROUND_SHADOW_COMPACT`), which is the right call — but the *transform* invalidation remains on all paths.

There is no `IntersectionObserver`, no `document.visibilitychange` handler, and no `ScrollTrigger` gate on the loop.

### 3.2 The carousel rasterises all three cards' masks and filters during initial page load

`Work.tsx:795` calls `placeAtIndex(START_INDEX)` at mount, which calls `applyLayout()` → `updateArc()`. That writes `--depth`, `--focus-x`, a `blur()/brightness()/saturate()` filter, and two composited mask layers onto **every card**, while the visitor is looking at the hero and the carousel is a full viewport-plus below the fold.

So the most expensive paint on the page happens during the load, off-screen, competing with `createMap`, font loading, and hydration.

### 3.3 The world map is built and painted while at `opacity: 0`

`mapReady` (`HeroHeadshot.tsx`) defers `createMap` by two rAFs specifically to keep it off the first paint — a good instinct. But it only *moves* the work; it does not remove it. The 1,603–3,649 `<circle>` elements are then mounted into the document and painted through an SVG `<mask>` (`dotted-map.tsx:143–160`) **while `mapRef` is still at `opacity: 0`** and will stay there for most of the pinned scroll. The visitor pays for a paint they cannot see, at the exact moment they are waiting for the hero.

### 3.4 `will-change: transform` is permanent on the carousel faces

`Work.tsx:920` puts `will-change-transform` on each face as a static class. The hero does this correctly — `syncWillChange` (`HeroHeadshot.tsx`) scopes the hint to the hero's own passage through the viewport, with a comment explaining exactly why an always-on hint is harmful on a phone. **That lesson was not applied to `Work.tsx`.** Three faces — each carrying a blurred image and two masked overlay layers — are promoted to their own compositor layers for the entire session, at full card size, on a device where that memory is scarce enough that the browser may start silently ignoring the hint altogether.

---

## 4. Findings by component

### 4.1 `HeroHeadshot.tsx` (1,421 lines)

**P0-1 — `createMap()` blocks the main thread.**
`DottedMap` (`dotted-map.tsx:78–81`) calls `createMap({ width, height, mapSamples })` inside `useMemo` — i.e. **during the React render pass**, synchronously, on the client. Measured at 388–863 ms warm on a fast desktop; 1.5–7 s on target mobile hardware. The `useMemo` is correct and prevents *repeats*, but the first call is unavoidable and unschedulable where it currently sits. `mapSamples` is 10,000 / 4,500 (`HeroHeadshot.tsx:474–475`).

**P0-5 — the hero photo is repainted, not composited, on every scroll tick.**
Three properties on `photoRef` are outside the compositor's fast path:

- `PHOTO_MASK` (`:493`) is a `linear-gradient` mask whose stops are `calc()` over `--photo-reveal`, scrubbed 0→1 across `PHOTO_ARRIVE`. Every distinct value re-rasterises the masked element **at full stage size**.
- `borderRadius` is tweened 48 → 300 px (`:933–936`). Border-radius changes force a repaint of the element and its clip.
- `filter: blur()` for the focus pull. This one is **already correctly excluded under `COMPACT`** — the reasoning in the `PHOTO_BLUR` comment is exactly right. The mask and the radius were not given the same treatment.

All three land on the one element that is *also* inside a 3D-transformed subtree with `perspective-distant`.

**P1 — the pin is very long.** 400 dvh full / 250 dvh compact (`:90, :132`). Every pixel of that is a scrub tick recomputing a timeline that includes a mask, a border-radius, three SplitText waves, a scaled 1,600-circle SVG, and a `--tilt-strength` fader. 250 dvh of thumb on a phone is a lot of scrolling spent in the most expensive state the page has.

**P1 — `SplitText` with `autoSplit: true`** (`:782`) re-splits on resize. On mobile, the address bar sliding away **is** a resize. Each re-split tears down and rebuilds the per-glyph tweens on three labels, then triggers a `ScrollTrigger` refresh, which re-runs `fitStageToLabel`, re-measures the pin, and re-derives the flight path. This fires during ordinary scrolling.

**P1 — the mobile-resize mitigation is in a file that is never mounted.** `SmoothScroll.tsx` sets `ignoreMobileResize: true` and carefully explains why a mid-pin address-bar resize visibly jumps the scrub. **`SmoothScroll` is imported by nothing** — grep confirms it appears only in its own definition. It is dead code. So none of that protection is active, and several comments in `HeroHeadshot.tsx` (the portal rationale, the `fixed`-containing-block discussion) describe a `ScrollSmoother` that is not on the page.

**P1 — `PageLoader` gates the page on the wrong URLs.**
`PageLoader.tsx` preloads `headshotPhoto.src`, which for a static import is `/_next/static/media/headshot.<hash>.png` — the **raw original**. But `<Image src={headshotPhoto} fill>` requests `/_next/image?url=…&w=…&q=75`. These are two different URLs. The gate therefore:
- downloads the 300 KB original that the page never paints, and
- releases without having actually preloaded the image that *is* painted.

It also blocks on `document.fonts.ready`, holding a white spinner over the whole page for **up to 4 s** (`FALLBACK_TIMEOUT`). On a phone this converts a slow-but-progressive load into a long blank screen, which is a worse experience and a worse LCP.

**P2 — 3D transform stack.** `perspective-distant` + `transform-3d` + a `translateZ(70px)` layer + a `drop-shadow` on that layer means the drawing's foreground is a 3D-transformed, filtered layer. That combination is the classic mobile-Safari performance cliff.

### 4.2 `Work.tsx` (1,088 lines) — the heaviest component on the page

**P0-2 — a 33-megapixel raw JPEG as a CSS background.**
`Work.tsx:954`:

```js
backgroundImage: `url("${project.image}")`,   // "/blitz.jpg" → 7680 × 4320, 1.65 MB
```

This is the *only* place the project images are referenced outside `next/image`, and it defeats every optimisation the `<Image>` next to it applies. Three consequences:

1. **Double download.** The same three files are fetched twice — once optimised via `/_next/image`, once raw. ~2.24 MB of pure waste.
2. **Not lazy.** `loading="lazy"` on the `<Image>` (`:930`) does nothing for this. It is a CSS background on a rendered element (`opacity: 0` still counts as rendered), so the browser fetches it during initial page load.
3. **Memory.** 7680 × 4320 × 4 bytes ≈ **132 MB** of decoded bitmap for one card. Older phones give a renderer process a few hundred MB total. This alone is enough to cause a multi-second decode stall or a tab reload, which matches "completely inaccessible."

**P0-3 — the per-card effect stack, recomputed every scroll frame.** Each of the three cards carries, simultaneously:

| Layer | Construct | Why it is expensive |
|---|---|---|
| Image | `blur(0–3.5px) brightness() saturate()` set per frame (`:648–653`) | `blur` is the most expensive CSS filter; re-rasterises the full-bleed image every frame |
| Image | `IMAGE_MASK` — radial gradient with `calc()` over `--depth` (`:274`) | New rasterisation per distinct `--depth` |
| Dust | `DUST_LAYER_MASK` — **two mask layers** combined with `mask-composite: intersect` (`:288`), one of them an inline `feTurbulence` SVG data-URI (`:238`) tiled at 280 px | SVG filters are software-rasterised; `mask-composite` is a second full pass. This is the most expensive single construct in the codebase. |
| Grain | `feTurbulence` background at `baseFrequency 1.1 / 3 octaves` (`:327`) + `GRAIN_MASK` + `mix-blend-hard-light` (`:981`) | A second software turbulence pass, plus a blend mode that forces a backdrop readback |
| Face | `filter: brightness()` (`:606`) + permanent `will-change-transform` (`:920`) | Filter creates a grouping element that flattens and re-composites the whole subtree |

The `DEPTH_STEP` quantisation (`:176`) is a genuinely good optimisation and cuts mask rasterisations substantially — but it does not help the **image `blur()`, which is written unquantised on every single frame** (`:648`). That write alone can exceed a phone's entire 16 ms budget.

**P0-3b — layout thrashing in `updateArc()`.**
The loop at `:549–663` interleaves reads and writes per card:

```
read  scroller.clientWidth, scroller.scrollLeft
read  cardPitch() → cardRefs[0].offsetLeft, cardRefs[1].offsetLeft
  per card:
    read  card.offsetLeft, card.offsetWidth
    write card.style.zIndex
    write card.style.perspectiveOrigin
    write gsap.set(face, …)            ← transform + filter
    write face.style.setProperty(…) ×2
    write gsap.set(img, { filter })     ← blur
    write gsap.set(dust,  { opacity })
    write gsap.set(grain, { opacity })
```

Every `offsetLeft` read after a style write forces a **synchronous layout flush**. With three cards that is three forced reflows per frame, each one flushing all the mask and filter invalidations queued by the previous card. The geometry here is entirely static between resizes — it should be measured once and cached.

**P1 — `ResizeObserver` on the scroller fights the mobile address bar.**
`:797` observes the scroller and calls `placeAtIndex()`, which writes `scrollLeft`, calls `setCenteredIndex` (a React state update), and re-runs `applyLayout()`. On mobile the address bar hiding/showing resizes the viewport, so this fires **mid-gesture**, re-centring the carousel under the visitor's finger and triggering a full re-layout plus a React re-render.

**P1 — the carousel has no usable mobile affordance.** The arrows are `hidden … md:block` (`:1013, :1039`) and the wheel handler was deliberately removed. On a phone the only way to change cards is a horizontal swipe inside a vertically-scrolling page — and `snap-mandatory` plus a janky frame rate makes that swipe unreliable.

**P2 — background-colour tween** (`:449–460`) animates `backgroundColor` on a `min-h-dvh` section: a full-viewport repaint over 600 ms. Acceptable in isolation, but it fires exactly when the carousel is entering.

### 4.3 `Header.tsx`

Runs a **second, independent scroll system** (`motion`'s `useScroll` + `useTransform`) alongside GSAP's `ScrollTrigger`. Two scroll observers, two sets of resize listeners, two measurement passes. The effect itself — a `scale` from 1 → 0.6 across the header's own height — is cheap and correctly implemented as a transform. But it is the sole reason `motion`'s scroll machinery ships at all.

### 4.4 `WorkDescriptions.tsx`

`AnimatePresence` + a `motion.div` for a 300 ms opacity/translate crossfade. Correct and cheap. It is, however, the *other* reason `motion` is in the bundle. Two libraries for one fade and one scale is the trade being made.

Separately: `aria-live="polite"` wraps content that changes on every carousel scroll (`Work.tsx:1084`), so a screen reader re-announces a full paragraph each time a card passes centre. Not a perf issue, but worth fixing in the same pass.

### 4.5 `dotted-map.tsx`

Beyond `createMap` itself: the component emits one `<circle>` per point (`:165`) — **3,649 DOM nodes** on desktop, 1,603 on mobile — inside a `<g>` carrying an SVG `mask` (`:157`). SVG masks are not compositor-accelerated. The hero's timeline tweens `scale` and `autoAlpha` on `mapRef`, the **parent** of that SVG, across the entire `LABELS_EXIT` span — which re-rasterises the whole masked 1,600-node subtree on every scroll tick of that phase.

The `useMemo` guards and the hoisted `NO_MARKERS` constant are correct and should be kept.

### 4.6 `useTilt.ts` / `useIsTiltableDevice.ts`

See §3.1. Additional notes:

- The spring integrates at a fixed 1/240 s step, so a 60 Hz frame runs **4 iterations**, and a dropped frame up to `MAX_FRAME` (1/15 s) runs **16**. The fixed step is the right call for consistency across refresh rates; the cost is that it amplifies jank once frames start dropping.
- On mobile the loop's *purpose* is a ±8°/±12° head tilt that, per §3, is invisible for most of the session.
- `prefers-reduced-motion` is checked once at effect setup and never re-evaluated. Flipping the OS setting requires a reload.

### 4.7 Global / build

- **310 KB gzipped JS, all on the critical path.** No `dynamic()` import anywhere; `Work` and its entire effect stack are in the initial bundle even though the section starts a full viewport below the fold.
- **`gsap` + `motion` both ship.** `ScrollSmoother` and `SplitText` are registered; `ScrollSmoother` is used only by dead code.
- **8 `.otf` font faces + Inter.** Only `--font-aeonik-regular` and `--font-aeonik-medium` are actually referenced in markup, but all 8 `@font-face` rules are declared and `document.fonts.ready` is what the loader blocks on.
- **`min-h-dvh` + `dvh`-sized stage + a `ScrollTrigger` pin.** On mobile, `dvh` changes as the address bar moves, which resizes the pin's trigger, which refreshes ScrollTrigger, which re-measures everything. With `ignoreMobileResize` living in unmounted code, nothing is suppressing this.
- **Unused deps and files:** `lucide-react` (unreferenced), `src/components/ui/button.tsx` (imported by nothing, the only consumer of `@base-ui/react` and `class-variance-authority`), the entire `fonts/Chillax/` directory, and ~3 MB of unused images in `public/`.

---

## 5. Proposal

Phased so that each phase is independently shippable and independently verifiable. **Phase 1 is where essentially all the win is.**

### Phase 1 — Make the page usable at all (target: 80–90% of the improvement)

**1.1 Move `createMap` off the client entirely.** *(fixes P0-1)*

The map is static — a fixed world sampled at a fixed density with one fixed marker. Nothing about it depends on runtime state. Generate the point list at **build time** and ship it as data.

- Add a script that calls `createMap()` for both sample counts and writes the resulting `points` array (plus the projected New York `x`/`y`) to a JSON module.
- Have `DottedMap` accept precomputed points instead of calling `createMap`.
- Drop `svg-dotted-map` from the client bundle (−53 KB, and −863 ms of blocking work).

**Even better:** because the output is deterministic, serialise it to a **single `<path>` with one `<circle>`-equivalent subpath per dot, or a pre-rendered static `.svg` asset**, and drop 1,603–3,649 DOM nodes to one element. That also removes the SVG mask re-rasterisation problem in one move.

*Fallback if build-time generation is undesirable:* run `createMap` in a Web Worker and post the points back. This unblocks the main thread but keeps the DOM node count, so it is strictly second-best.

**1.2 Stop loading raw originals as CSS backgrounds.** *(fixes P0-2)*

Three sub-fixes, all required:

- **Resize the source images.** `blitz.jpg` at 7680 × 4320 has no business in a 720 px-wide card. Re-export all three at ≤ 1920 px on the long edge. That alone takes `blitz.jpg` from 1.65 MB to well under 200 KB and the decoded bitmap from ~132 MB to ~8 MB.
- **Replace the dust layer's `background-image` with a reference to the already-decoded optimised image.** Either render a second `<Image>` inside the dust div with the mask applied to it, or — better, per 1.3 — remove the dust layer on mobile so the question does not arise.
- **Gate the whole card effect stack behind mobile detection** so the background never mounts on a phone.

**1.3 Give `Work` a compact build, the way `HeroHeadshot` already has one.** *(fixes P0-3)*

The hero's `COMPACT` query and its `matchMedia` branching are the right pattern; apply the same discipline to the carousel. Under `(max-width: 1023px), (pointer: coarse)`:

- **Drop the dust layer entirely.** Two mask layers, `mask-composite`, and an `feTurbulence` stencil per card is not a mobile effect.
- **Drop the grain layer entirely.** Second turbulence pass plus `mix-blend-hard-light`.
- **Drop the image `blur()`.** Keep `brightness()` and `saturate()` — those are cheap, compositable, and carry most of the depth cue. This mirrors the hero's own `PHOTO_BLUR` reasoning exactly.
- **Drop `IMAGE_MASK`.** Replace the radial dissolve with an `opacity` ramp on the face, which the compositor handles for free.
- **Keep** the transform arc: `rotateY`, `z`, `scale`, `x`. These are pure compositor transforms and are the actual cover-flow effect. They cost almost nothing.

The result on mobile is the same choreography — cards turning, receding, dimming — built out of properties a phone can composite.

**1.4 Cache the carousel geometry; stop thrashing layout.** *(fixes P0-3b)*

`offsetLeft` / `offsetWidth` / `clientWidth` only change on resize. Measure them once into a plain array in the existing `ResizeObserver`, and have `updateArc` read `scroller.scrollLeft` **once** at the top of the frame and do pure arithmetic from the cached table. That reduces the per-frame layout flushes from three to zero.

**1.5 Scope `will-change` on the carousel faces.** *(fixes §3.4)*

Delete the static `will-change-transform` class (`Work.tsx:920`) and apply the hint from a `ScrollTrigger`'s `onToggle`, exactly as `syncWillChange` already does in `HeroHeadshot.tsx`. The reasoning is already written down in that file; it just needs to be applied here too.

**1.6 Park the tilt loop when the hero is not visible.** *(fixes §3.1)*

Add an `IntersectionObserver` (or reuse the hero's existing `promote` trigger) so the `deviceorientation` listener is attached only while the hero is on screen and detached the moment it leaves. Also handle `visibilitychange` so a backgrounded tab detaches. Additionally, apply a small **dead zone** to the orientation reading (ignore deltas below ~0.3°) so ordinary sensor noise cannot keep the spring permanently awake.

### Phase 2 — Cut the critical path (target: faster start on every device)

**2.1 Code-split `Work`.** It sits a full viewport below the fold and pulls in `motion`'s `AnimatePresence` plus its own effect stack. `next/dynamic` with `ssr: false` (or an intersection-triggered import) takes it off the initial parse budget entirely.

**2.2 Pick one animation library.** `motion` exists on this page for exactly two effects: a `scale` in `Header.tsx` and a 300 ms crossfade in `WorkDescriptions.tsx`. Both are a handful of lines of GSAP — which is already loaded, already registered, and already driving everything else. Dropping `motion` removes a second scroll-observation system and a meaningful slice of that 132 KB chunk.

**2.3 Convert the fonts to WOFF2 and ship only what is used.** `.otf` → `.woff2` cuts each face ~60%. Only `regular` and `medium` are referenced; delete the other six `localFont` declarations and the unused `fonts/Chillax/` directory. Add `display: "swap"` so text is never blocked on a font.

**2.4 Rewrite `PageLoader`.** *(fixes §4.1 P1)*
- Stop blocking on `document.fonts.ready` — with `display: swap` the fallback face is a feature, not a bug.
- Stop preloading `headshotPhoto.src`; it is the wrong URL. Use `<Image priority>` on the hero photo and let Next emit the correct `<link rel="preload">` for the URL that is actually painted.
- If a gate is still wanted, hold only on the two SVGs (which *do* resolve to the same URL) and cut `FALLBACK_TIMEOUT` to ~1.5 s.

**2.5 Delete `SmoothScroll.tsx`,** or mount it. Right now it is 163 lines of careful, inert code, and several comments elsewhere in the codebase describe behaviour it would provide but does not. Deleting it also lets `ScrollSmoother` be dropped from the GSAP registration.

**2.6 Clean the repo:** remove `lucide-react`, `src/components/ui/button.tsx` (with `@base-ui/react` and `class-variance-authority` if nothing else claims them), and the ~3 MB of unreferenced images in `public/`.

### Phase 3 — Refinement

**3.1 Shorten the mobile pin.** `PIN_LENGTH_COMPACT` at 250 dvh is still a long time to hold a phone in the most expensive rendering state on the page. 120–150 dvh delivers the same sequence — every constant in the hero is a share of the pin, so nothing about the choreography changes — in half the frames.

**3.2 Make the hero photo compositable under `COMPACT`.**
- Replace the scrubbed `PHOTO_MASK` gradient with a plain `opacity` crossfade on mobile. The wipe is beautiful; it is also a full-size re-rasterisation per tick.
- Set `borderRadius` to its final value up front instead of tweening 48 → 300 px.
- The `blur()` exclusion already there is correct — keep it and extend the same logic to these two.

**3.3 Suppress mobile address-bar refreshes.** Set `ScrollTrigger.config({ ignoreMobileResize: true })` globally (this works without `ScrollSmoother`), and debounce the carousel's `ResizeObserver` so it ignores height-only changes.

**3.4 Reconsider `autoSplit`.** If the type is only ever going to be split once at a known size, `autoSplit: false` plus an explicit re-split on a debounced *width* change removes a whole class of mid-scroll rebuild on mobile.

**3.5 Give mobile a real carousel affordance** — show the arrows below `md`, or add a visible swipe hint. Once the frame rate is fixed the swipe will work; it should still be discoverable.

**3.6 Fix the `aria-live` region** so it announces on settle rather than on every frame the centred card changes.

---

## 6. Budgets and how to verify

Set these as the acceptance criteria for the work above:

| Metric | Target | Measure with |
|---|---|---|
| Longest main-thread task during load | **< 200 ms** | Chrome DevTools Performance, 4× CPU throttle |
| Total blocking time (TBT) | **< 300 ms** | Lighthouse, Moto G Power preset |
| First-load JS (gzipped) | **< 180 KB** | `next build` output |
| Total bytes fetched on `/` | **< 1.5 MB** | DevTools Network, cache disabled |
| Frame time while scrolling the hero pin | **< 16 ms p95** | Performance panel, 4× CPU + 4× GPU throttle |
| Frame time while swiping the carousel | **< 16 ms p95** | same |
| Peak renderer memory | **< 250 MB** | DevTools Memory / `chrome://memory-internals` |

**Order of verification.** After each phase, profile on a real low-end device (or Chrome's *Moto G Power* + 4× CPU throttle at minimum — the emulated profile understates GPU-bound work like `blur` and `mask-composite`, which is precisely where this page's cost lives). Watch the **Rendering → Paint flashing** and **Layer borders** overlays: the two signals to chase are large green repaint rectangles during scroll, and layers that stay promoted after their section has left the viewport.

---

## 7. Summary table

| Priority | Fix | File(s) | Effort | Impact |
|---|---|---|---|---|
| P0 | Precompute the map at build time | `dotted-map.tsx`, `HeroHeadshot.tsx:1275` | M | **Removes 1.5–7 s of frozen main thread** |
| P0 | Resize source images; stop the raw CSS background | `public/*`, `Work.tsx:954` | S | **Removes ~130 MB of decode + 2.2 MB of download** |
| P0 | Compact build for the carousel (no dust, grain, blur, or image mask on mobile) | `Work.tsx` | M | **Brings frame time inside budget** |
| P0 | Cache geometry; remove layout thrash in `updateArc` | `Work.tsx:549–663` | S | 3 forced reflows/frame → 0 |
| P0 | Gate the tilt loop on visibility; add a sensor dead zone | `useTilt.ts` | S | Removes a permanent 60 Hz tax |
| P1 | Scope `will-change` on carousel faces | `Work.tsx:920` | XS | Frees GPU memory for the whole session |
| P1 | Code-split `Work` | `page.tsx` | S | Shorter critical path |
| P1 | Drop `motion`; use GSAP for the two remaining effects | `Header.tsx`, `WorkDescriptions.tsx` | M | Smaller bundle, one scroll system |
| P1 | WOFF2 fonts; ship only the 2 used weights | `fonts/` | S | −350 KB, faster text |
| P1 | Rewrite `PageLoader` (wrong preload URLs, 4 s gate) | `PageLoader.tsx` | S | Much better perceived load |
| P2 | Delete dead `SmoothScroll.tsx` and unused deps/assets | various | XS | Clarity; small bundle win |
| P2 | Shorten mobile pin to ~150 dvh | `HeroHeadshot.tsx:132` | XS | Half the frames in the expensive state |
| P2 | Opacity crossfade instead of scrubbed mask on mobile | `HeroHeadshot.tsx:493` | S | Compositable hero reveal |
| P2 | `ignoreMobileResize`; debounce the carousel `ResizeObserver` | `Work.tsx:797` | S | No mid-gesture re-layout |
| P3 | Mobile carousel affordance; fix `aria-live` | `Work.tsx` | S | Usability / a11y |

---

## Appendix — one paragraph on why this happened

Nearly every expensive construct here is accompanied by a comment demonstrating that its cost was understood. `DEPTH_STEP` quantises mask rasterisations. `PHOTO_BLUR` is excluded on mobile with a precise explanation of why blur is uniquely bad. `syncWillChange` scopes layer promotion. `MAP_SAMPLES_COMPACT` halves the dot count. `smoothTouch: false` keeps a second spring off phones.

The gap is that these mitigations were each applied **locally, to the one thing being written at the time**, and the page as a whole was never profiled as a system. So `will-change` is scoped in the hero and permanent in the carousel; `blur` is excluded from the hero's photo and written unquantised every frame onto the carousel's images; the mobile-resize guard lives in a file that is never mounted; and the map's sample count was tuned down without anyone noticing that the function producing those samples takes the better part of a second **on a desktop**.

The fix is not to animate less. It is to make each effect out of properties the compositor can handle, and to do the expensive, deterministic work once at build time instead of on every visitor's phone.
