"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMediaQuery } from "../_hooks/useMediaQuery";
import WorkDescriptions from "./WorkDescriptions";

gsap.registerPlugin(useGSAP, ScrollTrigger);

// A mobile address bar sliding away is a viewport resize, and a resize is a
// full ScrollTrigger refresh — which re-measures every trigger against a
// viewport that is only briefly that size. Everything on this page is sized
// in `dvh` and absorbs the change on its own; this stops the refresh storm.
ScrollTrigger.config({ ignoreMobileResize: true });

/**
 * Which visitors get the cheaper build of the carousel — the same query, for
 * the same reasons, as the hero's COMPACT: `max-width` catches the phone,
 * `pointer: coarse` catches the tablet that reports a desktop viewport while
 * carrying a phone's GPU. Under it the cards keep the whole transform arc —
 * rotation, recession, scale, dimming — and drop only the layers a phone
 * cannot composite: the blur, the radial dissolve mask, the dust and the
 * grain. See PERFORMANCE-AUDIT.md §5, fix 1.3.
 */
const COMPACT = "(max-width: 1023px), (pointer: coarse)";

/**
 * How long the background takes to settle into its new colour once the
 * section crosses the trigger point.
 *
 * This is a plain eased tween, not a `scrub` — the trigger only reports a
 * boolean (past the line or not), so the fade always runs this same duration
 * regardless of how fast or slow the scroll gesture that crossed the line
 * was. Scrubbing would tie the fade's progress to scroll position instead,
 * which is the coupling this is deliberately avoiding.
 */
const FADE_DURATION = 0.6;

const BLACK = "#000000";
const WHITE = "#FFFFFF";

/**
 * The projects on display. Image paths are matched to the files in `public/`
 * exactly, case included — the local filesystem is case-insensitive but the
 * deploy target is not, so a casing slip here is a 404 that only ever shows
 * up in production.
 */
const PROJECTS = [
  {
    title: "Unlevered",
    image: "/Unlevered.png",
    description:
      "Unlevered is an AI platform designed to streamline your investment due diligence process. It utilizes an in-house LLM to simplify complex SEC filings, allowing users to break down financial jargon into digestible bullet points, detect subtle language changes in filings year-over-year, and efficiently search for specific keywords across all filings. Additionally, it provides automated alerts for filings and keywords, customizable alerts for specific tickers, and access to decades of earnings call histories with AI-powered summaries.",
  },
  {
    title: "Blitz",
    image: "/blitz.jpg",
    description: "Placeholder description for Blitz.",
  },
  {
    title: "Syllabus to Calendar",
    image: "/SyllabusToCalendar.png",
    description: "Placeholder description for Syllabus to Calendar.",
  },
] as const;

/** Whichever card the carousel opens on — the middle of however many there are. */
const START_INDEX = Math.floor(PROJECTS.length / 2);

/**
 * The depth model: cover flow, so the viewer stands in *front* of the rank
 * rather than inside it. The centred card is nearest, largest, square to the
 * screen and fully lit; everything either side of it recedes — turning away,
 * travelling back along `z`, shrinking, dimming, desaturating and softening.
 *
 * This is the inverse of the arrangement that used to be here, where the
 * centre sat at the back of a cylinder and the flanks rode *forward* and grew.
 * That version had no depth cue pointing the right way: the cards the eye was
 * meant to read as further away were the biggest and closest things on screen,
 * so the only thing separating them from the centre was a hard 70° rotation.
 * Rotation alone is a weak depth cue and a harsh one — hence the flat, cut-out
 * look. Every channel below now moves the same way at once, which is what
 * actually reads as distance.
 *
 * The sign convention worth pinning down: `rotateY` is positive when an
 * element's right edge swings *away*. A card to the right of centre (positive
 * delta) should turn its left edge toward the viewer and its right edge away,
 * which is a positive rotation — so unlike the old inward-facing arrangement,
 * the sign here is *not* negated.
 */
const MAX_ROTATE_DEG = 42;
/**
 * How far back the flanks travel, in px. Negative `z` — away from the camera —
 * so perspective shrinks them on its own, before `SCALE_PER_CARD` is applied.
 */
const MAX_RECESS_Z = 300;
/**
 * What fraction of its size a card keeps per whole card-step away from centre
 * — so scale is `SCALE_PER_CARD ^ distance`, on top of whatever shrink
 * receding along `z` already wins through perspective.
 *
 * Geometric for the same reason the brightness is, and it matters more here than
 * anywhere else because scale is the only channel that shrinks a card
 * *vertically*. `rotateY` foreshortens width — dramatically, since `cos 29°`
 * and `cos 38°` are quite different — so a rank driven mostly by rotation
 * looks like it is receding when measured across but holds almost the same
 * height throughout, which reads as cards turning in place rather than moving
 * away. The old linear drop off the saturating depth curve took only 6% of
 * height off between the first neighbour and the card behind it, and 2% for
 * the one after that. Compounding gives every step the same honest ratio.
 */
const SCALE_PER_CARD = 0.84;
/**
 * How fast depth accumulates with distance from centre, in card pitches.
 *
 * The curve is `1 - e^(-distance / FALLOFF)`, which is continuous and never
 * actually reaches 1 — deliberately, because "continuous depth scaling" is the
 * point. The previous model clamped distance at one pitch, so every card one
 * pitch out or further collapsed onto an identical, fully saturated pose: a
 * card two pitches away looked exactly like its neighbour one pitch away, and
 * the rank read as two flat planes rather than a receding line. Here each
 * further card keeps getting a little smaller, dimmer and further back.
 */
