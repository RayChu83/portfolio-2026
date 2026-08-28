"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

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
 *
 * Driven by GSAP's ScrollTrigger rather than `motion`'s `useScroll`, so the
 * page runs one scroll-observation system instead of two — this scale and the
 * description crossfade were the only two things `motion` shipped for.
 */
export default function Header() {
  const ref = useRef<HTMLElement>(null);
  const scaledRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const media = gsap.matchMedia();

      // Reduced motion keeps the greeting at full size — the shrink is
      // decoration, not content.
      media.add("(prefers-reduced-motion: no-preference)", () => {
        // Scrubbed over exactly the scroll it takes for the header to travel
        // up and out of the viewport, so the ramp tracks the type's own size
        // at every breakpoint instead of a number tuned for one of them.
        // `ease: "none"` because under a scrub the wheel is the easing.
        const tween = gsap.fromTo(
          scaledRef.current,
          { scale: 1 },
          {
            scale: MIN_SCALE,
            ease: "none",
            scrollTrigger: {
              // The measured element and the scaled one have to be different
              // boxes: a scroll range read off an element that the same range
              // is busy shrinking feeds its own output back into its input.
              // The <header> keeps its layout box — and so a fixed scroll
              // range — while the child does the moving.
              trigger: ref.current,
              start: "top top",
              end: "bottom top",
              scrub: true,
            },
          },
        );

        return () => {
          tween.scrollTrigger?.kill();
          tween.kill();
        };
      });

      return () => media.revert();
    },
    { scope: ref },
  );

  return (
    <header ref={ref} className="pt-20 pb-4">
      <div ref={scaledRef} className="origin-top">
        <p className="text-center text-xl mb-4 text-neutral-700">
          Software Engineer • NYC
        </p>
        <h1 className="text-center font-aeonik-regular tracking-tighter mb-8">
          <span className="text-neutral-600 text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl">
            Hey there,
          </span>
          <br />{" "}
          <span className="text-black! text-6xl lg:text-7xl xl:text-8xl 2xl:text-9xl">
            I&apos;m Ray
          </span>
        </h1>
        {/* `motion-reduce:hidden`: the tilt this line invites is disabled
            under the preference (useTilt returns before attaching anything),
            and copy promising an effect that will not run is worse than no
            copy. A media query, like the swap inside, so the server and
            client agree. */}
        <h4 className="text-center text-2xl md:text-3xl font-aeonik-regular tracking-tight motion-reduce:hidden">
          {/* Swapped by media query rather than by feature detection, so the
              server and client render the same markup. */}
          <span className="[@media(hover:none)]:hidden">
            Try to move your mouse
          </span>
          <span className="hidden [@media(hover:none)]:inline">
            Try to tilt your device
          </span>
        </h4>
      </div>
    </header>
  );
}
