"use client";

import Image from "next/image";
import headshotPhoto from "../../../public/headshot.png";
import kawaiiHeadshotBackground from "../../../public/kawaii_headshot_background.svg";
import kawaiiHeadshotForeground from "../../../public/kawaii_headshot_foreground.svg";
import {
  FOREGROUND_DEPTH,
  FOREGROUND_SCALE,
  FOREGROUND_SHADOW_COMPACT,
  MAP_ASPECT,
  MAP_FADE_START,
  MAP_WIDTH,
  PHOTO_BOX,
  PHOTO_RADIUS,
  type MapData,
} from "./hero-shared";

/**
 * How wide the two square panels are: as wide as the column allows, but never
 * so tall that the illustration and the header cannot share the first screen.
 *
 * A round number rather than a measurement, and it can afford to be. In the
 * animated build the stage's height is load-bearing — the pin measures against
 * it, the flight to New York is a pixel distance across it, the place caption
 * hangs off it by a formula — so it is derived from the header's actual
 * leftovers with `flex-1`. Here nothing is measured against anything, so the
 * only question the number has to answer is whether the picture looks placed.
 *
 * Which is why it is not larger. The two captions share panel two with the
 * photograph now that they are in ordinary flow rather than pinned to the
 * viewport's corners, so that square has a line of display type above it and
 * another below to leave room for. At much more than this the picture pushes
 * both off the screen it is supposed to share with them. The drawing is held
 * to the same number even though its own panel has no captions in it — see
 * below.
 *
 * The same width for both squares on purpose: the drawing and the photograph
 * are the same head, and the animated build cross-fades one into the other at
 * exactly the same size. Two panels that sized themselves independently would
 * make the second beat read as a different picture rather than the same one.
 * The photograph then sits in from that box by PHOTO_INSET, which is about the
 * margin the drawing already has built into its artwork.
 */
const PANEL_SIZE = "min(100%, 56dvh)";

/** How tall the map's panel is — the box MAP_WIDTH sizes the frame against. */
const MAP_PANEL_HEIGHT = "72dvh";

/** The type every caption is set in, shared so the three cannot drift. */
const CAPTION =
  "font-aeonik-regular uppercase tracking-tight " +
  "text-6xl md:text-7xl lg:text-8xl 2xl:text-9xl";

/**
 * The hero for visitors who have asked for less motion.
 *
 * The animated build is three still frames joined by a scrub — the drawing,
 * the photograph, and the map with the headshot standing on New York. Take the
 * scrub away and the three frames are all still there, and all still worth
 * looking at. So this renders them as three panels down the page, in the same
 * order, at the same size, with the same captions, and lets the visitor's own
 * scrolling do what the scrub used to.
 *
 * The point is that nothing is withheld. `prefers-reduced-motion` is a request
 * about movement, not about content, and an earlier fallback that answered it
 * by fading the illustration away and never lifting the map's `opacity: 0`
 * shipped one of the three beats (REDUCED-MOTION-AUDIT.md, finding 6). Every
 * graphic the timeline passes through is here, permanently.
 *
 * What is not here is anything that moves: no GSAP, no ScrollTrigger, no
 * SplitText, no pin, no portal, no tilt, and no refs or measurement of any
 * kind. The page is exactly as long as its content, which is the one thing a
 * static build should be able to promise.
 *
 * `mapData` is nullable for the same reason it is in the animated build: the
 * geometry is dynamic-imported a beat after mount, and the first two panels
 * have nothing to do with it, so the page paints them rather than waiting.
 */
