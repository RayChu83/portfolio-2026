"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Image from "next/image";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { DottedMap, type Marker } from "@/components/ui/dotted-map";
import headshotPhoto from "../../../public/headshot.png";
import kawaiiHeadshotBackground from "../../../public/kawaii_headshot_background.svg";
import kawaiiHeadshotForeground from "../../../public/kawaii_headshot_foreground.svg";
import { useMediaQuery } from "../_hooks/useMediaQuery";
import { useTilt } from "../_hooks/useTilt";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

/**
 * Camera distance in px. Must stay in step with the `perspective-distant`
 * utility on the scene wrapper, which Tailwind defines as 1200px — the maths
 * below reads depth as a fraction of it.
 */
const PERSPECTIVE = 1200;

/** How far in front of the head the face features float, in px. */
const FOREGROUND_DEPTH = 70;

/**
 * A layer at +z projects larger by PERSPECTIVE / (PERSPECTIVE - depth). Scaling
 * it back by the inverse keeps the features registered to the head at rest, so
 * depth changes only how they slide when the head turns — not how big they are.
 */
const FOREGROUND_SCALE = (PERSPECTIVE - FOREGROUND_DEPTH) / PERSPECTIVE;

/**
 * Degrees the whole head turns at full tilt.
 *
 * One rotation drives both layers, because that is what a rigid object does:
 * the depth between them, not a difference in their angles, is what produces
 * the parallax. Perspective then generates it for free, with the right
 * magnitude everywhere in the frame and the right sign on both sides.
 *
 * rotateX is negative so the two axes agree in handedness — a positive rotateY
 * turns the right edge away from the camera, and a negative rotateX does the
 * same for the bottom edge. Mixing them makes the head follow the pointer
 * sideways while shying away from it vertically.
 */
const SWING = { rotateX: -8, rotateY: 12 };

/**
 * The features float in front of the head, so they cast onto it. The offset
 * leans against the tilt — the shadow pools on the side the layer has slid away
 * from — over a small fixed offset that keeps a light source overhead at rest.
 */
const FOREGROUND_SHADOW =
  "drop-shadow(calc(var(--tilt-x, 0) * -8px + 2px) " +
  "calc(var(--tilt-y, 0) * -8px + 3px) 4px rgb(0 0 0 / 0.2))";

/**
 * The same shadow with the lean taken out of it, for COMPACT.
 *
 * The offset above is a `calc` over the two custom properties the tilt spring
 * writes, which means the drop-shadow is re-derived and the layer re-rasterised
 * on every frame the tilt moves — and on a touch device the tilt is driven by
 * the device's own orientation, so it is essentially never still. Freezing the
 * offset makes it a filter the browser resolves once and then leaves alone.
 *
 * What is lost is the shadow pooling on the side the features have slid away
 * from. The features still slide — the parallax is perspective acting on the
 * depth between the layers and does not go anywhere — so what remains is a
 * fixed overhead light, which is what the `+ 2px` / `+ 3px` in the expression
 * above already describes at rest.
 */
const FOREGROUND_SHADOW_COMPACT = "drop-shadow(2px 3px 4px rgb(0 0 0 / 0.2))";

/**
 * How long the headshot stays pinned, as a share of the viewport height. A
 * percentage in a ScrollTrigger `end` measures against the scroller, so this
 * is 400dvh of scrolling spent with the image held still.
 *
 * It is also the only pace control the reveal has. Every constant below is a
 * share of this pin rather than a number of seconds, and the scrub stretches
 * the timeline across the trigger whatever it adds up to — so scaling those
 * shares changes the order of events and never the speed. Widening the trigger
 * is what buys each beat more scrolling, and it slows the whole sequence by the
 * same factor while leaving every relationship inside it exactly as authored.
 */
const PIN_LENGTH = "+=400%";

/**
 * Which visitors get the cheaper build of the reveal.
 *
 * Two conditions, not one, because the two failure modes are different
 * hardware. `max-width` catches the phone-sized viewport, where the pin has the
 * least screen to work with and the browser the least memory. `pointer: coarse`
 * catches the rest of the touch devices whatever their width — a tablet in
 * landscape is 1024px or more and is still a phone's GPU, and it is exactly the
 * device that reports a comfortable viewport while dropping frames under a
 * compound filter. Either alone leaves a common class of device on the
 * expensive path.
 *
 * A comma rather than the `or` of media queries level 4: this string is handed
 * to `window.matchMedia` as well as to GSAP, and a list is the form every
 * browser that can render the rest of this component already parses.
 *
 * Deliberately not a `prefers-reduced-motion` check. That preference is a
 * request about motion and is answered by its own branch further down, which
 * removes the movement and keeps the picture. This is a statement about the
 * frame budget, and the answer to it is the same reveal built out of cheaper
 * parts — nobody is being shown less because of it.
 */
const COMPACT = "(max-width: 1023px), (pointer: coarse)";

/** Visitors who have not asked for less movement, and so get the reveal. */
const MOTION = "(prefers-reduced-motion: no-preference)";

/**
 * The pin, shortened for those visitors.
 *
 * Not a saving in work per frame — it is a saving in how many frames are spent
 * in the expensive state at all. Every pixel of the pin is a pixel scrolled
 * with the stage held by a transform, the scrub recomputing the timeline and
 * the compositor holding the promoted layers; 400dvh of that is a long time to
 * ask a phone to sustain, and on a short viewport it is also a lot of thumb.
 *
 * The reveal itself is untouched by this. Every constant above is a share of
 * the pin rather than a number of seconds, so a shorter trigger runs the same
 * sequence in the same order and simply runs it faster — see PIN_LENGTH.
 */
const PIN_LENGTH_COMPACT = "+=250%";

/**
 * Where each label's wave of glyphs begins, in timeline units — the scrubbed
 * timeline below is held open to exactly 1, so these read as shares of the pin.
 *
 * The gap between them is the point: overlap them any closer and the two
 * labels land as a single mushy event instead of a one-two beat.
 */
const ROLE_START = 0;
const CRAFT_START = 0.22;

/**
 * How long one glyph takes to arrive, and how long the wave takes to travel
 * across a whole label. `CRAFT_START + CHAR_STAGGER + CHAR_DURATION` is where
 * the last glyph lands — comfortably before the pin is over, so the rest of the
 * hold is spent on the finished picture rather than on type still creeping in.
 */
const CHAR_DURATION = 0.13;
const CHAR_STAGGER = 0.2;

/**
 * The glyph's pose before it arrives: a full line-height below its resting
 * place — which, inside the per-line clip `mask: "lines"` wraps it in, is far
 * enough to be nothing at all — and tipped back onto its own baseline.
 *
 * `transformPerspective` rather than a `perspective` on the line, so every
 * glyph hinges about its own vanishing point. A shared one would foreshorten
 * the ends of a 17-character label far harder than its middle, and the wave
 * would visibly weaken as it travelled.
 *
 * The rotation is positive, tipping the top of the glyph *away* from the
 * camera. Tipping it toward the camera swings it past the picture plane, where
 * it reads as looming rather than as standing up.
 */
const CHAR_FROM = {
  yPercent: 105,
  rotationX: 72,
  transformOrigin: "50% 100% -1px",
  transformPerspective: 420,
};

/**
 * The curve on a single glyph. The timeline as a whole stays linear — under a
 * scrub, scrolling is the easing, and a curve on top of it reads as the words
 * lagging the wheel. But a glyph's own tween is only CHAR_DURATION of the pin,
 * short enough that its curve reads as that one letter snapping into place
 * rather than as the block dragging behind the scroll. That is where the life
 * in the reveal comes from, and why the labels can hold a linear master.
 */
