import type { CSSProperties } from "react";

/**
 * Everything the animated hero and the static one both need.
 *
 * The two builds are separate components — see `HeroHeadshot.tsx` for why —
 * which means every number they have in common is a number that can drift.
 * The illustration's depth pair, the map's frame and the photograph's final
 * corner radius are all things the static build has to reproduce *exactly*, or
 * it stops being the same picture held still and starts being a second design
 * that merely resembles the first. They live here so there is one of each.
 *
 * Constants that only one build can possibly use — the pin's length, the
 * glyph waves' timings, the flight to New York — stay with that build.
 */

/**
 * Camera distance in px. Must stay in step with the `perspective-distant`
 * utility on the scene wrapper, which Tailwind defines as 1200px — the maths
 * below reads depth as a fraction of it.
 */
const PERSPECTIVE = 1200;

/** How far in front of the head the face features float, in px. */
export const FOREGROUND_DEPTH = 70;

/**
 * A layer at +z projects larger by PERSPECTIVE / (PERSPECTIVE - depth). Scaling
 * it back by the inverse keeps the features registered to the head at rest, so
 * depth changes only how they slide when the head turns — not how big they are.
 *
 * Which is why the static build keeps the pair too: it is not an animation, it
 * is the pose that puts the eyes and mouth on the face at the right size. A
 * static build that dropped it would render the features visibly too large.
 */
export const FOREGROUND_SCALE = (PERSPECTIVE - FOREGROUND_DEPTH) / PERSPECTIVE;

/**
 * The features float in front of the head, so they cast onto it. The offset
 * leans against the tilt — the shadow pools on the side the layer has slid away
 * from — over a small fixed offset that keeps a light source overhead at rest.
 */
export const FOREGROUND_SHADOW =
  "drop-shadow(calc(var(--tilt-x, 0) * -8px + 2px) " +
  "calc(var(--tilt-y, 0) * -8px + 3px) 4px rgb(0 0 0 / 0.2))";

/**
 * The same shadow with the lean taken out of it.
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
 *
 * Used by the compact animated build for that saving, and by the static build
 * unconditionally: `useTilt` never writes `--tilt-x` / `--tilt-y` under the
 * preference, so the leaning form would resolve against its own `0` fallbacks
 * and render as this string anyway. Stating it outright says so, and spares
 * the browser a filter that reads variables nothing sets.
 */
export const FOREGROUND_SHADOW_COMPACT =
  "drop-shadow(2px 3px 4px rgb(0 0 0 / 0.2))";

/**
 * The corner radius the photograph carries once it has become the map's
 * marker. Large enough to round any square it is applied to completely, which
 * is what both builds want of it — the animated one arrives here at the end of
 * the shrink, the static one is simply born here.
 */
export const PHOTO_RADIUS = 300;

/**
 * How far the photograph sits in from the edges of the box it is given.
 *
 * The photograph is the one graphic here that is a *filled* rectangle — a head
 * on a grey studio backdrop, opaque corner to corner. The drawing beside it is
 * linework on transparency and carries its own margin in the artwork, so the
 * two need different treatment to read as equally placed: held to the same
 * box, the photograph looks jammed against the edges while the drawing looks
 * composed. This is the difference.
 *
 * Applied as explicit geometry rather than as padding on a wrapper, and it has
 * to be. Both builds render the photograph with next/image's `fill`, which is
 * `position: absolute` with the insets zeroed — and an absolutely positioned
 * box resolves its insets against its container's *padding box*, so padding on
 * the wrapper is space the image is laid over rather than space it is held
 * out of. Setting the insets directly is what actually moves it.
 */
export const PHOTO_INSET = "2rem";

/**
 * The corner radius the photograph carries at rest, before anything animates
 * it.
 *
 * The same 48 the animated build's shrink already tweens *from*, so the two
 * agree: the photograph is a rounded card the whole way through, and the
 * shrink rounds it further into a marker rather than rounding it from nothing.
 * Before this the resting corner was square and the tween's first tick jumped
 * it to 48.
 */
export const PHOTO_RADIUS_REST = 48;