export default function HeroStatic({
  mapData,
}: {
  mapData: MapData | null;
}) {
  return (
    <>
      {/* Panel 1 — the drawing, on its own.
          The two captions belong to the photograph now (see panel 2), so this
          panel is only the illustration, centred in whatever height the
          header's column has left.

          `basis-auto` rather than the animated build's `flex-1`: this is a
          flex item of the header's `min-h-dvh` column, and so are the two
          panels after it. With three items summing past a viewport the column
          has no free space to distribute, so a zero basis would resolve to a
          zero height and collapse the illustration entirely. An automatic
          basis sizes the panel to what is inside it, which is what it should
          have been all along now that nothing depends on it filling a measured
          gap. */}
      <section className="grow basis-auto flex flex-col justify-center p-6 md:p-10">
        {/* The perspective wrapper stays, and so does the depth pair inside
            it. Neither is an animation: they are the pose that registers the
            eyes and mouth to the head at the right size, and a build that
            dropped them would draw the features visibly too large and
            slightly off the face. See FOREGROUND_SCALE. */}
        <div
          className="relative self-center aspect-square perspective-distant"
          style={{ width: PANEL_SIZE }}
        >
          <div className="relative size-full transform-3d">
            <Image
              src={kawaiiHeadshotBackground}
              alt=""
              aria-hidden
              loading="eager"
              fill
              sizes="100vh"
              className="block pointer-events-none object-contain"
              style={{ transform: "translateZ(0px)" }}
            />
            {/* The frozen shadow unconditionally here. `useTilt` never runs
                under the preference, so `--tilt-x` / `--tilt-y` are never
                written and the leaning form would resolve against its own `0`
                fallbacks to exactly this — stating it outright says so, and
                spares the browser a filter that reads variables nothing
                sets. */}
            <Image
              src={kawaiiHeadshotForeground}
              alt=""
              aria-hidden
              loading="eager"
              fill
              sizes="100vh"
              className="block pointer-events-none object-contain"
              style={{
                transform: `translateZ(${FOREGROUND_DEPTH}px) scale(${FOREGROUND_SCALE})`,
                filter: FOREGROUND_SHADOW_COMPACT,
              }}
            />
          </div>
        </div>
      </section>

      {/* Panel 2 — the photograph, with the two captions stacked around it.
          The beat the old fallback delivered, and the only one it did. Full
          size, sharp, fully opaque, and square: the animated build ends this
          beat square and only rounds the corners later, on its way to becoming
          a marker.

          A column in ordinary flow: the role above the picture, the craft
          below and set to the right. That keeps the animated build's reading
          order and its diagonal — top-left down to bottom-right — without
          taking a single element out of flow to get it. They caption the
          photograph rather than the drawing, which is the one panel where the
          person the captions describe is actually visible.

          Nothing here is positioned, and that is the point. The corners those
          two captions used to sit in belong to the animated build, where they
          are `fixed` to the viewport and the timeline is what eventually takes
          them away. Copying the geometry into a build with no timeline was how
          they ended up glued over the page in the first place
          (REDUCED-MOTION-AUDIT.md, finding 1); copying it as `absolute` inside
          the panel fixed that but left them overlapping the picture they are
          supposed to caption. In flow they simply take their own space.

          No mask and no `--photo-reveal`. The property is dropped rather than
          parked at 1 — a wipe held wide open is a no-op that still costs the
          browser a rasterisation of the whole panel, and there is no timeline
          here that could ever want the number back. */}
      <section className="min-h-dvh flex flex-col justify-center gap-4 md:gap-6 p-6 md:p-10">
        <p className={CAPTION}>Software Engineer</p>
        <div
          className="relative self-center aspect-square"
          style={{ width: PANEL_SIZE }}
        >
          {/* The one instance that carries the real alt text — the marker on
              the map is the same subject and is marked decorative, so a screen
              reader meets Ray once. */}
          <Image
            src={headshotPhoto}
            alt="Ray"
            priority
            sizes="100vh"
            className="block pointer-events-none object-contain"
            // Held in from the frame's edges and rounded, the same box the
            // animated build gives it — and, like that one, positioned by
            // PHOTO_BOX rather than by `fill`, whose fixed `width: 100%`
            // cannot be overridden. See PHOTO_BOX.
            style={PHOTO_BOX}
          />
        </div>
        <p className={`text-right ${CAPTION}`}>Who Designs</p>
      </section>

      {/* Panel 3 — the map, with the headshot standing on New York.
          The beat the old fallback dropped completely: `mapRef` carries an
          inline `opacity: 0` that only the animated timeline ever lifts, so a
          reduce-motion visitor's map was transparent forever, and with it the
          entire point of the sequence — Ray being *from* somewhere. */}
      <section className="min-h-dvh flex flex-col items-center justify-center">
        {/* The size container MAP_WIDTH measures itself against. It needs a
            definite height for `cqh` to mean anything, which the animated
            build gets from the pinned stage and this one has to state. */}
        <div
          className="relative w-full flex items-center justify-center"
          style={{ containerType: "size", height: MAP_PANEL_HEIGHT }}
        >
          {/* Held to exactly 2:1, like the animated build's frame, because
              that is what makes New York a fixed fraction of the box — see
              MAP_ASPECT. Here the fraction is used as a CSS percentage rather
              than as a tween destination, so the marker is correct at every
              viewport with nothing measured. */}
          <div
            className="relative"
            style={{ width: MAP_WIDTH, aspectRatio: MAP_ASPECT }}
          >
            {mapData && (
              <>
                {/* Decorative: a screen reader has no use for five thousand dots,
                    and the caption below says what the map is for. */}
                <svg
                  aria-hidden
                  viewBox={`0 0 ${mapData.width} ${mapData.height}`}
                  className="size-full text-neutral-400"
                >
                  <defs>
                    {/* Default cx/cy/r in objectBoundingBox units, so the falloff
                        is an ellipse fitted to the map's 2:1 box rather than a
                        circle — the fade stays the same depth on all four
                        sides. */}
                    <radialGradient id="hero-static-map-fade">
                      <stop
                        offset={MAP_FADE_START}
                        stopColor="#fff"
                        stopOpacity={1}
                      />
                      <stop offset={1} stopColor="#fff" stopOpacity={0} />
                    </radialGradient>
                    {/* userSpaceOnUse so the mask covers the whole viewBox; left
                        to default it would size off the dots' own bounding box. */}
                    <mask
                      id="hero-static-map-mask"
                      maskUnits="userSpaceOnUse"
                      x={0}
                      y={0}
                      width={mapData.width}
                      height={mapData.height}
                    >
                      <rect
                        x={0}
                        y={0}
                        width={mapData.width}
                        height={mapData.height}
                        fill="url(#hero-static-map-fade)"
                      />
                    </mask>
                  </defs>
                  <path
                    d={mapData.path}
                    fill="currentColor"
                    mask="url(#hero-static-map-mask)"
                  />
                </svg>
                {/* Where the animated build's photograph lands after its flight,
                    arrived at without the flight. `mapData.marker` ships as a
                    fraction of the 2:1 frame, precomputed at build time alongside
                    the dots, so this is the same number `flight()` aims at —
                    applied as a percentage of the frame instead of as a pixel
                    distance across it. Nothing is measured and nothing has to be
                    re-measured on a resize.

                    The ring is not decoration: at this size the marker is a few
                    dozen pixels over a field of dots, and without a hard edge
                    against the page's white it reads as a smudge on the map
                    rather than as a pin standing on it.

                    `alt=""` because panel 2 has already introduced the
                    photograph — the same face announced twice would describe one
                    person as two. */}
                <div
                  className="absolute size-10 md:size-14 overflow-hidden ring-2 ring-white"
                  style={{
                    left: `${mapData.marker.x * 100}%`,
                    top: `${mapData.marker.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                    borderRadius: PHOTO_RADIUS,
                  }}
                >
                  <Image
                    src={headshotPhoto}
                    alt=""
                    aria-hidden
                    fill
                    sizes="56px"
                    className="block pointer-events-none object-cover"
                  />
                </div>
              </>
            )}
          </div>
        </div>
        {/* The caption, in ordinary flow beneath the map rather than hung off
            the stage's bottom edge by PLACE_BOTTOM. That formula describes a
            pinned, centred stage, and the space under it was reserved by a
            refresh handler only the animated build installs — with neither,
            the caption used to hang down into the section below
            (REDUCED-MOTION-AUDIT.md, finding 2). In flow, the layout itself
            guarantees what that handler had to measure for: whatever comes
            after the hero starts after this. */}
        <p className={`self-start p-6 md:p-10 ${CAPTION} text-neutral-600`}>
          From <span className="text-black font-aeonik-medium">New York City</span>
        </p>
      </section>
    </>
  );
}