const DEPTH_FALLOFF = 0.85;
/**
 * How much further than one pitch from centre a card may ever *appear*, in
 * pitches, however far out it actually is.
 *
 * Layout spacing is fixed: every card sits exactly one pitch from the next,
 * measured on its untransformed width, and nothing the arc does to the face
 * changes that. So on the first or last card the one at the far end sits a
 * full two pitches out — the better part of a screen away — and simply leaves,
 * which is the opposite of the receding-into-the-distance reading the depth
 * curve is going for. Distance should compress as things recede, not stay
 * linear.
 *
 * Only the part *past* the first neighbour is compressed, and it is
 * compressed onto an asymptote: no card ever appears further than
 * `1 + SPREAD_TAIL` pitches out, so the rank always ends in a bunched stack
 * near the flanks rather than a line marching off screen. Leaving the first
 * pitch alone means the resting three-card composition is untouched — this
 * changes only what happens at the ends.
 *
 * The join at one pitch is smooth in both value and slope: the tail's
 * derivative there is `SPREAD_TAIL * (1 / SPREAD_TAIL) = 1`, matching the
 * linear part it continues from, so nothing kinks as a card crosses it.
 */
const SPREAD_TAIL = 0.55;
/**
 * What fraction of its brightness a card keeps per whole card-step away from
 * centre — so brightness is `BRIGHTNESS_PER_CARD ^ distance`.
 *
 * Brightness rather than opacity: fading a card out makes it *transparent*, so
 * whatever sits behind it — the next card in the rank, the black ground —
 * shows through and mixes into it, which reads as a ghost rather than as an
 * object in shadow. Dimming keeps the card opaque and simply lights it less,
 * which is what actually happens to something further from the light, and it
 * keeps an overlap reading as one solid card in front of another.
 *
 * Geometric rather than a linear drop off the saturating depth curve, because
 * that curve has spent most of its range by the first neighbour: it put the
 * neighbour at 0.62 and the card *behind it* at 0.50, a gap far too small to
 * read as one being further away than the other, especially where the two
 * overlap. Compounding per step keeps every card distinctly darker than the
 * one in front of it however deep the rank goes — 0.60, then 0.36, then 0.22.
 */
const BRIGHTNESS_PER_CARD = 0.6;
/** How out-of-focus a receding card gets — a soft focal falloff, not a smear. */
const MAX_BLUR_PX = 3.5;
/**
 * Atmospheric perspective: distant things lose contrast and colour toward the
 * background rather than staying vivid. Dimming and desaturating together is
 * most of what makes the recession read as *lighting* rather than as a filter
 * — and on a black ground, dimming is also what stops a light-toned card from
 * punching a bright hole in the composition.
 */
const MAX_DIM = 0.45;
const MAX_DESATURATE = 0.5;
/**
 * How visible the grain texture gets at depth. Very low now: it exists to keep
 * a receding card from looking like clean flat colour, not to be a texture in
 * its own right. At the near-opaque value it used to carry, the grey
 * `hard-light` wash was a high-contrast layer of its own that fought both the
 * image under it and the black behind it.
 */
const MAX_GRAIN_OPACITY = 0.12;
/** How strong the dust ever gets. An accent at the dissolving edge, no more. */
const MAX_DUST_OPACITY = 0.32;
/**
 * `--depth` is quantised to this step before being written.
 *
 * Every distinct value re-rasterises the radial masks on the card, which is
 * real work the compositor cannot skip. The eye cannot resolve a finer step
 * than this on a fade, so rounding to it drops the great majority of those
 * re-rasterisations for no visible cost.
 */
const DEPTH_STEP = 0.02;
/**
 * Focal length of the projection, in px.
 *
 * Lives on each card rather than once on the scroller, and that is what makes
 * the rank stack in the right order — see `BASE_Z_INDEX`. `perspective` on an
 * ancestor would put every card and face into one shared 3D rendering context;
 * on the card itself it applies to that card's own contents only, so the cards
 * remain plain 2D siblings of each other.
 *
 * A per-card perspective would normally *change* the picture, not just its
 * painting order: the vanishing point would move to each card's own centre, so
 * every flank would be projected head-on and the asymmetry that makes a card
 * look like it is turning toward the viewer would vanish. `perspectiveOrigin`
 * is therefore re-aimed at the scroller's centre every frame, which reproduces
 * the shared projection exactly — same focal length, same vanishing point.
 */
const PERSPECTIVE = 1400;
/**
 * The stacking order the centred card gets; every other card sits below it by
 * however far out it is.
 *
 * Explicit rather than left to the browser's 3D depth sorting, because depth
 * sorting cannot do this job. Inside a 3D rendering context painting order
 * comes from sorted `z` and `z-index` does not order siblings at all; but the
 * faces are not sortable either, because each one carries a grouping property
 * — `opacity < 1` before, `filter` now — which flattens it into a group that
 * composites in document order. The result was the last card in the DOM
 * painting over both others whatever its transform said: correct-looking to
 * the right of centre, backwards to the left of it.
 *
 * Moving `perspective` onto the cards (see `PERSPECTIVE`) dissolves the shared
 * 3D context, which turns this back into an ordinary 2D stacking question that
 * `z-index` answers reliably — with the ordering driven by the same distance
 * the rest of the arc is derived from, so it cannot disagree with the poses.
 *
 * Written on the untransformed snap box rather than the face: `z-index` only
 * orders an element against its siblings, and the faces are each an only
 * child, so a value there would order nothing at all.
 */
const BASE_Z_INDEX = 1000;
/** Edge length of the dust tile, in px. Larger tiles read as coarser flecks. */
const DUST_TILE = 280;

/**
 * The particle stencil.
 *
 * Softened from the hard-edged version: a `linear` alpha transfer with a
 * modest slope instead of a `discrete` one, so grains have falloff at their
 * edges and the field reads as suspended dust rather than as a dither pattern
 * stamped over the image. The old stark stencil was legible as *noise* — a
 * texture with its own contrast, competing with the photograph and with the
 * background instead of belonging to either.
 */
const DUST_MASK = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='280' height='280'>" +
    "<filter id='d'>" +
    "<feTurbulence type='fractalNoise' baseFrequency='0.5' numOctaves='3' seed='11' stitchTiles='stitch'/>" +
    "<feColorMatrix type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 -0.32'/>" +
    "<feComponentTransfer><feFuncA type='linear' slope='2.4' intercept='0'/></feComponentTransfer>" +
    "</filter>" +
    "<rect width='100%' height='100%' filter='url(#d)'/>" +
    "</svg>",
)}")`;

