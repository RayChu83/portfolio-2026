"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { useRef } from "react";
import designerIcon from "../../../public/designer.png";
import profileIcon from "../../../public/icon-192.png";
import softwareEngineerIcon from "../../../public/softwareEngineer.png";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/** How small the greeting gets once the shrink has run its course. */
const MIN_SCALE = 0.6;

/**
 * The page's greeting, which cascades in line by line on load — each line
 * rising into focus with a short stagger, the icons popping in as a separate
 * accent beat, the location line closing things out with its underline — and
 * shrinks as the visitor scrolls away from it.
 *
 * The entrance and the shrink live on the same element and the same GSAP
 * scope, but are otherwise unrelated: the entrance plays once, immediately,
 * outside any ScrollTrigger, while the shrink is scrubbed to scroll position
 * and works purely through `transform`.
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
        // The load-in: every word and icon cascades in as its own beat, in
        // document order, instead of three big line-groups revealing
        // together. Text words resolve via blur + rise + fade — never a
        // clip-path or mask sweep, which have a hard binary edge (clipped vs.
        // not) with no feathering, so a sweep reads as a literal line cutting
        // through the glyphs as it travels. Blur/opacity/y all vary
        // uniformly across the whole word instead, so there's no boundary to
        // see. Icons get a separate scale/rotate pop, and — sharing no
        // clipped ancestor with the text — their `back.out` overshoot is
        // never cut off at a box edge either.
        const entrance = gsap.timeline({ defaults: { ease: "power3.out" } });
        const pieces = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            ".hero-word, .hero-icon",
          ) ?? [],
        );
        const WORD_STAGGER = 0.07;

        pieces.forEach((el, i) => {
          if (el.classList.contains("hero-icon")) {
            entrance.fromTo(
              el,
              { scale: 0, rotate: -18, opacity: 0 },
              {
                scale: 1,
                rotate: 0,
                opacity: 1,
                duration: 0.55,
                ease: "back.out(2.4)",
              },
              i * WORD_STAGGER,
            );
          } else {
            entrance.fromTo(
              el,
              { y: 26, opacity: 0, filter: "blur(8px)" },
              { y: 0, opacity: 1, filter: "blur(0px)", duration: 0.65 },
              i * WORD_STAGGER,
            );
          }
        });

        entrance
          .set(".hero-word", { filter: "none" })
          .fromTo(
            ".hero-sub",
            { y: 16, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.5 },
            "-=0.35",
          )
          .fromTo(
            ".hero-underline",
            { scaleX: 0, transformOrigin: "left" },
            { scaleX: 1, duration: 0.45, ease: "power2.inOut" },
            "-=0.2",
          );

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
          entrance.kill();
        };
      });

      return () => media.revert();
    },
    { scope: ref },
  );

  return (
    <header
      ref={ref}
      className="h-dvh py-24 px-4 flex flex-col items-center justify-center"
    >
      <div ref={scaledRef} className="origin-center">
        <h1 className="text-center font-aeonik-regular tracking-tighter flex flex-col gap-4 mb-12">
          <span className="text-neutral-900 text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl">
            <span className="hero-word inline-block">Hey,</span>{" "}
            <span className="hero-word inline-block">I&apos;m</span>{" "}
            <Image
              src={profileIcon}
              alt=""
              aria-hidden
              className="hero-icon inline-block size-[1em] rounded-full object-cover align-[-0.2em] mx-[0.05em]"
            />{" "}
            <span className="hero-word inline-block">Ray.</span>
          </span>{" "}
          <span className="text-neutral-900 text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl">
            <span className="hero-word inline-block">Software</span>{" "}
            <span className="hero-word inline-block">Engineer</span>{" "}
            <Image
              src={softwareEngineerIcon}
              alt=""
              aria-hidden
              className="hero-icon inline-block size-[1em] rounded-2xl object-contain align-[-0.2em] mx-[0.05em]"
            />
          </span>{" "}
          <span className="text-neutral-900 text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl">
            <span className="hero-word inline-block">who</span>{" "}
            <span className="hero-word inline-block">Designs</span>{" "}
            <Image
              src={designerIcon}
              alt=""
              aria-hidden
              className="hero-icon inline-block size-[1em] rounded-2xl object-contain align-[-0.2em] mx-[0.05em]"
            />
          </span>
        </h1>
        <p className="hero-sub text-center text-lg sm:text-xl md:text-2xl text-neutral-900">
          <span>From</span>{" "}
          <span className="hero-underline underline underline-offset-4 decoration-1">
            New York City
          </span>
        </p>
      </div>
    </header>
  );
}
