"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";

gsap.registerPlugin(useGSAP);

function DescriptionContent({ type }: { type: string }) {
  switch (type) {
    case "Unlevered":
      return (
        <header className="flex flex-col gap-4">
          <h1 className="text-4xl text-white font-aeonik-regular">Unlevered</h1>
          <p className="text-white/60 text-xl font-aeonik-regular">
            I worked as a{" "}
            <span className="text-white/80! font-aeonik-medium!">
              Software Engineer Intern
            </span>{" "}
            from July 2024 - Jan 2025. I built the front-end infrastructure for
            Unlevered, integrating back-end services to manage and display AI
            summaries to help financial analysts and investors review SEC
            filings, investor relations reports, and earnings transcripts.
          </p>
        </header>
      );
    case "Blitz":
      return (
        <header className="flex flex-col gap-4">
          <h1 className="text-4xl text-white font-aeonik-regular">Blitz</h1>
          <p className="text-white/60 text-xl font-aeonik-regular">
            I&apos;m currently working here as a{" "}
            <span className="text-white/80! font-aeonik-medium!">
              Software Engineer Intern
            </span>{" "}
            since March of this year. I&apos;ve rebuilt the entire front-end UI
            of the Blitz platform from the ground up which linked to back-end
            services to transfer millions in payouts to thousands of users.
          </p>
        </header>
      );
    case "Syllabus to Calendar":
      return (
        <header className="flex flex-col gap-4">
          <h1 className="text-4xl text-white font-aeonik-regular">
            Syllabus to Calendar
          </h1>
          <p className="text-white/60 text-xl font-aeonik-regular">
            Personal project of mine which I used to parse course syllabi
            deadlines and events to automatically sync to my Google Calendar.
            Learned about token optimization and prompt engineering with AI
            models.
          </p>
        </header>
      );
    default:
      return null;
  }
}

/**
 * The copy under the carousel, faded in whenever the centred project changes.
 *
 * A GSAP tween keyed on `type` rather than `motion`'s `AnimatePresence` —
 * this crossfade was one of the two effects keeping a second animation
 * library in the bundle. The exit half of the old animation is dropped: the
 * new copy fades up over the spot the old copy occupied, which at 300 ms
 * reads as the same gesture without holding a departing element in the tree.
 */
export default function WorkDescriptions({ type }: { type: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const media = gsap.matchMedia();

      media.add("(prefers-reduced-motion: no-preference)", () => {
        const tween = gsap.fromTo(
          ref.current,
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" },
        );
        return () => tween.kill();
      });

      return () => media.revert();
    },
    // Keyed on the project: each swap replays the entrance over the freshly
    // rendered copy.
    // `revertOnUpdate` so each swap tears the previous run's matchMedia down
    // instead of stacking one per project change.
    { scope: ref, dependencies: [type], revertOnUpdate: true },
  );

  return (
    <div ref={ref}>
      <DescriptionContent type={type} />
    </div>
  );
}
