"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

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

export default function Work() {
  const sectionRef = useRef<HTMLDivElement>(null);

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

  return <div ref={sectionRef} className="min-h-dvh"></div>;
}