/**
 * The photograph's box, shared so the two builds cannot drift.
 *
 * This is why neither build gives the photograph next/image's `fill`, while
 * both still give it to the drawing layers beside it. `fill` is a fixed
 * recipe — `position: absolute`, insets zeroed, `width: 100%`, `height: 100%`
 * — and Next refuses to have any of it overridden, warning that "images with
 * fill always use width 100% - it cannot be modified". Every part of that
 * recipe except the positioning is a thing this box needs to state
 * differently. A static import already carries the file's intrinsic
 * dimensions, so `fill` was only ever supplying the positioning anyway, and
 * the rule below supplies it instead. `sizes` still applies: it is what builds
 * the srcset, and it does not depend on `fill`.
 *
 * `width` and `height` are stated rather than left `auto` because the element
 * is replaced: for an absolutely positioned replaced element `width: auto`
 * resolves to the image's *intrinsic* width, not to the width its own insets
 * imply, so the insets alone would leave the photograph at its natural pixel
 * size and overflowing the frame.
 */
export const PHOTO_BOX: CSSProperties = {
  position: "absolute",
  inset: PHOTO_INSET,
  width: `calc(100% - 2 * ${PHOTO_INSET})`,
  height: `calc(100% - 2 * ${PHOTO_INSET})`,
  borderRadius: PHOTO_RADIUS_REST,
};

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
 * Deliberately not a `prefers-reduced-motion` check. That preference is
 * answered a level up, by `HeroHeadshot` choosing an entirely different
 * component. This is a statement about the frame budget, and the answer to it
 * is the same reveal built out of cheaper parts — nobody is being shown less
 * because of it.
 */
export const COMPACT = "(max-width: 1023px), (pointer: coarse)";

/**
 * The dotted world map, precomputed at build time by `scripts/generate-map.mjs`
 * — sampling the world raster took the better part of a second of blocked main
 * thread on a fast desktop, and several on a phone. Each density ships as a
 * single SVG path (dots baked in as circle subpaths) plus New York's position
 * as a fraction of the 2:1 frame, so the client neither samples anything nor
 * measures the DOM to find the marker.
 */
export type MapData = {
  width: number;
  height: number;
  path: string;
  marker: { x: number; y: number };
};

/**
 * The map is drawn on a 2:1 viewBox and its frame is held to exactly that
 * ratio, so the SVG fills the frame with no letterboxing. That is what makes
 * New York's position a fixed *fraction* of the frame, measured once and true
 * at every viewport size — the alternative, `preserveAspectRatio` centring a
 * 2:1 drawing inside whatever box the stage happens to be, moves the marker
 * around inside its own container every time the window changes shape.
 *
 * Both builds depend on that invariant, by different means: the animated one
 * flies the photograph to `marker` as a measured pixel distance, the static
 * one places the marker at `marker` as a CSS percentage. Neither is correct if
 * the frame is not exactly 2:1.
 */
export const MAP_ASPECT = "2 / 1";

/**
 * How wide the map's frame is. Only the width is set — the ratio above derives
 * the height from it — because a box given both a definite height and a
 * `max-width` stops honouring its ratio, and a frame that is no longer 2:1
 * puts the letterboxing back and breaks the invariant that whole approach
 * rests on.
 *
 * `cq` units, off a size container on the layer around it, are what let one
 * declaration say "as wide as the box around it, but never taller than it":
 * that box is the header's leftovers rather than any fraction of the viewport,
 * so `dvh` cannot express its height and `%` cannot compare across the two
 * axes.
 *
 * The 0.9 is margin. Held to exactly its container the map's poles graze the
 * top and bottom edges, which reads as a map that did not fit rather than one
 * placed there.
 */
export const MAP_WIDTH = "calc(min(100cqw, 200cqh) * 0.9)";

/**
 * Where the map's dots start fading out, as a fraction of the way from its
 * centre to its edge. Everything inside this is at full strength; from here to
 * the edge the dots thin to nothing, so the map has no border to notice.
 *
 * The falloff is an ellipse fitted to the map's 2:1 box, not a circle, which
 * is what keeps the fade the same depth on all four sides.
 */
export const MAP_FADE_START = 0.75;