const CHAR_EASE = "power3.out";

/**
 * When the finished labels start leaving, and how long they take. Whatever the
 * two add up to is the end of the timeline, and a scrub stretches the timeline
 * over the whole trigger — so the type is gone at the moment the pin releases
 * and the page below arrives on an uncluttered frame. Lengthening the exit
 * does not push it past the pin; it compresses everything before it.
 *
 * The start is after the last glyph lands at
 * `CRAFT_START + CHAR_STAGGER + CHAR_DURATION`, with a beat of stillness in
 * between: the whole sequence is built so that the picture and the two phrases
 * are all simply *there* for a moment before anything moves again. Begin the
 * exit any earlier and the tail of the reveal is glyphs still arriving into a
 * block already sliding away.
 *
 * The two labels leave through the edge each one is parked against — the role
 * up through the top, the craft down through the bottom. They arrived
 * travelling inwards towards the face from opposite corners; leaving outwards
 * through opposite edges is that same gesture run backwards, and it clears the
 * frame from the middle out, which is where the photograph is heading.
 */
const LABELS_EXIT_START = 0.62;
const LABELS_EXIT = 1;

/**
 * How far each label travels on its way out, as a percentage of its own height.
 *
 * Its own height is all it needs: one is pinned to the top of the viewport and
 * the other to the bottom, so a label that has moved its own height past its
 * edge is a label with nothing left on screen. The extra 5% is slack for
 * descenders and line-height overshooting the box.
 *
 * A percentage rather than the measured viewport distance the labels used to
 * share, because it is the same number at every window size — nothing here has
 * to be re-measured on a resize or re-derived on a rotate.
 */
const LABEL_EXIT_TRAVEL = 105;

/**
 * When the place line starts writing itself on, in the same glyph-by-glyph wave
 * the other two arrive in.
 *
 * The moment the other two have finished leaving, not a beat before: it takes
 * over an empty frame rather than crossing the type on its way out. That is
 * the end of their exit — and, since the exit is what ends the timeline,
 * starting anything here lengthens the whole thing. The scrub stretches
 * whatever it is given over the same pin, so the cost is that everything
 * before it compresses a little; the gain is a clean handover and a last beat
 * of the hold spent on the finished picture writing its own caption.
 *
 * It never leaves. The others are titles over a portrait and belong to that
 * picture; this one is the caption on the map, and the map is what the pin
 * hands to the rest of the page.
 */
const PLACE_START = LABELS_EXIT_START + LABELS_EXIT;

/**
 * Where the place line's bottom edge sits, measured from the bottom of the
 * stage — the element it is anchored to, since being carried off by the pin is
 * the whole reason it lives inside it.
 *
 * The stage is the header's leftovers, so its bottom is not the screen's. Held
 * still by the pin it is centred in the viewport, which leaves half the
 * header's height of gap below it: with a stage of S in a viewport of V, that
 * gap is (V - S) / 2. Hanging the label that far *below* the stage — a
 * negative offset — puts its bottom edge on the bottom of the screen, which is
 * where the two labels it takes over from are parked.
 *
 * `%` resolves against the stage's height and `dvh` against the viewport, so
 * one expression has both numbers without measuring anything. It is exact only
 * while the stage is pinned and centred, which is the whole of the time this
 * label is on screen — before the pin the label has not been written yet, and
 * after it the stage is scrolling away and carrying it along.
 */
const PLACE_BOTTOM = "calc((100% - 100dvh) / 2)";

/**
 * The rule under "New York City": its weight, and where it sits inside the
 * span's box. Both in em, so they scale with the type across every breakpoint
 * the label steps through.
 *
 * Painted as the span's *background* rather than as a `text-decoration`, which
 * was the first attempt and underlined the spaces between the words and
 * nothing else. SplitText wraps every glyph in an inline-block, and a
 * decoration is not drawn across atomic inline boxes — only the bare text
 * nodes left between them, which by then is just the two spaces. A background
 * has no such rule: the span paints it behind everything it contains.
 *
 * Backgrounds are clipped to the box, so the rule cannot be pushed below it —
 * 100% is as low as it goes, which on this uppercase line is the bottom of the
 * em box and reads as a normal underline gap under a baseline with no
 * descenders in it.
 *
 * Both live on the span rather than on a positioned element of our own,
 * because SplitText rebuilds the paragraph's innards from its saved HTML
 * whenever `autoSplit` re-splits: an element we appended would come back as a
 * node React's ref no longer points at, and any tween aimed at it would be
 * left animating something detached. Inline style is part of that saved HTML
 * and comes back with it.
 */

/**
 * What the photograph draws back to, and the corner radius it carries once it
 * has — both reached over exactly the span the labels spend leaving, because
 * they are one gesture: the hero resolving from a full-bleed head into a card
 * the rest of the page can sit under.
 *
 * The radius is authored in the photo's own pre-scale units, and a `transform`
 * shrinks the drawn corner along with everything else — so at PHOTO_SHRINK the
 * 56px below reads as roughly 35 on screen. Sizing the element instead of
 * scaling it would keep the number honest, but width and height are laid out
 * properties and animating them would relayout the frame every tick.
 */
const PHOTO_SHRINK = 0.05;
const PHOTO_RADIUS = 300;

/**
 * How long the pointer's hold over the head takes to be let go, starting with
 * the shrink.
 *
 * Much shorter than the shrink itself, and deliberately so. The tilt is what
 * sells the head as an object in space, and an object is what the picture stops
 * being the moment it starts becoming a card — so the parallax is released
 * early and the rest of the retreat is a flat rectangle squaring up, rather
 * than a card that goes on swaying at the pointer long after it has stopped
 * being a face.
 *
 * Released by scaling the swing to zero rather than by tearing down the
 * listener: the spring in `useTilt` keeps tracking the pointer either way, so
 * scrolling back up finds the tilt already where the pointer left it instead of
 * springing there from centre.
 */
const TILT_RELEASE = 0.14;

/**
 * The one place on Earth the whole retreat is aimed at. 40.7128 / -74.006 is
 * New York — the pair in the brief, 37.5665 / 126.978, is Seoul, and is the
 * other marker in the demo this is modelled on.
 *
 * A module constant rather than a value built in the render, so the array
 * identity never changes and `DottedMap` — which re-runs `createMap` over
 * `mapSamples` points on every render it is given — is only ever asked to do
 * that work once.
 */
const NEW_YORK: Marker[] = [{ lat: 40.7128, lng: -74.006, size: 0 }];

/**
 * How small the map starts. It arrives by growing into place rather than by
 * fading alone, and it grows *about New York* — the transform origin is set
 * from the measured marker below — so the one point the photograph is flying to
 * is the one point on the map that never moves while it arrives.
 *
 * Small enough to read as an approach, nowhere near small enough to read as a
 * zoom: the dots are a fixed radius in the SVG's own units and scaling the
 * whole thing scales them too, so a hard scale-up ends with the grain of the
 * map visibly coarsening as it settles.
 */
const MAP_SCALE_FROM = 0.88;

/**
 * The map is drawn on a 2:1 viewBox and its frame is held to exactly that
 * ratio, so the SVG fills the frame with no letterboxing. That is what makes
 * New York's position a fixed *fraction* of the frame, measured once and true
 * at every viewport size — the alternative, `preserveAspectRatio` centring a
 * 2:1 drawing inside whatever box the stage happens to be, moves the marker
 * around inside its own container every time the window changes shape.
 */
