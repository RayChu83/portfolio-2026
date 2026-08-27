# Reduced-Motion Audit

**Scope:** every animated component, audited specifically for `prefers-reduced-motion: reduce`.
**Trigger:** reported that the site is broken end-to-end on a phone with "reduce motion" enabled, while comparable production sites fall back to an entirely static layout under the same setting.
**Status:** findings (§0–§4) confirmed. A first fallback was implemented against the original plan and is **superseded** — see §5 for why and §6 for the refined plan that replaces it.

**Governing principle for the fallback (revised):** a reduce-motion visitor should see _everything_ a motion visitor sees — the kawaii illustration, the headshot photograph, the dotted world map, the headshot placed on New York, and all three captions — with the motion alone removed. Not a reduced experience; the same experience, still. Every graphic the scrubbed timeline passes through is content, and none of it may be dropped, faded out, or left at `opacity: 0` just because nothing is animating it.

## 0. Verdict

The instinct that "this hasn't been handled at all" is only half right. Three of the four animated components already have a correct, deliberate reduced-motion branch and were clearly built with the preference in mind:

- `Work.tsx` — has a full static fallback (`layFlat()`), a hard colour cut instead of a fade, and `behavior: "auto"` instead of smooth scrolling. **No bug found.**
- `Header.tsx` — the shrink tween is wrapped in a `matchMedia("(prefers-reduced-motion: no-preference)")` branch and simply never registers under reduce, leaving the greeting at its natural size. **No bug found.**
- `WorkDescriptions.tsx` — the crossfade is likewise gated to `no-preference`; under reduce the copy just renders at `opacity: 1` from the start. **No bug found.**
- `useTilt.ts` — checks `matchMedia("(prefers-reduced-motion: reduce)")` and returns before attaching any listener or starting the spring loop. **No bug found.**