/** How far the card is into the depth curve, 0–1. Set per card on the face. */
const DEPTH = "var(--depth, 0)";
/**
 * Where the card's surviving core sits, horizontally.
 *
 * Pushed toward the *inner* edge — the side facing the centre — so the radial
 * falloff eats the outward-facing half hardest. That keeps the vignette from
 * reading as a symmetrical spotlight pasted on every card and instead makes
 * each flank appear to trail off in the direction it is receding.
 */
const FOCUS_X = "var(--focus-x, 50%)";

/**
 * The image's mask: a radial alpha falloff that closes in as depth rises.
 *
 * Radial rather than the linear wipe this replaces. A linear ramp leaves the
 * card's other three sides as hard, straight, full-contrast edges, so however
 * far the fade travelled the card still ended in a crisp rectangle — the
 * "abruptly cut off" reading. An ellipse has no sides to leave behind: it
 * takes the corners and the top and bottom in at the same time, and the card
 * dissolves into the background as a soft shape rather than a clipped one.
 *
 * At depth 0 the stops sit at 100%/135%, so the mask is a no-op and the
 * centred card is provably untouched.
 */
const IMAGE_MASK =
  `radial-gradient(ellipse 118% 128% at ${FOCUS_X} 50%,` +
  ` #000 calc(100% - ${DEPTH} * 58%),` +
  ` transparent calc(135% - ${DEPTH} * 50%))`;

/**
 * The dust layer's mask: the particle stencil intersected with a radial band
 * tracking just outside the image's own falloff.
 *
 * The band is why the stencil can be used at all. Intersecting noise with the
 * *image* would punch holes right across a centred card; windowing it to the
 * zone the image is currently dissolving through means the specks only ever
 * exist where there is a dissolve for them to belong to.
 */
const DUST_LAYER_MASK =
  `${DUST_MASK}, radial-gradient(ellipse 118% 128% at ${FOCUS_X} 50%,` +
  ` transparent calc(100% - ${DEPTH} * 58%),` +
  ` #000 calc(122% - ${DEPTH} * 52%), transparent 150%)`;

/**
 * The grain's mask: the same radial falloff, so the texture gathers where the
 * card is breaking up and stays off the part still meant to read as a
 * photograph.
 */
const GRAIN_MASK =
  `radial-gradient(ellipse 118% 128% at ${FOCUS_X} 50%,` +
  ` transparent calc(60% - ${DEPTH} * 40%), #000 110%)`;

/**
 * The fade at the scroller's own left and right edges.
 *
 * Without this the track is clipped by the scroller's box, so a card leaving
 * the viewport ends on a dead vertical line at the exact pixel the overflow
 * starts — the single most artificial edge in the composition, and one no
 * amount of per-card treatment can soften because it is not the card's edge
 * at all. Masking the container instead means cards leave by dissolving.
 *
 * On a wrapper rather than on the scroller itself: `mask-image` makes an
 * element a grouping element, and the thing being grouped here would be a
 * scrolling box whose contents change every frame. Kept one level out, the
 * mask is a static fade over a static rectangle.
 */
const EDGE_FADE =
  "linear-gradient(to right, transparent 0%, #000 14%," +
  " #000 86%, transparent 100%)";

/**
 * A small tile of fractal noise, reused as every card's grain texture rather
 * than generated per-card — it's a fixed pattern, not something that needs
 * to vary by card or by frame. Run through a steep `feComponentTransfer` so
 * the noise reads as stark black/white grain rather than the soft grey mush
 * raw `feTurbulence` output looks like at low opacity.
 */
const GRAIN_BACKGROUND = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'>" +
    "<filter id='n'>" +
    "<feTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='3' stitchTiles='stitch' result='noise'/>" +
    "<feComponentTransfer in='noise'>" +
    "<feFuncR type='linear' slope='4' intercept='-1.5'/>" +
    "<feFuncG type='linear' slope='4' intercept='-1.5'/>" +
    "<feFuncB type='linear' slope='4' intercept='-1.5'/>" +
    "</feComponentTransfer>" +
    "</filter>" +
    "<rect width='100%' height='100%' filter='url(#n)'/>" +
    "</svg>",
)}")`;

