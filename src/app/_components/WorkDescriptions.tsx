"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import Link from "next/link";
import { useRef } from "react";
import type { IconType } from "react-icons";
import { BsArrowRightShort } from "react-icons/bs";
import { FaAws } from "react-icons/fa6";
import {
  SiDocker,
  SiFlask,
  SiKubernetes,
  SiMongodb,
  SiNestjs,
  SiNextdotjs,
  SiReact,
  SiSupabase,
  SiTailwindcss,
  SiTypescript,
} from "react-icons/si";

gsap.registerPlugin(useGSAP);

/**
 * What each project was actually built with, keyed by the same title the
 * carousel passes down as `type`.
 *
 * A table rather than three hand-written rows of JSX: the icons are data about
 * the project, they are the one part of each description that is a *list*, and
 * keeping them out here means adding a technology is one entry rather than a
 * new import threaded into one branch of a switch. AWS comes from Font Awesome
 * because Simple Icons dropped its Amazon Web Services mark; everything else is
 * a Simple Icons brand glyph, which is why they share a weight and an optical
 * size without any per-icon adjustment.
 */
const TECHNOLOGIES: Record<string, { name: string; Icon: IconType }[]> = {
  Unlevered: [
    { name: "React", Icon: SiReact },
    { name: "Tailwind CSS", Icon: SiTailwindcss },
    { name: "Flask", Icon: SiFlask },
    { name: "MongoDB", Icon: SiMongodb },
    { name: "Kubernetes", Icon: SiKubernetes },
    { name: "AWS", Icon: FaAws },
  ],
  Blitz: [
    { name: "Next.js", Icon: SiNextdotjs },
    { name: "TypeScript", Icon: SiTypescript },
    { name: "Tailwind CSS", Icon: SiTailwindcss },
    { name: "NestJS", Icon: SiNestjs },
    { name: "Docker", Icon: SiDocker },
  ],
  "Syllabus to Calendar": [
    { name: "Next.js", Icon: SiNextdotjs },
    { name: "TypeScript", Icon: SiTypescript },
    { name: "Tailwind CSS", Icon: SiTailwindcss },
    { name: "Supabase", Icon: SiSupabase },
  ],
};

/**
 * The technology row that sits between a project's copy and its "Learn more".
 *
 * Semi-transparent white, a step further back than the paragraph above it
 * (`white/60`): these are a credit line, not a heading, and on the section's
 * black ground a solid-white row of marks would out-shout the copy it belongs
 * to. Brand colours are deliberately not used — six different logo palettes in
 * a row would read as a sponsor strip.
 *
 * A real list, and each mark carries its name for a screen reader. A brand
 * glyph is legible only if you already recognise it, so the `sr-only` label is
 * the whole content for anyone not looking at the shape; the icons themselves
 * are `aria-hidden` so the name is announced once rather than twice.
 */
function TechStack({ type }: { type: string }) {
  const technologies = TECHNOLOGIES[type];
  if (!technologies) return null;

  return (
    <ul
      aria-label="Built with"
      className="flex flex-wrap items-center gap-5 my-2"
    >
      {technologies.map(({ name, Icon }) => (
        <li key={name} className="text-white/40 hover:text-white/60">
          <Icon aria-hidden size="20" />
          <span className="sr-only">{name}</span>
        </li>
      ))}
    </ul>
  );
}

function DescriptionContent({ type }: { type: string }) {
  switch (type) {
    case "Unlevered":
      return (
        <header className="flex flex-col gap-4">
          <h3 className="text-4xl text-white font-aeonik-regular">Unlevered</h3>
          <p className="text-white/60 text-xl font-aeonik-regular">
            I previously worked as a{" "}
            <span className="text-white/80! font-aeonik-medium!">
              Software Engineer Intern
            </span>{" "}
            from July 2024 - Jan 2025. I built the front-end infrastructure for
            Unlevered, integrating back-end services to manage and display AI
            summaries for financial analysts and investors review SEC filings,
            investor relations reports, and earnings transcripts.
          </p>
          <TechStack type={type} />
          <Link
            href="#"
            className="text-lg flex items-center gap-2 w-fit hover:gap-3 transition-all duration-300 opacity-80 hover:opacity-100"
          >
            Learn more <BsArrowRightShort strokeWidth={0.5} size="24" />
          </Link>
        </header>
      );
    case "Blitz":
      return (
        <header className="flex flex-col gap-4">
          <h3 className="text-4xl text-white font-aeonik-regular">Blitz</h3>
          <p className="text-white/60 text-xl font-aeonik-regular">
            I&apos;m currently working here as a{" "}
            <span className="text-white/80! font-aeonik-medium!">
              Software Engineer Intern
            </span>{" "}
            since March of this year. I&apos;ve rebuilt the entire front-end UI
            of the Blitz platform from the ground up which links to back-end
            services to transfer millions in payouts to thousands of users.
          </p>
          <TechStack type={type} />
          <Link
            href="#"
            className="text-lg flex items-center gap-2 w-fit hover:gap-3 transition-all duration-300 opacity-80 hover:opacity-100"
          >
            Learn more <BsArrowRightShort strokeWidth={0.5} size="24" />
          </Link>
        </header>
      );
    case "Syllabus to Calendar":
      return (
        <header className="flex flex-col gap-4">
          <h3 className="text-4xl text-white font-aeonik-regular">
            Syllabus to Calendar
          </h3>
          <p className="text-white/60 text-xl font-aeonik-regular">
            Personal project of mine which parses college syllabus PDF files to
            extract deadlines and events which automatically synced to my Google
            Calendar. Learned about token optimization and prompt engineering
            with AI models.
          </p>
          <TechStack type={type} />
          <Link
            href="#"
            className="text-lg flex items-center gap-2 w-fit hover:gap-3 transition-all duration-300 opacity-80 hover:opacity-100"
          >
            Learn more <BsArrowRightShort strokeWidth={0.5} size="24" />
          </Link>
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