const MAP_ASPECT = "2 / 1";

/**
 * How wide the map's frame is. Only the width is set — the ratio above derives
 * the height from it — because a box given both a definite height and a
 * `max-width` stops honouring its ratio, and a frame that is no longer 2:1
 * puts the letterboxing back and breaks the invariant that whole approach
 * rests on.
 *
 * `cq` units, off a size container on the layer around it, are what let one
 * declaration say "as wide as the stage, but never taller than it": the stage
 * is the header's leftovers rather than any fraction of the viewport, so `dvh`
 * cannot express its height and `%` cannot compare across the two axes.
 *
 * The 0.9 is margin. Held to exactly the stage the map's poles graze the top
 * and bottom edges, which reads as a map that did not fit rather than one
 * placed there.
 */
const MAP_WIDTH = "calc(min(100cqw, 200cqh) * 0.9)";

/**
 * Where the map's dots start fading out, as a fraction of the way from its
 * centre to its edge. Everything inside this is at full strength; from here to
 * the edge the dots thin to nothing, so the map has no border to notice.
 *
 * The falloff is an ellipse fitted to the map's 2:1 box, not a circle, which
 * is what keeps the fade the same depth on all four sides.
 */
const MAP_FADE_START = 0.75;

/**
 * How long the photograph takes to dolly in and be wiped clear. It begins with
 * the type — that is the point of the whole sequence — but lands well before
 * the last glyph does, at `CRAFT_START + CHAR_STAGGER + CHAR_DURATION`.
 *
 * Ending the two together was the first thing tried and it reads worse. Partly
 * composition: with the type still visibly moving through the whole back half of
 * the picture's arrival there is no moment where the image simply *is*. Partly
 * something less obvious — the top quarter of the frame is empty studio
 * backdrop, so the last stretch of a bottom-to-top wipe uncovers nothing anyone
 * can see, and the picture *looks* resolved at about two-thirds of the wipe.
 *
 * That apparent finish, not the real one, is the deadline every other layer has
 * to clear. Overrun it and the drawing reads as residue left on a photograph
 * rather than as something still on its way out.
 */
const PHOTO_ARRIVE = 0.42;

/**
 * How far behind the drawing the photograph begins, in px.
 *
 * Deliberately *not* compensated by an inverse scale the way FOREGROUND_SCALE
 * compensates the features: there the depth exists only to buy parallax and the
 * size change is an unwanted side effect, whereas here the size change is the
 * effect. Perspective alone grows the photo from 90% to exactly 100% as it
 * dollies to the picture plane, which is what makes it read as approaching
 * rather than as being scaled up.
 */
const PHOTO_DEPTH = -140;

/**
 * How far toward the camera the drawing travels on its way out, in px. Both of
 * its layers lift by the same amount, so the drawing leaves as the one rigid
 * object it has been the whole time — and because it moves toward the lens
 * rather than away, it reads as peeling off the front of the picture to uncover
 * what was always behind it, instead of shrinking into the distance.
 */
const DRAWING_LIFT = 150;

/** How long the linework takes to lift away and fade. */
const DRAWING_EXIT = 0.26;

/**
 * When the drawn features leave, and how long they take. They start after the
 * linework and outlast it, because the wipe uncovers the photo from the bottom
 * up and so the real face is the last part of it to arrive — this parks the
 * drawn eyes and mouth over their counterparts while they surface, and the two
 * faces hand off to each other.
 *
 * The end is the delicate number. Run it past the point where the photograph
 * looks resolved and the drawn eyes stop reading as a handoff and start reading
 * as smudges on the print; 0.12 and then 0.08 were both far enough over to look
 * like exactly that.
 */
const FEATURES_DELAY = 0.06;
const FEATURES_EXIT = 0.3;

/**
 * How far out of focus the photograph starts, in px of blur, and how much of
 * its arrival it spends pulling into focus.
 *
 * Shorter than the wipe on purpose. A focus pull that ran the full span would
 * still be resolving the face at the moment the face appears, which loses the
 * one frame the whole transition is built around; ending it early means the
 * photograph is already sharp and waiting when the wipe finally clears the eyes.
 *
 * Dropped entirely under COMPACT, and it is the single largest saving there.
 * Everything else the scrub touches is a transform or an opacity, which the
 * compositor can apply to a layer it already has; a blur is neither. The
 * browser has to re-rasterise the element through the filter on every tick, at
 * the size of the filter's own box — which `fill` makes the whole stage — and
 * it is doing that on the one element that is *also* carrying an animated mask
 * and sitting inside a 3D-transformed subtree. The focus pull is the nicest
 * detail in the sequence and it is not worth a phone's entire frame budget, so
 * the compact build simply arrives sharp.
 */
const PHOTO_BLUR = 6;
const PHOTO_FOCUS = 0.28;

/**
 * How finely the world is sampled, and the same again for COMPACT.
 *
 * The count is the map's whole cost twice over: it sets how many points are
 * projected when the SVG is built, and it is the number of `<circle>` elements
 * the browser then carries in the document and paints through a mask for the
 * rest of the visit. Halving it is worth more than it sounds on a phone, where
 * the map is also being drawn into a frame a fraction of the size — at that
 * scale the dropped dots are below the point the grain is legible at anyway.
 *
 * The radius has to move with it. Spacing is set by the count and the dots have
 * to stay clear of each other, so a coarser grid can afford a slightly larger
 * dot — and needs one, or the map thins out into something faint rather than
 * something simpler. See the note on `mapSamples` at the call site.
 */
const MAP_SAMPLES = 10000;
const MAP_SAMPLES_COMPACT = 4500;
const MAP_DOT_RADIUS = 0.15;
const MAP_DOT_RADIUS_COMPACT = 0.22;

/**
 * The photograph is a filled square on a grey studio backdrop, and the drawing
 * is linework on the page's own white. Cross-fading one into the other just
 * slides a grey rectangle over the hero, corners first — so instead the photo
 * is uncovered by a soft-edged wipe that climbs it.
 *
 * The band is driven by a single custom property so GSAP has one number to
 * scrub, with `calc` doing the work of turning it into two gradient stops. At
 * 0 the transparent stop sits at the bottom edge and the whole image is hidden;
 * at 1 the opaque stop has passed the top and all of it shows.
 *
 * Bottom to top for two reasons: it travels the same way the glyphs rise, and
 * it saves the face for last.
 */
const PHOTO_MASK =
  "linear-gradient(to top, " +
  "#000 calc(var(--photo-reveal) * 140% - 40%), " +
  "transparent calc(var(--photo-reveal) * 140%))";

/**
 * The three arguments of the `useSyncExternalStore` below, which is doing the
 * plainest possible job with it: hand back one value while the server-rendered
 * markup is being hydrated and a different one forever after.
 *
 * There is no store here and nothing to subscribe to — `document.body` does not
 * change — so the subscribe function registers nothing and returns an
 * unsubscribe that does nothing. What is wanted is the hook's other half: React
 * renders `onServer` during hydration and switches to `onClient` once that is
 * done, which is exactly the handover the portal needs, and it does it without
 * a `setState` in an effect and the cascading render that comes with one.
 *
 * Both snapshots must be stable across calls or React will re-render forever;
 * these return the same document and the same null every time.
 */
const subscribeNever = () => () => {};
const onClient = () => document.body;
const onServer = () => null;