export default function Work() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  /**
   * The snap boxes. These are measured — `offsetLeft`/`offsetWidth` — and they
   * are what CSS scroll-snap aligns, so nothing may ever transform them.
   */
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  /**
   * The visible faces, one inside each card, and the only things the arc
   * transforms — see the note on `updateArc` for why the two are separate.
   */
  const faceRefs = useRef<(HTMLDivElement | null)[]>([]);
  const imgRefs = useRef<(HTMLImageElement | null)[]>([]);
  /** Per-card dust overlay — see `MAX_DUST_OPACITY`. */
  const dustRefs = useRef<(HTMLDivElement | null)[]>([]);
  /** Per-card grain overlay — see `MAX_GRAIN_OPACITY`. */
  const grainRefs = useRef<(HTMLDivElement | null)[]>([]);
  /** Last `--depth` written per card, so an unchanged value can be skipped. */
  const depthValues = useRef<number[]>([]);
  /** Last `z-index` written per card — same reason. */
  const zIndexValues = useRef<number[]>([]);
  /** Last `perspective-origin` x written per card, in whole px — same reason. */
  const originValues = useRef<number[]>([]);

  const prefersReducedMotion = useMediaQuery(
    "(prefers-reduced-motion: reduce)",
  );
  const compact = useMediaQuery(COMPACT);

  /**
   * Index into `PROJECTS` of whichever card currently sits nearest the
   * scroller's centre — drives the description copy, the dots, and which of
   * the arrows are disabled. Mirrored in a ref so the scroll handler can
   * compare against it without re-rendering; the `useState` only fires on the
   * frames where the centred card actually changes.
   */
  const centeredIndexRef = useRef(START_INDEX);
  const [centeredIndex, setCenteredIndex] = useState(START_INDEX);
  /**
   * Like `centeredIndex`, but only updated once the scroller has come to
   * rest — it feeds the `aria-live` region, which would otherwise announce
   * every project the carousel merely passes on its way somewhere else.
   */
  const [settledIndex, setSettledIndex] = useState(START_INDEX);
  /**
   * `compact` reads `false` during hydration — the server has no viewport —
   * so gating the dust and grain on it alone would still put their markup,
   * and the image fetch the dust layer's `background-image` starts, into a
   * phone's first paint. They wait for this instead: the first client render
   * matches the server's (no overlays), and the commit after it mounts them
   * only where `compact` is genuinely false.
   */
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  /**
   * The card the carousel has most recently been *told* to go to, which is
   * not the same thing as the one currently centred.
   *
   * Stepping has to count from here rather than from `centeredIndex`. A
   * smooth scroll takes a few hundred milliseconds to arrive, and
   * `centeredIndex` only catches up as the scroller physically passes each
   * card — so two quick presses of "next" both read the same not-yet-changed
   * `centeredIndex`, compute the same destination, and the second press does
   * nothing. Counting from the last commanded index makes presses queue up
   * the way a visitor expects, however fast they arrive.
   */
  const targetIndexRef = useRef(START_INDEX);

  /**
   * Where `scrollLeft` has to be for card `index` to sit dead centre.
   *
   * `offsetLeft` is measured against the track, which sits flush at the
   * scroller's content origin, so it is already in the same coordinate space
   * as `scrollLeft`. The track's own horizontal padding is what lets the
   * first and last cards reach the centre at all.
   */
  const scrollLeftForIndex = useCallback((index: number) => {
    const scroller = scrollerRef.current;
    const card = cardRefs.current[index];
    if (!scroller || !card) return 0;

    return card.offsetLeft + card.offsetWidth / 2 - scroller.clientWidth / 2;
  }, []);

  /**
   * Moves the carousel so `index` is centred.
   *
   * This is the *only* thing in the component that ever writes a scroll
   * position, and it hands the work to the browser's own smooth scroll rather
   * than easing `scrollLeft` by hand on a ticker. That matters: a per-frame
   * loop writing `scrollLeft` toward a target of its own has no idea a finger
   * or a trackpad is also moving the scroller, so it drags every such gesture
   * back toward a stale target. Letting the platform own the scroll position
   * means touch, trackpad, scrollbar, and these buttons all compose instead
   * of competing.
   */
  const scrollToIndex = useCallback(
    (index: number) => {
      const scroller = scrollerRef.current;
      if (!scroller) return;

      const clamped = Math.max(0, Math.min(index, PROJECTS.length - 1));
      targetIndexRef.current = clamped;
      scroller.scrollTo({
        left: scrollLeftForIndex(clamped),
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
    },
    [prefersReducedMotion, scrollLeftForIndex],
  );

  /** Moves `delta` cards from the last commanded card — see `targetIndexRef`. */
  const stepBy = useCallback(
    (delta: number) => scrollToIndex(targetIndexRef.current + delta),
    [scrollToIndex],
  );

  useGSAP(
    () => {
      const media = gsap.matchMedia();

      media.add("(prefers-reduced-motion: no-preference)", () => {
        const toBlack = () =>
          gsap.to(sectionRef.current, {
            backgroundColor: BLACK,
            duration: FADE_DURATION,
            ease: "power2.out",
          });

        const toWhite = () =>
          gsap.to(sectionRef.current, {
            backgroundColor: WHITE,
            duration: FADE_DURATION,
            ease: "power2.out",
          });

        // No `scrub` here: the trigger fires once each time the section's top
        // crosses the middle of the viewport, in either direction, and the
        // fade above plays out on its own clock from there — scrolling
        // further, stopping, or reversing mid-fade never rewinds or resumes
        // it partway.
        const trigger = ScrollTrigger.create({
          trigger: sectionRef.current,
          start: "top center",
          onEnter: toBlack,
          onLeaveBack: toWhite,
        });

        return () => trigger.kill();
      });

      media.add("(prefers-reduced-motion: reduce)", () => {
        // No animated fade, but the state change still has to land somewhere
        // — a hard cut at the same line the eased version fades across.
        gsap.set(sectionRef.current, { backgroundColor: WHITE });

        const trigger = ScrollTrigger.create({
          trigger: sectionRef.current,
          start: "top center",
          onEnter: () =>
            gsap.set(sectionRef.current, { backgroundColor: BLACK }),
          onLeaveBack: () =>
            gsap.set(sectionRef.current, { backgroundColor: WHITE }),
        });

        return () => trigger.kill();
      });

      return () => media.revert();
    },
    { scope: sectionRef },
  );

  useGSAP(
    () => {
      const scroller = scrollerRef.current;
      const track = trackRef.current;
      if (!scroller || !track) return;

      /**
       * The carousel's geometry — card centres, half-widths, pitch, and the
       * scroller's own centre — measured once here and again on real resizes,
       * never per frame. `updateArc` used to read `offsetLeft`/`offsetWidth`
       * off every card inside its loop, and every such read after a style
       * write forces a synchronous layout flush: three forced reflows per
       * scrolled frame (PERFORMANCE-AUDIT.md, P0-3b). None of these numbers
       * can change between resizes, so the frame loop now does arithmetic
       * against this table and reads only `scrollLeft`.
       */
      const metrics = {
        scrollerCenter: 0,
        pitch: 1,
        /** Each card's centre x in the scroller's content space. */
        centers: [] as number[],
        /** Each card's half-width, for aiming `perspectiveOrigin`. */
        halfWidths: [] as number[],
      };

      const measure = () => {
        metrics.scrollerCenter = scroller.clientWidth / 2;
        metrics.centers = cardRefs.current.map((card) =>
          card ? card.offsetLeft + card.offsetWidth / 2 : 0,
        );
        metrics.halfWidths = cardRefs.current.map((card) =>
          card ? card.offsetWidth / 2 : 0,
        );
        metrics.pitch =
          metrics.centers.length > 1
            ? metrics.centers[1] - metrics.centers[0] || 1
            : (metrics.halfWidths[0] ?? 0.5) * 2 || 1;
      };

      /**
       * Lays every card onto the arc based on how far its centre sits from
       * the scroller's centre, in card pitches — so 0 is dead centre and ±1
       * is one whole card away.
       *
       * The centre card lands at rotate 0 / z 0 / full brightness: nearest the
       * viewer, square to the screen and fully lit. Everything either side of
       * it turns away, travels back, shrinks, dims and softens together, by an
       * amount that keeps growing with distance rather than saturating.
       *
       * The transform goes on the card's inner *face*, never on the card
       * itself, and that split is load-bearing rather than cosmetic. CSS
       * scroll-snap derives a snap target's snap area from its **transformed**
       * border box, so transforming the element that carries `snap-center`
       * moves the snap point along with it: at full sweep a flank's box is
       * displaced sideways by more than half a card and swells by a quarter
       * of its width. Under `snap-mandatory` the browser then pulls every
       * scroll — including the exact, correct position the arrows and dots
       * scroll to — onto that displaced point, landing between two projects.
       * Worse, it is a feedback loop: scrolling changes the transforms, which
       * moves the snap points, which changes where the scroll lands.
       *
       * Keeping the snap box untransformed means the browser snaps to the
       * same layout geometry `scrollLeftForIndex` measures, and the arc is
       * free to throw the face around inside it without consequence.
       */
      const updateArc = () => {
        if (prefersReducedMotion) return;

        const { scrollerCenter, pitch } = metrics;
        // The one layout read the frame is allowed — everything else comes
        // from the metrics table.
        const scrollLeft = scroller.scrollLeft;

        cardRefs.current.forEach((card, index) => {
          if (!card) return;

          const cardCenter = metrics.centers[index] - scrollLeft;
          const delta = (cardCenter - scrollerCenter) / pitch;
          const sign = Math.sign(delta);
          // Unclamped, so a card three pitches out is still measurably
          // further away than one two pitches out — see `DEPTH_FALLOFF`.
          const distance = Math.abs(delta);
          const depth = 1 - Math.exp(-distance / DEPTH_FALLOFF);

          // How far out the card should *look*, which past the first
          // neighbour is nearer than where it actually sits — see
          // `SPREAD_TAIL`.
          const visualDistance =
            distance <= 1
              ? distance
              : 1 + SPREAD_TAIL * (1 - Math.exp(-(distance - 1) / SPREAD_TAIL));

          // Nearest the centre paints highest — see `BASE_Z_INDEX`. Scaled by
          // 100 so cards a fraction of a pitch apart still separate, and
          // written only on change since a bare restack is otherwise free.
          const zIndex = BASE_Z_INDEX - Math.round(distance * 100);
          if (zIndex !== zIndexValues.current[index]) {
            zIndexValues.current[index] = zIndex;
            card.style.zIndex = String(zIndex);
          }

          // Aims this card's own vanishing point at the scroller's centre, so
          // a perspective per card projects exactly as one shared perspective
          // on the scroller did — see `PERSPECTIVE`. `perspectiveOrigin` is
          // resolved against the card's own border box, so the scroller centre
          // has to be expressed in the card's coordinates, which is its own
          // half-width less however far the card sits from that centre.
          // Rounded to the pixel: a sub-pixel change moves nothing visible but
          // does re-project the card's whole subtree.
          const originX = Math.round(
            metrics.halfWidths[index] - (cardCenter - scrollerCenter),
          );
          if (originX !== originValues.current[index]) {
            originValues.current[index] = originX;
            card.style.perspectiveOrigin = `${originX}px 50%`;
          }

          const face = faceRefs.current[index];
          if (face) {
            gsap.set(face, {
              // Pulls the card back toward centre by whatever the compression
              // above took off. Layout spacing is fixed at one pitch per card
              // whatever the card is doing visually, so without this a card
              // two pitches out sits a literal two pitches out — full width
              // of untransformed spacing — however small it has been drawn.
              x: sign * (visualDistance - distance) * pitch,
              // Not negated: a card to the right of centre turns its right
              // edge away from the viewer, which is a positive rotation.
              rotateY: sign * depth * MAX_ROTATE_DEG,
              z: -depth * MAX_RECESS_Z,
              // Uniform, so height falls away with width — see
              // `SCALE_PER_CARD`.
              scale: Math.pow(SCALE_PER_CARD, distance),
              // The compact build dims by fading the whole face instead of a
              // `brightness()` filter: opacity is applied on the compositor,
              // a filter re-rasterises the subtree. It also stands in for
              // the radial dissolve mask the compact card no longer carries.
              ...(compact
                ? { opacity: Math.pow(BRIGHTNESS_PER_CARD, distance) }
                : {}),
            });

            // Quantised, and everything below written only when the bucket
            // actually changes: the masks and filters downstream re-rasterise
            // on every distinct value, so an unchanged bucket is worth the
            // comparison to avoid. Only the transform (and the compact
            // build's opacity) is compositor-cheap enough to set every frame
            // regardless — which is also why the image's `blur()` now lives
            // in this gate rather than being rewritten unquantised per frame
            // (PERFORMANCE-AUDIT.md, P0-3).
            const quantised = Math.round(depth / DEPTH_STEP) * DEPTH_STEP;

            if (quantised !== depthValues.current[index]) {
              depthValues.current[index] = quantised;

              const img = imgRefs.current[index];
              if (compact) {
                // The image keeps brightness/desaturation — the cheap half of
                // the atmospheric cue — and drops the blur, exactly as the
                // hero's own PHOTO_BLUR reasoning prescribes for this class
                // of device.
                if (img) {
                  gsap.set(img, {
                    filter:
                      `brightness(${1 - quantised * MAX_DIM})` +
                      ` saturate(${1 - quantised * MAX_DESATURATE})`,
                  });
                }
              } else {
                // `setProperty` rather than `gsap.set`: CSSPlugin resolves
                // what it is given against the element's existing computed
                // style, and a bare custom property has no such thing to
                // resolve against, so it silently writes nothing. These are
                // plain string writes with nothing to interpolate — the DOM
                // call is both the working route and the cheaper one.
                // `toFixed` because the quantising multiply lands on binary
                // float noise — 0.7 arrives as 0.7000000000000001, and that
                // is the literal string the property would carry.
                face.style.setProperty("--depth", quantised.toFixed(2));
                // Dead centre has no outward side to aim the falloff at, so
                // the sign there is arbitrary.
                face.style.setProperty("--focus-x", sign < 0 ? "68%" : "32%");

                // On the face rather than on the image, so the dust and
                // grain overlays dim with the artwork they sit on instead of
                // staying lit over a darkened card. `filter` makes the face
                // a grouping element — which flattens *its* contents, all of
                // which are 2D already — but leaves the face's own transform
                // in the scroller's 3D context untouched.
                gsap.set(face, {
                  filter: `brightness(${Math.pow(BRIGHTNESS_PER_CARD, distance)})`,
                });

                if (img) {
                  gsap.set(img, {
                    filter:
                      `blur(${quantised * MAX_BLUR_PX}px)` +
                      ` brightness(${1 - quantised * MAX_DIM})` +
                      ` saturate(${1 - quantised * MAX_DESATURATE})`,
                  });
                }

                const dust = dustRefs.current[index];
                if (dust)
                  gsap.set(dust, { opacity: quantised * MAX_DUST_OPACITY });

                const grain = grainRefs.current[index];
                if (grain)
                  gsap.set(grain, { opacity: quantised * MAX_GRAIN_OPACITY });
              }
            }
          }
        });
      };

      /** Reduced motion still scrolls and snaps — it just lays flat. */
      const layFlat = () => {
        cardRefs.current.forEach((card, index) => {
          if (!card) return;
          // Nothing overlaps or projects when the rank is flat, so there is no
          // order or vanishing point to impose — but the arc may have written
          // both before the preference changed, so they have to be cleared
          // rather than just left alone.
          card.style.zIndex = "";
          card.style.perspectiveOrigin = "";
          // `NaN` as "nothing written": it compares unequal to itself, so the
          // arc always writes afresh if the preference flips back. Recording
          // the value these *would* have had instead would let the centre card
          // skip a write it genuinely needs, since the inline styles are gone.
          zIndexValues.current[index] = NaN;
          originValues.current[index] = NaN;
        });
        faceRefs.current.forEach((face, index) => {
          if (!face) return;
          gsap.set(face, {
            x: 0,
            rotateY: 0,
            z: 0,
            scale: 1,
            opacity: 1,
            filter: "none",
          });
          face.style.setProperty("--depth", "0");
          depthValues.current[index] = 0;
        });
        for (const img of imgRefs.current) {
          if (!img) continue;
          gsap.set(img, { filter: "none" });
        }
        for (const dust of dustRefs.current) {
          if (!dust) continue;
          gsap.set(dust, { opacity: 0 });
        }
        for (const grain of grainRefs.current) {
          if (!grain) continue;
          gsap.set(grain, { opacity: 0 });
        }
      };

      const applyLayout = () => {
        if (prefersReducedMotion) layFlat();
        else updateArc();
      };

      /** Index into `cardRefs`/`PROJECTS` of whichever card sits nearest centre. */
      const nearestCardIndex = () => {
        const scrollLeft = scroller.scrollLeft;
        let best = 0;
        let bestDistance = Infinity;

        metrics.centers.forEach((center, index) => {
          const distance = Math.abs(center - scrollLeft - metrics.scrollerCenter);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = index;
          }
        });

        return best;
      };

      /**
       * Syncs `centeredIndex` state to whichever project is nearest centre.
       * Only actually updates React state when the centred card changes.
       */
      const updateCenteredIndex = () => {
        const index = nearestCardIndex();
        if (index !== centeredIndexRef.current) {
          centeredIndexRef.current = index;
          setCenteredIndex(index);
        }
      };

      // The arc is driven off the scroller's own `scroll` event, throttled to
      // one update per animation frame.
      //
      // A persistent per-frame ticker would also work and never go stale, but
      // it burns a frame's worth of layout reads and 3D writes forever, on
      // every card, whether or not anything has moved — for a carousel that
      // is stationary the overwhelming majority of the time. The event fires
      // for every source that can move this scroller (touch, trackpad,
      // scrollbar, snap settle, and the smooth `scrollTo` the buttons issue,
      // which dispatches throughout its animation), and nothing in this
      // component writes `scrollLeft` behind the browser's back any more, so
      // there is no longer a class of movement the event can miss.
      let frame = 0;
      // Re-bases the step counter once the scroller has actually come to rest.
      //
      // Without this, a visitor who swipes or drags the carousel by hand
      // leaves `targetIndexRef` pointing at whatever was last commanded by a
      // button, and their next arrow press jumps back to that stale place
      // instead of stepping on from where they are now. A quiet period is a
      // reliable enough signal for "stopped": a smooth `scrollTo` and a snap
      // settle both dispatch continuously while they run, so neither leaves a
      // gap this long mid-flight. (`scrollend` would say it directly, but is
      // still missing from enough shipping Safari versions to need a fallback
      // that would then be the thing actually doing the work.)
      let settleTimer: number | undefined;
      const onScroll = () => {
        window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(() => {
          targetIndexRef.current = centeredIndexRef.current;
          // The scroller is at rest — this is the one moment a screen reader
          // should hear about the project now centred (see the live region
          // below), rather than every project the carousel merely passed.
          setSettledIndex(centeredIndexRef.current);
        }, 120);

        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          updateArc();
          updateCenteredIndex();
        });
      };

      const placeAtIndex = (index: number) => {
        scroller.scrollLeft = metrics.centers[index] - metrics.scrollerCenter;
        centeredIndexRef.current = index;
        targetIndexRef.current = index;
        setCenteredIndex(index);
        setSettledIndex(index);
        applyLayout();
      };

      // This effect re-runs when `compact` or the motion preference flips,
      // and the styles the previous run wrote inline — filters, masks,
      // opacity — belong to the build that just went away. Clear them and
      // forget the caches so the new build starts from the markup.
      cardRefs.current.forEach((card, index) => {
        if (!card) return;
        card.style.zIndex = "";
        card.style.perspectiveOrigin = "";
        zIndexValues.current[index] = NaN;
        originValues.current[index] = NaN;
      });
      faceRefs.current.forEach((face, index) => {
        if (!face) return;
        gsap.set(face, { clearProps: "filter,opacity" });
        face.style.removeProperty("--depth");
        face.style.removeProperty("--focus-x");
        depthValues.current[index] = NaN;
      });
      for (const img of imgRefs.current) {
        if (img) gsap.set(img, { clearProps: "filter" });
      }

      measure();
      placeAtIndex(START_INDEX);

      // A resize changes card width and gap, which moves every card centre —
      // so the metrics table and the old `scrollLeft` are both stale, and
      // both are re-derived from the card that *was* centred.
      //
      // Two guards, both for mobile. The width check drops the resizes the
      // address bar generates — those change only the viewport's *height*,
      // and reacting to them meant re-centring the carousel under the
      // visitor's finger mid-gesture. The debounce collapses the burst a
      // real rotation or window drag produces into one re-measure at the
      // end, instead of a re-layout per intermediate size.
      let lastWidth = scroller.clientWidth;
      let resizeTimer: number | undefined;
      const resizeObserver = new ResizeObserver(() => {
        const width = scroller.clientWidth;
        if (width === lastWidth) return;
        lastWidth = width;

        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => {
          measure();
          placeAtIndex(centeredIndexRef.current);
        }, 150);
      });
      resizeObserver.observe(scroller);

      // `will-change` is a standing cost, so — exactly as the hero already
      // does — the hint is scoped to the window where it buys something: the
      // faces are promoted while the section is anywhere in the viewport and
      // released once it has scrolled away, instead of holding three
      // card-sized compositor layers for the whole session.
      const syncWillChange = (self: ScrollTrigger) => {
        for (const face of faceRefs.current) {
          if (face) face.style.willChange = self.isActive ? "transform" : "auto";
        }
      };

      const promote = ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top bottom",
        end: "bottom top",
        onToggle: syncWillChange,
      });

      // A toggle only reports a change — created mid-viewport (a reload down
      // the page) the trigger is simply born active, so the opening state is
      // applied by hand.
      syncWillChange(promote);

      scroller.addEventListener("scroll", onScroll, { passive: true });

      return () => {
        resizeObserver.disconnect();
        window.clearTimeout(resizeTimer);
        promote.kill();
        for (const face of faceRefs.current) {
          if (face) face.style.willChange = "";
        }
        scroller.removeEventListener("scroll", onScroll);
        if (frame) cancelAnimationFrame(frame);
        window.clearTimeout(settleTimer);
      };
    },
    { scope: sectionRef, dependencies: [prefersReducedMotion, compact] },
  );

  /**
   * Arrow keys, Home and End move the carousel while it has focus.
   *
   * The scroller is focusable, so a browser would already give it arrow-key
   * scrolling by the pixel; this upgrades that to card-at-a-time movement so
   * the keyboard lands on the same snap positions every other input does.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, () => void> = {
      ArrowLeft: () => stepBy(-1),
      ArrowRight: () => stepBy(1),
      Home: () => scrollToIndex(0),
      End: () => scrollToIndex(PROJECTS.length - 1),
    };

    const move = moves[event.key];
    if (!move) return;

    event.preventDefault();
    move();
  };

  const atStart = centeredIndex === 0;
  const atEnd = centeredIndex === PROJECTS.length - 1;

  return (
    <div ref={sectionRef} className="min-h-dvh py-64">
      <header>
        <h1 className="text-white text-6xl lg:text-7xl xl:text-8xl 2xl:text-9xl tracking-tight font-aeonik-regular text-center">
          Products I&apos;ve <br /> helped ship
        </h1>
      </header>

      <div
        className="relative mt-24"
        role="group"
        aria-roledescription="carousel"
        aria-label="Products I've helped ship"
      >
        {/* Nothing here but the edge fade — see `EDGE_FADE`. */}
        <div
          style={{
            WebkitMaskImage: EDGE_FADE,
            maskImage: EDGE_FADE,
          }}
        >
          <div
            ref={scrollerRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            aria-label="Projects, use the arrow keys to browse"
            // `overflow-y-hidden` clips to the scroller's own content box, and the
            // flanking cards are both scaled up and pulled toward the camera — so
            // the vertical padding here is not decoration, it is the headroom that
            // keeps their top and bottom edges from being sliced off.
            //
            // No wheel handler any more. Translating vertical wheel deltas into
            // horizontal scroll meant calling `preventDefault` on every mostly
            // vertical gesture over the scroller — including once the carousel
            // had run out of cards in that direction — and since this sits in
            // the middle of a full-height section, that is where the cursor
            // usually is. The page stopped scrolling until the visitor thought
            // to move the pointer off it. Mouse users get the arrows below
            // instead, which is a control they can see.
            className="scrollbar-hidden flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden py-28 outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            {/*
              No `perspective` or `preserve-3d` anywhere above the cards. Either
              one here would gather every card into a single 3D rendering
              context, where painting order is decided by depth sorting the
              flattened faces cannot take part in — see `BASE_Z_INDEX`. Each
              card brings its own perspective instead.
            */}
            <div
              ref={trackRef}
              className="relative flex shrink-0 items-center gap-6 px-[calc(50%-clamp(130px,15vw,360px))]"
            >
              {PROJECTS.map((project, index) => (
                <div
                  key={project.title}
                  ref={(el) => {
                    cardRefs.current[index] = el;
                  }}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${index + 1} of ${PROJECTS.length}: ${project.title}`}
                  // The snap box: laid out, measured, and snapped to, but never
                  // transformed — see `updateArc`. It carries the projection
                  // for the one face inside it, and `z-index` orders it against
                  // the other cards; the arc writes both every frame, along
                  // with the `perspectiveOrigin` that aims this card's
                  // vanishing point back at the scroller's centre.
                  className="relative w-[clamp(260px,30vw,720px)] aspect-video shrink-0 snap-center"
                  style={{ perspective: PERSPECTIVE }}
                >
                  <div
                    ref={(el) => {
                      faceRefs.current[index] = el;
                    }}
                    // No standing `will-change` — the hint is applied by
                    // `syncWillChange` only while the section is on screen.
                    className="relative h-full w-full overflow-hidden rounded-4xl bg-neutral-800 shadow-2xl shadow-black/60"
                  >
                    <Image
                      ref={(el) => {
                        imgRefs.current[index] = el;
                      }}
                      src={project.image}
                      alt={project.title}
                      fill
                      sizes="(max-width: 768px) 80vw, 720px"
                      loading="lazy"
                      decoding="async"
                      className="object-cover"
                      draggable={false}
                      // The radial dissolve re-rasterises the image on every
                      // distinct `--depth`; the compact build swaps it for
                      // the opacity ramp on the face and carries no mask.
                      style={
                        compact
                          ? undefined
                          : {
                              WebkitMaskImage: IMAGE_MASK,
                              maskImage: IMAGE_MASK,
                            }
                      }
                    />
                    {/*
                    The dust. Same image again, but showing only through the
                    particle stencil — so every speck is a sample of the
                    artwork underneath it and carries that pixel's colour,
                    rather than being a grey fleck laid on top. `background`
                    rather than a second <img> because nothing here needs a
                    second decode, an alt text, or a place in the a11y tree.
                  */}
                    {hydrated && !compact && (
                    <div
                      ref={(el) => {
                        dustRefs.current[index] = el;
                      }}
                      aria-hidden
                      className="pointer-events-none absolute inset-0 opacity-0"
                      style={{
                        backgroundImage: `url("${project.image}")`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        // Left unblurred on purpose — the image beneath is
                        // going soft as it recedes, and specks that stay sharp
                        // against it are what separate "coming apart" from
                        // "going out of focus". No saturation lift any more:
                        // the receding card is being desaturated deliberately,
                        // and dust that stayed vivid would sit outside that
                        // lighting rather than inside it.
                        filter: "none",
                        WebkitMaskImage: DUST_LAYER_MASK,
                        maskImage: DUST_LAYER_MASK,
                        WebkitMaskSize: `${DUST_TILE}px ${DUST_TILE}px, 100% 100%`,
                        maskSize: `${DUST_TILE}px ${DUST_TILE}px, 100% 100%`,
                        WebkitMaskRepeat: "repeat, no-repeat",
                        maskRepeat: "repeat, no-repeat",
                        // Safari still wants the old keyword for the same op.
                        WebkitMaskComposite: "source-in",
                        maskComposite: "intersect",
                      }}
                    />
                    )}
                    {hydrated && !compact && (
                    <div
                      ref={(el) => {
                        grainRefs.current[index] = el;
                      }}
                      aria-hidden
                      className="pointer-events-none absolute inset-0 opacity-0 mix-blend-hard-light"
                      style={{
                        backgroundImage: GRAIN_BACKGROUND,
                        backgroundSize: "180px 180px",
                        WebkitMaskImage: GRAIN_MASK,
                        maskImage: GRAIN_MASK,
                      }}
                    />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/*
          The arrows are the affordance the carousel was missing entirely.
          Nothing about the old version said it could be scrolled — it
          answered only to a wheel gesture the visitor had to guess at, and to
          nothing at all on a mouse without horizontal scroll. Real <button>s
          also put it in the tab order for free.

          Hidden from assistive tech: the scroller itself is focusable and
          documents its own arrow-key handling, so announcing these too would
          just be a second way to say the same thing.
        */}
        <button
          type="button"
          onClick={() => stepBy(-1)}
          disabled={atStart}
          aria-hidden
          tabIndex={-1}
          className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-black/40 p-3 text-white backdrop-blur transition hover:bg-black/70 disabled:pointer-events-none disabled:opacity-0 md:left-4 md:p-4"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => stepBy(1)}
          disabled={atEnd}
          aria-hidden
          tabIndex={-1}
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-black/40 p-3 text-white backdrop-blur transition hover:bg-black/70 disabled:pointer-events-none disabled:opacity-0 md:right-4 md:p-4"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/*
        One dot per project: the count and the position, which the arc alone
        cannot convey once a card is rotated far enough to be unreadable. Also
        the only direct way to reach a specific project rather than stepping
        past everything in between.
      */}
      <div className="mt-8 flex justify-center gap-3">
        {PROJECTS.map((project, index) => (
          <button
            key={project.title}
            type="button"
            onClick={() => scrollToIndex(index)}
            aria-label={`Show ${project.title}`}
            aria-current={index === centeredIndex}
            className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
              index === centeredIndex
                ? "w-8 bg-white"
                : "w-2.5 bg-white/30 hover:bg-white/60"
            }`}
          />
        ))}
      </div>

      {/*
        The copy swaps as a side effect of scrolling, with no focus change to
        carry the news — but the visible container is deliberately *not* a
        live region: it updates on every card the carousel passes, and a
        screen reader would re-announce a full paragraph per pass. The
        visually-hidden region below speaks instead, and only once the
        scroller has settled — see `settledIndex`.
      */}
      <div aria-live="polite" className="sr-only">
        {PROJECTS[settledIndex].title}
      </div>
      <div className="text-white flex flex-col max-w-4xl m-auto gap-6 p-12">
        <WorkDescriptions type={PROJECTS[centeredIndex].title} />
      </div>
    </div>
  );
}