`HeroHeadshot.tsx` is the exception, and it is also the very first thing on the page — so its bugs are the first thing every visitor with reduce-motion enabled sees, sitting on top of everything else. That single component is almost certainly the entire "the whole site is broken" experience: two large, permanently fixed text blocks that never leave the screen, and a third caption that lands in the wrong place and overlaps the section below. Everything downstream of the hero (Work's carousel, its arrows, its dots) still works correctly underneath the overlap — it just cannot be seen or reached over the stuck text.

## 1. How the hero currently handles reduce-motion (for reference)

`HeroHeadshot.tsx` renders three pieces of copy — "Software Engineer" (`roleRef`), "Who Designs" (`craftRef`), and "From New York City" (`placeRef`) — plus the photograph and the two decorative kawaii-drawing layers. In the **motion-enabled** build, the whole thing works like this:

1. `roleRef`/`craftRef` are portaled to `document.body` and rendered `fixed` in the top-left / bottom-right corners, marked `motion-safe:invisible` in their class list so they never flash in unposed.
2. A `gsap.matchMedia()` branch keyed on `(prefers-reduced-motion: no-preference)` builds a scrubbed, pinned (`ScrollTrigger`, `pin: true`) timeline: the pin holds the hero in place for `400%`/`150%` of extra scroll, during which `SplitText` waves the two labels in, the photo dollies in and gets wiped clear, the drawing peels away, and eventually the two labels are tweened back out (`yPercent` ±105%) and a world map + "From New York City" grows in around the photo, which shrinks into a marker pin.
3. A `ScrollTrigger` `onToggle` (`syncLabels`) is what actually hides `roleRef`/`craftRef` again once the pin's active window ends — visibility is flipped to `"hidden"` the moment the trigger deactivates, and back to `"visible"` if the visitor scrolls back up into it.
4. `placeRef`, the "From New York City" caption, is positioned `absolute` inside the pinned stage, hung _below_ the stage's own bottom edge by a calculated offset (`PLACE_BOTTOM = "calc((100% - 100dvh) / 2)"`), which is only correct because a same-effect `ScrollTrigger` refresh handler (`fitStageToLabel`) measures how far the label overflows the stage and pushes a matching `margin-bottom` onto the stage's parent, reserving that space in the page's normal flow so nothing after the hero starts underneath the caption.

Every one of those four behaviors is produced by code that lives _inside_ the `(prefers-reduced-motion: no-preference)` branch (`media.add({ motion: MOTION, compact: COMPACT }, ...)`). The moment `motion` is false, that whole branch returns immediately (`if (!motion) return;`) — including `syncLabels`, the pin, and `fitStageToLabel`. None of it ever runs for a reduce-motion visitor.

## 2. What runs under reduce-motion today

A separate, much smaller branch exists and does run:

```
media.add("(prefers-reduced-motion: reduce)", () => {
  gsap.set(photoRef.current, { "--photo-reveal": 1, autoAlpha: 0 });
  gsap.timeline({
    scrollTrigger: { trigger: stageRef.current, start: "center center", end: "bottom top", scrub: true },
  })
    .to(photoRef.current, { autoAlpha: 1, ease: "none" }, 0)
    .to([drawingRef.current, featuresRef.current], { autoAlpha: 0, ease: "none" }, 0);
});
```

This does exactly one job: crossfade from the kawaii drawing to the photograph as the hero scrolls past, with no pin, no dolly, no blur, no wipe, no map.

Two problems with it, one old and one identified by this revision:

- It never touches `roleRef`, `craftRef`, or `placeRef` at all, and those three elements are not passive — their resting styles assume the pin exists. That is findings 1 and 2 below.
- **It is itself scroll-linked motion, and it destroys content.** A scrubbed opacity crossfade is an animation driven by the scroll wheel, which is the precise class of effect the preference asks to be spared. Worse, its end state is `autoAlpha: 0` on both drawing layers — so once the visitor has scrolled past the hero, the illustration is _gone_, and it was never a still frame anyone could look at on the way. Meanwhile `mapRef` carries an inline `opacity: 0` that only the motion branch ever lifts, so the world map is never shown to this visitor at all. See §5.

## 3. Root-cause findings

### Finding 1 — CRITICAL: the two corner labels never leave the screen

**Location:** `HeroHeadshot.tsx` portal markup, and `syncLabels` + the pin's `onToggle` (the only code that ever hides them).

`roleRef` ("Software Engineer") and `craftRef` ("Who Designs") are portaled to `<body>` and rendered:

```
className="fixed top-0 left-0 z-10 ... text-6xl md:text-7xl lg:text-8xl 2xl:text-9xl motion-safe:invisible"
```

`motion-safe:invisible` is a Tailwind variant equivalent to `@media (prefers-reduced-motion: no-preference) { visibility: hidden }`. Under reduce-motion that media query does not match, so **the class contributes nothing** and the paragraphs fall back to the browser default (`visibility: visible`). That is by design — a reduce-motion visitor should still be told they're looking at a software engineer's portfolio, just without the type-on animation.

The only code that ever sets `visibility: "hidden"` again is `syncLabels`, which is created and wired to `ScrollTrigger`'s `onToggle` exclusively inside the `motion` (no-preference) branch. That function, and the `ScrollTrigger` that calls it, simply do not exist under reduce-motion.

**Net effect:** for a reduce-motion visitor, "Software Engineer" and "Who Designs" render at full size (`text-6xl` and up — literally screen-filling at desktop sizes) pinned to the top-left and bottom-right of the _viewport_, via `position: fixed`, and stay there for the rest of the page. Scrolling into the Work carousel, the project descriptions, or anything else added later all happens underneath these two blocks of text, at `z-10`. This is very likely the entire "completely inaccessible" symptom reported: two giant permanent captions sitting on top of every button, arrow and card the rest of the page has.

### Finding 2 — CRITICAL: "From New York City" lands in the wrong place and overlaps the next section

**Location:** `placeRef` markup + `PLACE_BOTTOM`, and `fitStageToLabel` (the code that compensates for it — motion branch only).

`placeRef` is positioned `absolute` inside the stage:

```
style={{ bottom: "calc((100% - 100dvh) / 2)" }}
```

This deliberately resolves to a _negative_ offset — the label is meant to hang below the stage's own box, because while the hero is pinned the stage is centred in the viewport and this formula is exactly the gap between the stage's bottom edge and the screen's bottom edge. That's a deliberate, correct trick for the pinned case — but it depends on a second piece of code to work: `fitStageToLabel` measures the actual overflow on every `ScrollTrigger` refresh and pushes a compensating `margin-bottom` onto the stage's parent, so the page's own layout reserves that space and nothing starts underneath the label.

`fitStageToLabel` is declared and invoked only inside the `motion` (no-preference) branch, and re-hooked to `ScrollTrigger`'s `refresh` event there. Under reduce-motion it never runs, and the margin it would have reserved is never applied.

**Net effect:** the caption still renders — visibility isn't gated here, so `motion-safe:invisible` again simply doesn't apply and the label shows — but it renders at `bottom: calc((100% - 100dvh) / 2)` with no compensating space reserved after the hero. Since the stage's height is always `100dvh` minus whatever height `Header.tsx` takes (they share one `min-h-dvh flex flex-col` wrapper, `page.tsx`), this offset is a fixed negative number equal to roughly _half the header's height_, pushing "From New York City" down past the bottom of the hero and into whatever immediately follows it in the document — the "Products I've helped ship" heading and the top of the carousel.

### Finding 3 — MEDIUM: the header's helper copy invites an interaction that no longer does anything

**Location:** `Header.tsx`.

```
<span className="[@media(hover:none)]:hidden">Try to move your mouse</span>
<span className="hidden [@media(hover:none)]:inline">Try to tilt your device</span>
```

`useTilt` correctly stops writing `--tilt-x`/`--tilt-y` under the preference, so the head genuinely never moves — but the page still tells a reduce-motion visitor to go move their mouse or tilt their phone to see an effect that has been deliberately turned off for them. The honest fallback drops the line.

### Finding 4 — LOW: the full-page loading spinner ignores the preference

**Location:** `PageLoader.tsx`.

```
<div className="size-10 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-800" />
```

Tailwind's `animate-spin` is an unconditional infinite CSS rotation, not gated behind `motion-safe`/`motion-reduce`. On screen only briefly (capped at `FALLBACK_TIMEOUT = 1500`ms) and small, so low severity — but strictly an animation that plays regardless of the preference.

### Finding 5 — Judgment call, not a defect: small CSS transitions elsewhere

`Work.tsx`'s pagination dots (`transition-all duration-300`) and the carousel arrow buttons' hover/disabled transitions are plain CSS transitions, always active regardless of `prefers-reduced-motion`. These are short, small, user-triggered UI feedback, not the large-area ambient motion the preference exists to suppress, and most guidance (including the WCAG understanding doc for 2.3.3) treats this class of micro-interaction as acceptable. **No change recommended.**

### Finding 6 — CRITICAL (this revision): the fallback withholds the illustration and the map entirely

**Location:** the reduce branch quoted in §2, plus `mapRef`'s inline `opacity: 0`.

The motion build is a three-beat narrative and every beat carries a distinct graphic:

| Beat | Graphic                                                                                                   | Captions on screen                 |
| ---- | --------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 1    | The kawaii illustration (`kawaii_headshot_background.svg` + `kawaii_headshot_foreground.svg`), full-frame | "Software Engineer", "Who Designs" |
| 2    | The photograph (`public/headshot.png`), full-frame, sharp                                                 | "Software Engineer", "Who Designs" |
| 3    | The dotted world map with the photograph shrunk onto New York                                             | "From New York City"               |

The reduce branch delivers **beat 2 only**. Beat 1 exists momentarily but is animated to `autoAlpha: 0` by the same scrubbed timeline, so it is transient rather than a picture anyone gets to look at, and it ends erased. Beat 3 never appears: `mapRef` carries an inline `opacity: 0` and only the motion branch's `reveal` timeline ever tweens it up, so a reduce-motion visitor's map stays fully transparent forever — as does the entire point of the sequence, which is Ray being _from_ somewhere.

This is the substantive gap. Findings 1 and 2 make the page look broken; finding 6 makes the fallback a materially poorer telling of the same story, which is exactly what the preference is not supposed to cost anyone.

## 4. Why this reads as "the entire website is broken"

Put together, a reduce-motion visitor's actual experience today is:

1. Page loads. The hero photo crossfades in on scroll — the illustration fades out and never comes back.
2. "Software Engineer" and "Who Designs" appear at (typically) 60–128px type size, `fixed` in the screen's top-left and bottom-right corners, and **never go away**.
3. Scrolling further, "From New York City" appears roughly where the Work section's own heading and the top of the carousel should be, overlapping it — captioning a map that is invisible.
4. From this point on, every subsequent section is rendered _underneath_ two large fixed-position text blocks at `z-10`. Buttons and cards remain scriptable but are visually buried and largely unreachable by mouse/touch.

## 5. The first fallback, and why it is superseded

An implementation was made against the original §5 plan. It correctly fixed findings 1–4:

- The portal + `fixed` corner labels are skipped under the preference, replaced with `absolute` in-stage copies that scroll away with the hero.
- "From New York City" leaves the `PLACE_BOTTOM` scheme and renders as an in-flow block after the stage.
- `Header.tsx` gets `motion-reduce:hidden` on the tilt invitation; `PageLoader.tsx` gets `motion-reduce:animate-none` plus a neutral border so the ring is static rather than frozen mid-spin.
- `usePrefersReducedMotion()` was added as the render-time half of the decision, with `reducedMotion` added to the `useGSAP` dependency array so a live preference flip rebuilds the timeline against markup that actually exists.

Those parts stand and should be kept. What it got wrong is the shape of the fallback itself: it treated "reduced" as "less", inheriting the §2 branch untouched. The result still fades the illustration out on scroll, still never lifts the map's `opacity: 0`, and so still ships beat 2 alone. **The refined plan below replaces the fallback's composition; it does not undo the fixes listed above.**

## 6. Refined plan — the static storyboard

The motion build is three still frames joined by a scrub. Take the scrub away and the three still frames are still there, and they are all worth looking at. So the fallback renders them as three stacked panels down the page, in the same order, revealed by ordinary scrolling instead of a pinned timeline. Nothing moves; nothing is withheld.

This is the closest possible analogue to the motion experience: the same graphics, the same captions, the same narrative order, the same reading rhythm — one picture per screen — with the visitor's own scroll doing what the scrub used to do.

### 6.1 Structure: split the component

The static tree is substantial enough that interleaving it with the animated tree via inline `{reducedMotion && ...}` ternaries (the current approach) will not stay readable. Extract instead:

- **`HeroHeadshot.tsx`** — becomes a thin switch. Holds only the `mapData` dynamic import and `usePrefersReducedMotion()`, then returns either branch. Nothing else.
- **`HeroAnimated.tsx`** — the existing component almost verbatim, receiving `mapData` as a prop. Its `matchMedia` reduce branch (§2) is **deleted**, since it can no longer be reached; the `motion`/`compact` conditions object collapses to `compact` alone. All existing comments and constants move with it.
- **`HeroStatic.tsx`** — new. No GSAP, no `ScrollTrigger`, no `SplitText`, no portal, no `useTilt`, no refs, no measurement. Just markup and Tailwind.

The switch means `HeroStatic` mounts nothing the animated build needs and vice versa, so a preference flip is a clean unmount/mount rather than two builds contending over the same inline styles. Shared constants (`MAP_WIDTH`, `MAP_ASPECT`, `MAP_FADE_START`, `FOREGROUND_DEPTH`, `FOREGROUND_SCALE`, `PHOTO_RADIUS`) move to a small shared module both import, so the two builds cannot drift apart.

A note on hook order: this is why it must be a switch in a parent rather than an early return inside the current component — `useTilt`, `useGSAP` and the rest cannot be called conditionally.

### 6.2 Panel 1 — the drawing

A square frame, one viewport tall at most, holding both illustration layers exactly as the motion build renders them at rest:

- `kawaii_headshot_background.svg` at `translateZ(0)`, `kawaii_headshot_foreground.svg` at `translateZ(FOREGROUND_DEPTH) scale(FOREGROUND_SCALE)`. Keeping the transform pair is deliberate: it is a _static_ pose, not an animation, and it is what registers the features to the head at the right size. The `perspective-distant` wrapper stays for the same reason.
- The foreground's drop shadow uses the frozen `FOREGROUND_SHADOW_COMPACT` variant unconditionally here, since `--tilt-x`/`--tilt-y` are never written under the preference and the `calc` form would resolve against its `0` fallbacks anyway. Using the frozen string states the intent and avoids a filter that reads variables nothing sets.
- The photograph is **not** in this panel. It gets its own.

Captions: "Software Engineer" `absolute` top-left, "Who Designs" `absolute` bottom-right of the panel — same corners, same type scale, same uppercase treatment as the motion build. `absolute` within the panel, never `fixed`, so scrolling past takes them away with no JS.

### 6.3 Panel 2 — the photograph

The same square frame, holding `public/headshot.png` at full size, sharp, fully opaque, with no mask.

- The `PHOTO_MASK` gradient and the `--photo-reveal` custom property are dropped entirely rather than parked at `1`. A mask parked wide open is a no-op that still costs a rasterisation, and there is no timeline here to need the property.
- `priority` stays on this instance — it is the hero image for this build too.
- Carries `alt="Ray"`. This is the one instance that does; see 6.4.
- Corner radius: the motion build ends beat 2 with the photo square and only rounds it as it becomes a marker. Panel 2 stays square to match.

### 6.4 Panel 3 — the map, with the headshot on New York

This is the beat the current fallback drops completely, and it is the one that needs actual design work rather than just un-hiding something.

The map frame is built exactly as the motion build builds it — the `containerType: "size"` container, the `MAP_WIDTH` / `MAP_ASPECT` box, the single precomputed `<path>`, the `hero-map-fade` radial mask — with two differences:

- `opacity: 1` instead of `0`, and no `transformOrigin` / scale (the "grows in about New York" gesture is motion and simply does not happen).
- Inside the map frame, a small circular copy of the headshot positioned at the marker:

```
style={{
  left: `${mapData.marker.x * 100}%`,
  top: `${mapData.marker.y * 100}%`,
  transform: "translate(-50%, -50%)",
}}
```

`mapData.marker` already ships as a fraction of the 2:1 frame (`{ x: 0.2918, y: 0.3444 }` at full density), and the frame is held to that exact ratio — so this is correct at every viewport with nothing measured and no `getBoundingClientRect` anywhere. It is the same number `flight()` uses in the motion build, applied as a CSS percentage instead of a tween destination.

Sizing: the motion build lands the photo at `PHOTO_SHRINK = 0.05` of a stage-height square. Rather than reproduce that arithmetic, give the marker a plain responsive size in the 40–64px range and `borderRadius: PHOTO_RADIUS` (which fully rounds it, matching the motion build's final pose). A ring (`ring-2 ring-white` or similar) is worth considering so the marker reads as a pin against the dots rather than as a speck of the map.

This instance is decorative — `alt=""` and `aria-hidden` — because panel 2 already announced the photograph as "Ray", and a screen reader meeting it twice would be describing one subject as two.

Caption: "From New York City" in flow beneath the map, in the same type and the same `text-neutral-600` / `text-black font-aeonik-medium` split the motion build uses. In flow, so the layout itself guarantees the Work section starts after it — no `PLACE_BOTTOM`, no `fitStageToLabel`, nothing to measure.

The map keeps `aria-hidden` on the dots themselves, as it does today.

### 6.5 Layout and rhythm

Each panel is its own block in normal flow, sized to about one viewport (`min-h-dvh` with the content centred) so the reading rhythm matches the motion build's one-beat-per-hold pacing. The existing `min-h-dvh flex flex-col` wrapper in `page.tsx` holds `Header` + panel 1; panels 2 and 3 follow as ordinary siblings.

No pin, no spacer, no negative offsets, no margin reservation, no `ScrollTrigger` of any kind in this build. The page is exactly as long as its content, which is the one thing a static build should be able to promise.

### 6.6 What is deliberately not carried over

These are motion, not content, and have no static equivalent worth inventing:

- The pin and its `400%` / `150%` hold.
- The `SplitText` glyph waves, the label exit tweens, the dolly, the focus pull (`PHOTO_BLUR`), the mask wipe, the drawing's lift-away, the map's grow-in, and the tilt spring.
- The `--tilt-strength` fader and the `will-change` promotion triggers — nothing here animates, so nothing needs promoting.

### 6.7 Keep from the first implementation

Unchanged by this revision: `usePrefersReducedMotion()`, `Header.tsx`'s `motion-reduce:hidden` on the tilt invitation (finding 3), and `PageLoader.tsx`'s `motion-reduce:animate-none` + neutral ring (finding 4).

### 6.8 Explicitly out of scope

- `Work.tsx`, `WorkDescriptions.tsx`, `useTilt.ts` — already correct under the preference.
- Micro-transitions in finding 5 — leave as-is.

## 7. Suggested verification checklist (for when this is implemented)

- macOS: System Settings → Accessibility → Display → Reduce motion.
- iOS: Settings → Accessibility → Motion → Reduce Motion.
- Android: Settings → Accessibility → Remove animations (varies by OEM/version).
- Chrome DevTools: Rendering tab → "Emulate CSS media feature prefers-reduced-motion: reduce" (fastest loop, no device needed).
- With the preference on, scroll top to bottom and confirm: **all three graphics are present and permanently visible** — illustration, photograph, and map with the headshot sitting on New York; all three captions are present; nothing is fixed to the viewport past the point it should have scrolled away; no caption overlaps another section; the tilt invitation is not shown; the loader ring does not spin.
- Toggle the preference live with the page open to confirm the switch mounts the other build cleanly in both directions.

## 8. Summary table

| #   | Finding                                                                          | Component                                        | Severity      | Status                    |
| --- | -------------------------------------------------------------------------------- | ------------------------------------------------ | ------------- | ------------------------- |
| 1   | Corner labels are `fixed` to the viewport and never hidden under reduce-motion   | `HeroHeadshot.tsx`                               | Critical      | Fixed; keep               |
| 2   | "From New York City" assumes the (nonexistent) pin, overlapping the next section | `HeroHeadshot.tsx`                               | Critical      | Fixed; refined by §6.4    |
| 3   | Helper copy invites mouse/tilt interaction that `useTilt` has disabled           | `Header.tsx`                                     | Medium        | Fixed; keep               |
| 4   | Loading spinner ignores `prefers-reduced-motion`                                 | `PageLoader.tsx`                                 | Low           | Fixed; keep               |
| 5   | Small CSS transitions (dots, hover states) are unconditional                     | `Work.tsx`                                       | Judgment call | No action                 |
| 6   | Fallback withholds the illustration and the map; ships one of three beats        | `HeroHeadshot.tsx`                               | Critical      | **Open — §6 is the plan** |
| —   | Static fallback already correct                                                  | `Work.tsx`, `WorkDescriptions.tsx`, `useTilt.ts` | N/A           | No action                 |
