"use client";

import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { useRef } from "react";

/** How small the greeting gets once the shrink has run its course. */
const MIN_SCALE = 0.6;

/**
 * The page's greeting, which shrinks as the visitor scrolls away from it.
 *
 * The shrink is a transform, not a font-size change: it leaves the header's
 * layout box exactly where the document flow put it, so nothing below shifts
 * as the text scales, and the whole thing stays on the compositor. It also
 * scales the two type sizes together, which keeping a pair of `font-size`
 * ramps in step would not.
 */
export default function Header() {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();

  // Measured against the header itself rather than a fixed pixel distance:
  // progress runs 0 → 1 over exactly the scroll it takes for the header to
  // travel up and out of the viewport, so the ramp tracks the type's own size
  // at every breakpoint instead of a number tuned for one of them.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const scale = useTransform(scrollYProgress, [0, 1], [1, MIN_SCALE]);

  return (
    // The measured element and the scaled one have to be different boxes: a
    // scroll range read off an element that the same range is busy shrinking
    // feeds its own output back into its input, and the scale snaps between
    // its endpoints instead of easing across them. The <header> keeps its
    // layout box — and so a fixed scroll range — while the child does the
    // moving.
    <header ref={ref} className="pt-20 pb-4">
      <motion.div
        className="origin-top"
        // `useTransform` clamps at the ends, so this parks at MIN_SCALE rather
        // than collapsing further once the header has scrolled past.
        style={{ scale: reduceMotion ? 1 : scale }}
      >
        <h1 className="text-center font-aeonik-regular tracking-tight mb-8">
          <span className="text-neutral-600 text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl">
            Hey there,
          </span>
          <br />{" "}
          <span className="text-black! text-6xl lg:text-7xl xl:text-8xl 2xl:text-9xl">
            I&apos;m Ray
          </span>
        </h1>
        <h4 className="text-center text-2xl md:text-3xl font-aeonik-regular tracking-tight">
          {/* Swapped by media query rather than by feature detection, so the
              server and client render the same markup. */}
          <span className="[@media(hover:none)]:hidden">
            Try to move your mouse
          </span>
          <span className="hidden [@media(hover:none)]:inline">
            Try to tilt your device
          </span>
        </h4>
      </motion.div>
    </header>
  );
}