export default function HeroHeadshot() {
  // Driven by the pointer anywhere on the page, or by the device's own tilt on
  // phones and tablets. Publishes `--tilt-x` / `--tilt-y` onto the scene below.
  const sceneRef = useTilt<HTMLDivElement>();
  const stageRef = useRef<HTMLDivElement>(null);
  const roleRef = useRef<HTMLParagraphElement>(null);
  const craftRef = useRef<HTMLParagraphElement>(null);
  const placeRef = useRef<HTMLParagraphElement>(null);
  const photoRef = useRef<HTMLImageElement>(null);
  const drawingRef = useRef<HTMLImageElement>(null);
  const featuresRef = useRef<HTMLImageElement>(null);
  // The square the headshot rests in, untransformed — the photograph's own box
  // is scaled and translated by the time anything needs measuring, so its
  // wrapper is what says where "centred" was.
  const frameRef = useRef<HTMLDivElement>(null);
  // The map's 2:1 box, and the layer inside it that actually moves. Two
  // elements, so the one being measured is never the one carrying a transform.
  const mapFrameRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  // An invisible circle the map draws at New York, purely to be measured.
  const markerRef = useRef<SVGCircleElement>(null);

  // Where the two corner labels are rendered: out of this component's own
  // subtree entirely and onto the end of `<body>` — see the portal below for
  // why they cannot stay where they are written.
  //
  // Resolved through the hook above rather than read straight off `document`
  // during render, because a portal is not as invisible to hydration as it
  // looks. It contributes no markup where it is written, but it is still a
  // child in that position — so a component that renders `null` there on the
  // server and a portal there on the client has handed React two different
  // trees to reconcile, and React 19 rejects the mismatch and re-renders the
  // whole subtree on the client. Deferring the target past hydration means the
  // hydrating render is the server's render exactly, and the labels arrive on
  // the commit after it.
  //
  // Which is why `overlay` is a dependency of `useGSAP` below, and why that
  // callback returns early without it: on the first commit the labels do not
  // exist yet and `roleRef.current` is null, so there is nothing to split. The
  // second commit has them, and that is the one that builds the timeline.
  const overlay = useSyncExternalStore(subscribeNever, onClient, onServer);

  // Whether the map may be drawn yet.
  //
  // Sampling the world at MAP_SAMPLES points and emitting a circle per dot is
  // the single largest piece of synchronous work this component does, and none
  // of it is visible when it runs: the map is at `opacity: 0` until the labels
  // start leaving, most of a pinned 400dvh later. Left to render with everything
  // else it lands in the same frame as three SplitText splits and the timeline
  // build, all of it in front of the hero's first paint — the one frame that
  // decides how the page feels to arrive at, and on a phone the frame with the
  // least to spare.
  //
  // Two frames of delay is all it takes to get out of the way: the first paints
  // the hero, and the map goes up on the one after. rAF rather than
  // `requestIdleCallback`, which would express the intent better but is still
  // missing from Safari — and an idle callback that never fires would take the
  // whole timeline with it, since the reveal cannot be built until the marker
  // it flies to exists.
  const [mapReady, setMapReady] = useState(false);

  // The render-time half of the COMPACT decision — how finely to sample the map
  // and whether the features' shadow tracks the tilt. The animation-time half
  // is the `matchMedia` branch below, off the same query string.
  //
  // Reading `false` during hydration costs nothing here: the shadow is a
  // detail no one is looking at on the first frame, and the map does not
  // render until `mapReady` two frames later, by which point this is live.
  const compact = useMediaQuery(COMPACT);

  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setMapReady(true));
    });

    // The backstop, and not a redundant one: a tab that is loaded in the
    // background paints nothing, so rAF is not throttled there but suspended
    // outright, and neither of the two above will run until the tab is looked
    // at. That is the right call for the map — there is no frame to stay out of
    // the way of — but the reveal is gated on this too, and a hero that has not
    // measured itself is one that jumps when the visitor finally arrives at it.
    // A timer keeps running either way, so the page is built and settled before
    // it is ever seen.
    const fallback = setTimeout(() => setMapReady(true), 300);

    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      clearTimeout(fallback);
    };
  }, []);

  useGSAP(
    () => {
      // The corner labels are portaled and so are a commit behind everything
      // else — see `overlay`. The map is two frames behind that again — see
      // `mapReady`, and note that the reveal measures New York off a circle the
      // map has to have drawn. Nothing here can be built until both exist.
      if (!overlay || !mapReady) return;

      // Reduced motion gets the headshot in ordinary flow: no pin, and a page
      // shorter by the whole of PIN_LENGTH for it.
      const media = gsap.matchMedia();

      // A conditions object rather than two separate `add`s, so the full build
      // and the compact one are one piece of code with a handful of values
      // swapped — the alternative is the whole reveal written twice, and two
      // copies of a sequence this interdependent would be out of step with each
      // other by the second edit.
      //
      // `motion` carries the guard on its own and `compact` only narrows it.
      // That asymmetry is deliberate: a browser that cannot parse COMPACT
      // reports it as simply not matching, which lands such a visitor on the
      // full build — the behaviour they had before any of this existed — rather
      // than on no build at all, which is where a pair of complementary queries
      // would strand them.
      //
      // GSAP re-runs this whenever the set of matching conditions changes, so
      // crossing the breakpoint or docking a tablet with a mouse tears the
      // reveal down and rebuilds it at the other size, rather than leaving a
      // 400% pin measured for a viewport that is no longer there.
      media.add({ motion: MOTION, compact: COMPACT }, (context) => {
        const { motion, compact } = context.conditions as {
          motion: boolean;
          compact: boolean;
        };

        // Reduced motion matched COMPACT and nothing else. Its own branch below
        // is what answers that preference.
        if (!motion) return;

        // The stage's real parent, read now and kept.
        //
        // It has to be read before anything below pins the stage, because
        // pinning changes the answer: ScrollTrigger wraps a pinned element in a
        // `.pin-spacer` of its own, so from the moment the pin exists
        // `stageRef.current.parentElement` is that spacer and not the
        // `min-h-dvh` column the stage was written into. Every use of it here
        // means the column — the element that is not a flex item of anything,
        // is never transformed, and whose flow footprint already spans the pin.
        // Reading it late gets the spacer instead, which is a flex item, is
        // moved by the pin, and is torn down and rebuilt on every refresh.
        const wrapper = stageRef.current?.parentElement ?? null;

        // Whether the labels should be on screen at all, as opposed to where
        // their glyphs are within the reveal. Everything that hides them —
        // SplitText's line clips, the glyph pose — only exists once this branch
        // has run, so the markup carries a `motion-safe:invisible` to cover the
        // server-rendered paint before it. From here on GSAP owns the property
        // inline, which outranks that class in both directions.
        //
        // Called once by hand on the trigger below as well as from `onToggle`,
        // because a toggle only reports a *change*: land inside the pin — a
        // reload partway down the page — and the trigger is simply born active,
        // with nothing to announce. Left to the callback alone the labels stay
        // hidden for the whole hold.
        // Only the two `fixed` ones. The place line lives inside the stage and
        // is carried off by the pin releasing, so it has no need of this — and
        // being hidden by it is exactly what used to take it off the screen the
        // instant it finished writing itself.
        const syncLabels = (self: ScrollTrigger) =>
          gsap.set([roleRef.current, craftRef.current], {
            visibility: self.isActive ? "visible" : "hidden",
          });

        // An empty tween is the whole of the timeline's own length. A scrub
        // stretches a timeline across its trigger whatever it contains, so
        // pinning the total at 1 is what lets every constant above be written
        // as a plain share of the pin — and keeps them meaning that even as
        // `autoSplit` tears the labels' tweens out and rebuilds them below.
        const reveal = gsap.timeline().to({}, { duration: 1 }, 0);

        // The photograph dollies up to the picture plane, pulls into focus and
        // is wiped in from below, all across exactly the span the type takes.
        //
        // `ease: "none"` for the same reason the labels' master is linear —
        // under a scrub the wheel is the easing. The glyphs could afford a
        // curve because each one's tween is a thirtieth of the pin; this one
        // runs the whole reveal, and a curve on it would read as the picture
        // lagging the scroll.
        reveal.fromTo(
          photoRef.current,
          { z: PHOTO_DEPTH, "--photo-reveal": 0 },
          { z: 0, "--photo-reveal": 1, ease: "none", duration: PHOTO_ARRIVE },
          0,
        );

        // Its own tween rather than another property on the one above, only
        // because it has to finish sooner. Two tweens can share a target
        // safely as long as they do not share a property — this one owns
        // `filter`, that one owns the transform and the wipe.
        //
        // Skipped outright on the compact build rather than shortened or
        // softened: a blur of any radius costs the same re-rasterisation per
        // tick, so a cheaper focus pull is not a thing that exists — see
        // PHOTO_BLUR. Nothing else has to change to leave it out, because the
        // photograph's resting state is already sharp and no other tween reads
        // `filter`.
        if (!compact) {
          reveal.fromTo(
            photoRef.current,
            { filter: `blur(${PHOTO_BLUR}px)` },
            { filter: "blur(0px)", ease: "none", duration: PHOTO_FOCUS },
            0,
          );
        }

        // The drawing goes the other way, toward the lens and out of the frame.
        // Its two layers keep the depth between them the whole way, so the
        // parallax the tilt gives them survives right up to the last frame they
        // are visible in.
        //
        // Explicit `fromTo` start values rather than letting GSAP read the
        // resting pose off the markup: it has to parse the authored transform
        // either way, and stating both ends means the scrub can be dropped into
        // the middle of the range — which is exactly what a reload halfway down
        // the page does — without the first tick guessing.
        reveal.fromTo(
          drawingRef.current,
          { z: 0 },
          {
            z: DRAWING_LIFT,
            autoAlpha: 0,
            ease: "none",
            duration: DRAWING_EXIT,
          },
          0,
        );

        reveal.fromTo(
          featuresRef.current,
          { z: FOREGROUND_DEPTH, scale: FOREGROUND_SCALE },
          {
            z: FOREGROUND_DEPTH + DRAWING_LIFT,
            // Held at its resting value so GSAP writes the compensation into
            // every frame it rebuilds the transform for. Dropped, the features
            // would jump up to their uncompensated size on the first tick.
            scale: FOREGROUND_SCALE,
            autoAlpha: 0,
            ease: "none",
            duration: FEATURES_EXIT,
          },
          FEATURES_DELAY,
        );

        // Splitting to lines as well as characters is what `mask` needs: it
        // wraps each line in a clip of exactly that line's box, so a glyph
        // sitting a line-height below its resting place is not faint, it is
        // absent. Type that rises out of a hard edge reads as machined; type
        // that fades up reads as a slideshow.
        //
        // `aria: "auto"` hands the paragraph an aria-label of its original text
        // and hides the per-glyph spans, so a screen reader still meets one
        // phrase rather than seventeen letters.
        const splits = [
          { ref: roleRef, at: ROLE_START, from: "start" as const },
          { ref: craftRef, at: CRAFT_START, from: "end" as const },
          // The place line is written by the same machinery as the other two —
          // same split, same wave, same per-glyph curve — because it is the
          // same voice arriving later, not a different kind of caption. It is
          // also what holds the timeline open past the exit, which is exactly
          // where PLACE_START puts it.
          { ref: placeRef, at: PLACE_START, from: "start" as const },
        ].map(({ ref, at, from }) =>
          SplitText.create(ref.current, {
            type: "lines,chars",
            mask: "lines",
            aria: "auto",
            // Re-splits when the webfont finally lands or the label rewraps at
            // a new width. Without it the first split — measured against the
            // fallback face — leaves line clips at the wrong height for the
            // type they are supposed to be hiding.
            autoSplit: true,
            // Runs once immediately and again on every re-split. Returning the
            // tween is what lets GSAP kill the stale one before building its
            // replacement, so a resize cannot leave two waves fighting over the
            // same glyphs.
            onSplit: (split) => {
              const wave = gsap.fromTo(split.chars, CHAR_FROM, {
                yPercent: 0,
                rotationX: 0,
                duration: CHAR_DURATION,
                ease: CHAR_EASE,
                stagger: {
                  // `amount`, not `each`: the two labels are 17 characters and
                  // 8, and a per-glyph delay would make the short one a flick
                  // and the long one a crawl. Spreading a fixed span over
                  // however many glyphs there are gives both the same sweep.
                  amount: CHAR_STAGGER,
                  // Each wave starts at the corner its label is parked in —
                  // top-left reads rightwards, bottom-right reads leftwards —
                  // so the two of them travel inwards and converge on the face
                  // they are describing.
                  from,
                },
              });

              // `fromTo` starts the tween on the global timeline; adding it
              // moves it under the scrub before any tick can advance it.
              reveal.add(wave, at);
              return wave;
            },
          }),
        );

        // The place line's `motion-safe:invisible` has done its job by here:
        // `gsap.fromTo` applies its start values the moment it is built, so
        // every glyph in the label above is already posed out of sight inside
        // its line clip, and the rule under them is a colour with `--underline`
        // still at 0. Nothing left to flash.
        //
        // Set once and never again, unlike `syncLabels` — the pin is not what
        // takes this one off the screen.
        gsap.set(placeRef.current, { visibility: "visible" });

        // Once both phrases have landed, the rest of the pin is spent driving
        // them out through opposite edges while the photograph stays where it
        // is. The paragraphs are `fixed`, so nothing carries them off on its
        // own — every bit of this is the timeline's doing.
        //
        // Two tweens rather than one on both elements: they share a clock and a
        // distance but not a direction, and a single tween cannot hold one
        // target's `yPercent` at +105 and the other's at -105.
        //
        // The target is the paragraph, not the glyphs. SplitText's waves own
        // `yPercent` on the chars, and a second tween on the same property of
        // the same elements would be two animations fighting over one number;
        // moving the block they sit in leaves each wave free to finish.
        [
          { ref: roleRef, to: -LABEL_EXIT_TRAVEL },
          { ref: craftRef, to: LABEL_EXIT_TRAVEL },
        ].forEach(({ ref, to }) =>
          reveal.fromTo(
            ref.current,
            { yPercent: 0 },
            { yPercent: to, ease: "none", duration: LABELS_EXIT },
            LABELS_EXIT_START,
          ),
        );

        // Where New York falls inside the map's frame, as a fraction of it.
        //
        // Measured off the DOM rather than projected by hand, because the
        // projection is `svg-dotted-map`'s and asking it twice — once to draw
        // the map, once to work out where the marker went — is both slower and
        // a second copy of a number that has to agree exactly with the first.
        // The map is already drawing a marker there; this reads back where.
        //
        // Read here, once, while the map is still at rest: this is the fraction
        // at scale 1, which is precisely what the origin and the flight path
        // below both need. And because the frame is held to the drawing's own
        // 2:1 ratio, the fraction survives every resize — see MAP_ASPECT.
        const markerFraction = () => {
          const marker = markerRef.current;
          const frame = mapFrameRef.current;
          if (!marker || !frame) return { x: 0.5, y: 0.5 };

          const m = marker.getBoundingClientRect();
          const f = frame.getBoundingClientRect();

          return {
            x: (m.left + m.width / 2 - f.left) / f.width,
            y: (m.top + m.height / 2 - f.top) / f.height,
          };
        };

        const marker = markerFraction();

        // How far the photograph has to travel from the centre of the stage to
        // land on that point, in px, on one axis.
        //
        // A function per axis so ScrollTrigger re-measures both on every
        // refresh — the distance is a viewport-sized number and nothing about
        // it survives a resize. Both rects are read off elements that never
        // carry an animated transform, so it does not matter where in the
        // scrub the refresh happens to catch things.
        const flight = (axis: "x" | "y") => () => {
          const frame = mapFrameRef.current;
          const rest = frameRef.current;
          if (!frame || !rest) return 0;

          const f = frame.getBoundingClientRect();
          const r = rest.getBoundingClientRect();

          return axis === "x"
            ? f.left + marker.x * f.width - (r.left + r.width / 2)
            : f.top + marker.y * f.height - (r.top + r.height / 2);
        };

        // Growing about New York rather than about the map's own centre. The
        // photograph is flying to a point that is still moving otherwise, and
        // the two only agree at the very last frame — which reads as the
        // headshot sliding off its mark and then catching it.
        gsap.set(mapRef.current, {
          transformOrigin: `${marker.x * 100}% ${marker.y * 100}%`,
        });

        reveal.fromTo(
          mapRef.current,
          { autoAlpha: 0, scale: MAP_SCALE_FROM },
          { autoAlpha: 1, scale: 1, ease: "none", duration: LABELS_EXIT },
          LABELS_EXIT_START,
        );

        // The photograph retreats as the type leaves and the map arrives, and
        // flies to New York as it goes — it is not a headshot being tidied
        // away, it is a headshot becoming the map's marker, which is why the
        // shrink, the corner radius and the flight are one tween on one clock.
        //
        // Its own tween rather than more properties on the dolly above, which
        // is long finished by here. They share the element's transform safely:
        // GSAP keeps the components separately, and that one owns `z` while
        // this owns `scale`, `x` and `y`.
        reveal.fromTo(
          photoRef.current,
          { scale: 1, borderRadius: 48, x: 0, y: 0 },
          {
            scale: PHOTO_SHRINK,
            borderRadius: PHOTO_RADIUS,
            x: flight("x"),
            y: flight("y"),
            ease: "none",
            duration: LABELS_EXIT,
          },
          LABELS_EXIT_START,
        );

        // And the head stops following the pointer — see TILT_RELEASE. The
        // scene's authored transform multiplies both axes by this, so taking it
        // to 0 leaves the rotations at exactly 0deg and the card square on.
        reveal.fromTo(
          sceneRef.current,
          { "--tilt-strength": 1 },
          { "--tilt-strength": 0, ease: "none", duration: TILT_RELEASE },
          LABELS_EXIT_START,
        );

        // The place label is `absolute` inside the stage and deliberately
        // hangs past the stage's own bottom edge by PLACE_BOTTOM — see that
        // constant for why: while the stage is pinned, that overflow is the
        // gap between the stage's box and the actual bottom of the screen,
        // and the label needs to reach past the box to land there.
        //
        // Nothing about the stage's own flow height accounts for that
        // overflow, though. Once the pin releases, the stage resumes normal
        // flow exactly where the pin left it, and whatever comes after it in
        // the document — MyWork — starts flush against the stage's box,
        // with the label still hanging into the space above it. Reserving
        // that space is the fix, not moving the label: the label's position
        // is load-bearing for the pinned handoff, so the stage's flow
        // footprint is what has to grow to match it.
        //
        // Measured rather than derived from PLACE_BOTTOM directly, because
        // the formula only accounts for the gap below the stage's box — not
        // the label's own rendered height on top of that, which depends on
        // the text, the font and the breakpoint. The overflow between two
        // rects is invariant under whatever transform the pin is currently
        // applying to the stage (it moves both rects equally), so this is
        // safe to read at any scroll position, not just at rest.
        //
        // Written onto the stage's *parent* rather than the stage itself —
        // that matters. The stage is a `flex-1` child of the header's
        // `min-h-dvh flex flex-col` wrapper, filling exactly whatever the
        // header leaves of one viewport; margin counts toward a flex item's
        // own footprint, so a margin-bottom on the stage would eat into that
        // same allocation and shrink the stage's content box by roughly what
        // it just added. PLACE_BOTTOM's `100%` resolves against that same
        // box, so the stage quietly shrinking out from under it pushes the
        // label's bottom edge past the viewport during the pin — the label
        // reads as clipped, cut off by the edge of the screen, not by any
        // overflow rule. The wrapper is not itself a flex item of anything,
        // so a margin on it only adds space after the hero in the page's own
        // flow, leaving the stage's carefully-calibrated height untouched.
        //
        // Which is why it uses the `wrapper` captured at the top of this branch
        // rather than reading `stage.parentElement` here. This runs again on
        // every refresh, and by the second one the pin exists — so the parent it
        // used to find is the `.pin-spacer`, which is a flex item of the column
        // and therefore exactly the element the paragraph above explains the
        // margin must not go on. The reserved space was landing on the spacer,
        // where it shrinks the stage instead of following it.
        const fitStageToLabel = () => {
          const stage = stageRef.current;
          const place = placeRef.current;
          if (!stage || !place || !wrapper) return;

          const overflow =
            place.getBoundingClientRect().bottom -
            stage.getBoundingClientRect().bottom;
          wrapper.style.marginBottom = `${Math.max(0, overflow)}px`;
        };

        // Hung off the same refresh event `invalidateOnRefresh` below relies
        // on, so a resize or a font load that changes the label's height
        // re-measures the reserved space along with everything else the
        // refresh recomputes.
        ScrollTrigger.addEventListener("refresh", fitStageToLabel);
        fitStageToLabel();

        const pin = ScrollTrigger.create({
          trigger: stageRef.current,
          // The headshot starts below the header rather than centred, so the
          // pin waits until scrolling has carried it to the middle of the
          // viewport — which happens once half the header has gone.
          start: "center center",
          end: compact ? PIN_LENGTH_COMPACT : PIN_LENGTH,
          pin: true,
          // Leaves a spacer the height of the pin, so everything below simply
          // carries on in normal flow once the hold is over.
          pinSpacing: true,
          anticipatePin: 1,
          // Re-reads the function-based values above on every refresh, so a
          // rotated phone or a resized window measures the photograph's flight
          // against the geometry it actually has. Without it the headshot would
          // keep flying the distance the page happened to load at, and land
          // somewhere off New York the moment the window changes size.
          invalidateOnRefresh: true,
          // Hung off the same trigger as the pin rather than a second one of
          // its own: one start and one end means the labels cannot drift out of
          // step with the headshot they belong to, and pinning moves the
          // trigger element in a way a separate ScrollTrigger would have to
          // measure around.
          animation: reveal,
          // Ties progress to scroll position instead of playing on entry, which
          // is what lets scrolling back up run the reveal in reverse.
          scrub: true,
          // Being fixed to the screen, the labels have nothing to scroll them
          // out of the way once the hero is done with them — past the end of
          // the pin the scrub stops updating and leaves them sitting over
          // whatever comes next. Tying them to the trigger's own active window
          // sends them away with the headshot they annotate, and brings them
          // back, mid-reveal, on the way up.
          onToggle: syncLabels,
        });

        // The trigger has measured itself by the time `create` returns, so this
        // is where the labels get their opening state — see `syncLabels`.
        syncLabels(pin);

        // `will-change` is a standing cost, so it is scoped to the window where
        // it buys something.
        //
        // Both of these carry an animated transform — the scene's is written by
        // the tilt spring, the photograph's by the scrub — and the hint asks the
        // browser to keep each one on a compositor layer of its own so those
        // writes never repaint anything. That is worth having while they move.
        // Left on as a static class, though, it is a promise that outlives the
        // hero by the whole length of the page: the layers and the GPU memory
        // behind them stay allocated long after the last thing that could
        // animate them has scrolled away. On a phone that memory is scarce
        // enough that browsers give up and stop honouring the hint at all, which
        // is the one outcome the class was meant to prevent.
        //
        // The window is the hero's own passage through the viewport rather than
        // the pin's active span, because the tilt starts moving the scene as
        // soon as the pointer does — which is before the pin has begun and after
        // it has released. It also has to be a hint the browser is given
        // *ahead* of the movement; set at the instant the animation starts it
        // arrives too late to have prepared anything.
        //
        // Hung off the wrapper rather than the stage, deliberately: the stage is
        // the pinned element, and ScrollTrigger holds a pinned element still by
        // transforming it. A second trigger measuring the same element has to
        // reason about that transform and about which of the two refreshes
        // first. The wrapper is never pinned and its flow footprint already
        // spans the hero and the pin's spacer, so it says the same thing without
        // any of the ordering to get wrong.
        const layers = [sceneRef.current, photoRef.current];

        // Called by hand as well as from `onToggle`, for the same reason
        // `syncLabels` is: a toggle reports a change, and the hero is the top of
        // the page — so on an ordinary load the trigger is simply born active
        // and has nothing to announce. Left to the callback alone the hint would
        // never be applied on the one visit where the hero is on screen from the
        // first frame.
        const syncWillChange = (self: ScrollTrigger) =>
          gsap.set(layers, {
            willChange: self.isActive ? "transform" : "auto",
          });

        const promote = ScrollTrigger.create({
          trigger: wrapper,
          start: "top bottom",
          end: "bottom top",
          // Refreshes after the pin, and it has to.
          //
          // The wrapper only reaches its full height once the pin has inserted
          // its spacer inside it — before that it is one viewport of header and
          // stage, and `bottom top` resolves to a few hundred pixels down the
          // page. ScrollTrigger refreshes in creation order unless told
          // otherwise, and both of these are rebuilt on every refresh, so
          // without a priority this one measures a wrapper the pin has not
          // finished growing yet and spends the whole hero already past its own
          // end — releasing the hint at the exact moment the scrub needs it.
          //
          // Negative rather than a positive on the pin, so the pin keeps the
          // default priority it shares with everything else on the page and
          // this trigger is the only one making a claim about ordering.
          refreshPriority: -1,
          onToggle: syncWillChange,
        });

        syncWillChange(promote);

        // Reverting the media context kills the tweens but leaves the markup
        // SplitText built — including the resize and font-load listeners
        // `autoSplit` registered. These put the original text back.
        return () => {
          ScrollTrigger.removeEventListener("refresh", fitStageToLabel);
          wrapper?.style.removeProperty("margin-bottom");
          splits.forEach((split) => split.revert());
        };
      });

      media.add("(prefers-reduced-motion: reduce)", () => {
        // The photograph is content, not decoration, so this branch still has
        // to deliver it — withholding it would be reading the preference as
        // "show me less" rather than as "do not move large areas of the screen
        // at me". What it drops is the motion: no pin, no dolly toward the
        // camera, no focus pull, and no wipe. The mask is parked wide open and
        // the swap is a plain opacity cross-fade.
        gsap.set(photoRef.current, { "--photo-reveal": 1, autoAlpha: 0 });

        gsap
          .timeline({
            scrollTrigger: {
              trigger: stageRef.current,
              // No pin here means no PIN_LENGTH hold to scrub against, so the
              // swap is hung off the stage's own passage up the viewport
              // instead.
              start: "center center",
              end: "bottom top",
              scrub: true,
            },
          })
          .to(photoRef.current, { autoAlpha: 1, ease: "none" }, 0)
          .to(
            [drawingRef.current, featuresRef.current],
            { autoAlpha: 0, ease: "none" },
            0,
          );
      });

      return () => media.revert();
    },
    // `revertOnUpdate` so the empty first pass is torn down cleanly before the
    // real one runs, rather than the two being left stacked on the same
    // elements.
    {
      scope: stageRef,
      dependencies: [overlay, mapReady],
      revertOnUpdate: true,
    },
  );

  return (
    <>
      {/* `fixed`, so the two of them sit in the corners of the screen. The
          stage is shorter than the viewport — the header takes the rest — so
          hanging them inside it would inset them by half that difference, top
          and bottom.

          Being `fixed` is not on its own enough to get them there. A transform
          of any kind, identity included, makes an element the containing block
          for the `fixed` descendants beneath it, and on this route there are
          two such elements above these labels in the tree: ScrollTrigger holds
          the pinned stage with a transform, and ScrollSmoother scrolls the page
          by translating `#smooth-content`, which wraps everything the route
          renders. Being written as siblings of the stage clears the first;
          nothing written anywhere inside the route clears the second.

          So they are not left where they are written. The portal hands them to
          `<body>`, outside the smooth content altogether, where nothing between
          them and the viewport carries a transform, filter or perspective —
          which is the only place `fixed` still means the screen. They keep
          their refs, so the timeline above goes on driving them exactly as it
          did when they were rendered here.

          Painted over the smooth wrapper rather than under it: the wrapper is
          itself `fixed` and comes first in the body, and `z-10` against its
          `auto` settles the order regardless.

          `motion-safe:invisible` is what keeps them off the first paint.
          Everything that holds a glyph out of sight — the line clips SplitText
          wraps them in, the pose it starts them from — is built by JavaScript,
          so before the timeline exists the browser has nothing but two finished
          paragraphs to draw, and draws them. Under the same media query the
          branch that hides them runs, so a visitor who asked for reduced
          motion, whose branch never poses anything, still gets both labels. */}
      {overlay &&
        createPortal(
          <>
            <p
              ref={roleRef}
              className="fixed top-0 left-0 z-10 p-6 md:p-10 font-aeonik-regular uppercase tracking-tight text-6xl md:text-7xl lg:text-8xl 2xl:text-9xl motion-safe:invisible"
            >
              Software Engineer
            </p>
            <p
              ref={craftRef}
              className="fixed bottom-0 text-right right-0 z-10 p-6 md:p-10 font-aeonik-regular uppercase tracking-tight text-6xl md:text-7xl lg:text-8xl 2xl:text-9xl motion-safe:invisible"
            >
              Who Designs
            </p>
          </>,
          overlay,
        )}
      {/* Takes whatever the header leaves of the first screen, so the two of
          them fill exactly one viewport on landing. ScrollTrigger carries the
          size over to the pin, so the headshot never changes size as it pins
          and unpins. */}
      <div
        ref={stageRef}
        className="relative flex-1 min-h-0 flex justify-center"
      >
        {/* The map is the destination, so it lives in the stage and gets
            pinned along with it — that is what keeps New York nailed to the
            same screen position the photograph is flying at.

            The outer box fills the stage and does two jobs: it is the size
            container MAP_WIDTH sizes the frame against, and it clips — which
            should never come to anything now the frame is sized to fit, but
            costs nothing and keeps the map's arrival off the header if it ever
            does. Clipping cannot move the marker inside its own frame either
            way, so the measurements above are indifferent to it.

            Decorative: the label the map exists to deliver is the headshot's
            own alt text plus the copy around it, and a screen reader has no
            use for five thousand dots. */}
        <div
          aria-hidden
          className="absolute inset-0 overflow-hidden pointer-events-none"
          // The size container MAP_WIDTH measures itself against: this box is
          // the stage, so `cqw` and `cqh` are the stage's own two dimensions.
          style={{ containerType: "size" }}
        >
          <div
            ref={mapFrameRef}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ width: MAP_WIDTH, aspectRatio: MAP_ASPECT }}
          >
            {/* Opacity inline rather than as a class so it is the same
                declaration GSAP goes on to own — and so the map is absent from
                the server-rendered paint instead of flashing in at full
                strength before the timeline's first tick.

                Under `prefers-reduced-motion` nothing ever animates it and it
                simply stays away: that branch keeps the headshot at full size,
                where a world map behind it would be a backdrop to a picture
                that covers its middle rather than a place to put a marker. */}
            {/* The wrapper is always rendered and the map inside it is not —
                see `mapReady`. That split is the point: `mapRef` has to exist
                for the timeline to find, and the layer has to be there for the
                measurements around it to resolve against, but neither needs a
                single dot drawn to be true. */}
            <div ref={mapRef} className="size-full" style={{ opacity: 0 }}>
              {mapReady && (
                <DottedMap
                  markers={NEW_YORK}
                  // One decision, not two: the sample count sets the spacing of
                  // the grid and the radius has to stay under half of it, or
                  // neighbouring dots touch and the coastlines silt up into
                  // solid shapes. Raising the count without pulling the radius
                  // in gives a denser map that reads as a blurrier one.
                  mapSamples={compact ? MAP_SAMPLES_COMPACT : MAP_SAMPLES}
                  dotRadius={compact ? MAP_DOT_RADIUS_COMPACT : MAP_DOT_RADIUS}
                  className="size-full text-neutral-400"
                  // The map is a backdrop, and a backdrop with a visible corner
                  // is a rectangle sitting on the page. Fading the dots out to
                  // nothing towards the edges — rather than painting the page's
                  // own white over them — means the softening survives whatever
                  // ends up behind it.
                  //
                  // MAP_FADE_START is late for a vignette: the drawing runs very
                  // nearly the full width of its box, so an early falloff starts
                  // eating Alaska and New Zealand rather than the empty ocean
                  // around them.
                  fade
                  fadeStart={MAP_FADE_START}
                  // The photograph is the marker, so the map's own is drawn at
                  // zero size in nothing at all. It still has to exist: it is
                  // what puts a projected x/y on screen for `markerFraction` to
                  // read, and `renderMarkerOverlay` only runs for a real marker.
                  markerColor="transparent"
                  renderMarkerOverlay={({ x, y }) => (
                    <circle ref={markerRef} cx={x} cy={y} r={0.5} fill="none" />
                  )}
                />
              )}
            </div>
          </div>
        </div>
        {/* The third corner, and the only one of the three that belongs to the
            map rather than to the portrait — so it is the only one inside the
            stage. That is what makes it behave like the map and the headshot
            do: the pin holds it while the caption writes itself on, and then
            releases all three together and the whole picture scrolls away as
            one. The other two are `fixed` to the viewport and have to be taken
            off by hand, which is why they sit outside.

            `absolute` and not `fixed`, because ScrollTrigger pins by putting a
            transform on this element — and a transform makes it the containing
            block for any `fixed` descendant, so `fixed` in here would resolve
            against the stage anyway and only confuse the reading of it.

            Hung below the stage's own bottom edge by PLACE_BOTTOM, which lands
            it on the bottom of the screen — the corner it had when it was
            `fixed`, and the corner the label it takes over from vacates. */}
        <p
          ref={placeRef}
          className="absolute left-0 z-10 p-6 md:p-10 font-aeonik-regular uppercase tracking-tight text-6xl md:text-7xl lg:text-8xl 2xl:text-9xl motion-safe:invisible text-neutral-600"
          style={{ bottom: PLACE_BOTTOM }}
        >
          From <br />
          <span className="cursor-pointer text-black font-aeonik-medium">
            New York City
          </span>
        </p>
        {/* Perspective lives on a wrapper that is exactly the scene's box, so
            the vanishing point sits at the headshot's centre no matter how the
            row around it is laid out. `relative` lifts it over the map, which
            is positioned and would otherwise paint on top of it. */}
        <div
          ref={frameRef}
          className="relative h-full aspect-square max-w-full perspective-distant"
        >
          {/* Both SVGs share a 1:1 viewBox with `preserveAspectRatio="xMidYMid
              meet"`, so rendering them into the same square box lines their
              artwork up exactly, whatever size that box ends up. The photograph
              is a 1:1 raster, so it lands on the same grid. */}
          <div
            ref={sceneRef}
            className="relative size-full transform-3d"
            style={
              {
                // `--tilt-strength` is the scrubbed fader on the whole swing —
                // 1 while the head is a head, 0 once it has become a card. It
                // sits in the same `calc` as the tilt itself so releasing it
                // costs nothing per frame and cannot fall out of step with the
                // spring writing `--tilt-x` / `--tilt-y` onto this element.
                "--tilt-strength": 1,
                transform:
                  `rotateX(calc(var(--tilt-y, 0) * var(--tilt-strength, 1) * ${SWING.rotateX}deg)) ` +
                  `rotateY(calc(var(--tilt-x, 0) * var(--tilt-strength, 1) * ${SWING.rotateY}deg))`,
              } as CSSProperties
            }
          >
            {/* First in the markup, but that is not what puts it at the back:
                inside `transform-3d` the layers paint by depth, and this one
                spends the whole transition at or behind z=0 while the drawing
                spends it climbing to +190. DOM order only decides ties.

                It carries the real alt text and the drawing is marked
                decorative, because the two are the same subject and a screen
                reader should meet it once. */}
            <Image
              ref={photoRef}
              src={headshotPhoto}
              alt="Ray"
              loading="eager"
              fill
              // The box is square and as tall as the stage, so its width tracks
              // the viewport's height rather than its width.
              sizes="100vh"
              className="block pointer-events-none object-contain"
              style={
                {
                  "--photo-reveal": 0,
                  maskImage: PHOTO_MASK,
                  WebkitMaskImage: PHOTO_MASK,
                  maskSize: "100% 100%",
                  WebkitMaskSize: "100% 100%",
                } as CSSProperties
              }
            />
            <Image
              ref={drawingRef}
              src={kawaiiHeadshotBackground}
              alt=""
              aria-hidden
              loading="eager"
              fill
              className="block pointer-events-none object-contain"
              style={{ transform: "translateZ(0px)" }}
            />
            <Image
              ref={featuresRef}
              src={kawaiiHeadshotForeground}
              alt=""
              aria-hidden
              loading="eager"
              fill
              className="block pointer-events-none object-contain"
              style={{
                transform: `translateZ(${FOREGROUND_DEPTH}px) scale(${FOREGROUND_SCALE})`,
                filter: compact ? FOREGROUND_SHADOW_COMPACT : FOREGROUND_SHADOW,
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
