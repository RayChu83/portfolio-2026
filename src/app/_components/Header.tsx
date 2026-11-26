"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { RetroComputer, ToyRobot } from "kubai-icons-react/duotone";
import Image from "next/image";
import { useRef, useState } from "react";
import profileIcon from "../../../public/icon-192.png";

gsap.registerPlugin(useGSAP);

/**
 * The page's greeting, which cascades in line by line on load — each line
 * rising into focus with a short stagger, the icons popping in as a separate
 * accent beat, the location line closing things out with its underline. It
 * plays once and then stays put; scrolling doesn't animate it.
 */
export default function Header() {
  const ref = useRef<HTMLElement>(null);
  // The Kubai icons play their motion (the computer switching on, the
  // sparkles turning) once, as they land, and then hold the end pose. They
  // run with `trigger="none"`, so nothing ever plays it back or replays it.
  const [computerOn, setComputerOn] = useState(false);
  const [sparklesOn, setSparklesOn] = useState(false);

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      const switchOn: Record<string, () => void> = {
        computer: () => setComputerOn(true),
        sparkles: () => setSparklesOn(true),
      };

      // No entrance under reduced motion, so show the end pose right away.
      // The Kubai runtime also respects the setting and jumps straight there.
      media.add("(prefers-reduced-motion: reduce)", () => {
        Object.values(switchOn).forEach((on) => on());
      });

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
          ref.current?.querySelectorAll<HTMLElement | SVGSVGElement>(
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
            // Start the icon's own motion once the pop is mostly done, so
            // the two read as one beat instead of fighting over the frame.
            const on = el.dataset.switchOn && switchOn[el.dataset.switchOn];
            if (on) entrance.call(on, [], i * WORD_STAGGER + 0.35);
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

        return () => entrance.kill();
      });

      return () => media.revert();
    },
    { scope: ref },
  );

  return (
    <header
      ref={ref}
      className="pt-[20dvh] pb-[10dvh] px-6 sm:px-12 lg:px-20 2xl:px-32 grid grid-cols-1 content-start items-center md:grid-cols-2 md:gap-x-12"
    >
      <div className="@container">
        <h1 className="text-left font-aeonik-regular tracking-tighter flex flex-col">
          <span className="text-neutral-900 whitespace-nowrap leading-[1.2] text-[clamp(1.25rem,9.5cqw,3.5rem)] md:text-[clamp(1.25rem,9.5cqw,5rem)]">
            <span className="hero-word inline-block">Ray</span>{" "}
            <span className="hero-word inline-block">Chu</span>{" "}
            <Image
              src={profileIcon}
              alt=""
              aria-hidden
              className="hero-icon inline-block size-[1em] rounded-[32%] [corner-shape:squircle] object-cover align-[-0.2em] mx-[0.05em]"
            />{" "}
            <span className="hero-word inline-block">is</span>{" "}
            <span className="hero-word inline-block">a</span>{" "}
          </span>{" "}
          <span className="text-neutral-900 whitespace-nowrap leading-[1.2] text-[clamp(1.25rem,9.5cqw,3.5rem)] md:text-[clamp(1.25rem,9.5cqw,5rem)]">
            <span className="hero-word inline-block">Software</span>{" "}
            <span className="whitespace-nowrap">
              <span className="hero-word inline-block">Engineer</span>{" "}
              <RetroComputer
                size="1em"
                color="#052e16"
                trigger="none"
                hover={computerOn}
                data-switch-on="computer"
                className="hero-icon inline-block align-[-0.2em]"
              />
            </span>
          </span>{" "}
          <span className="text-neutral-900 whitespace-nowrap leading-[1.2] text-[clamp(1.25rem,9.5cqw,3.5rem)] md:text-[clamp(1.25rem,9.5cqw,5rem)]">
            <span className="hero-word inline-block">Building</span>{" "}
            <span className="hero-word inline-block">with</span>{" "}
            <span className="whitespace-nowrap">
              <span className="hero-word inline-block">AI</span>{" "}
              <ToyRobot
                size="1em"
                color="#1e1b4b"
                trigger="none"
                hover={sparklesOn}
                data-switch-on="sparkles"
                className="hero-icon inline-block align-[-0.2em]"
              />
            </span>
          </span>
        </h1>
      </div>
      <section
        aria-labelledby="previously-built-at"
        className="hero-sub mt-12 md:mt-0"
      >
        <p
          id="previously-built-at"
          className="text-[clamp(0.875rem,1.15vw,1.125rem)] tracking-tight text-neutral-400"
        >
          Previously built at
        </p>
        <ul className="mt-3 font-aeonik-regular text-[clamp(1.75rem,3.2vw,3rem)] leading-[1.15] text-neutral-500">
          <li className="group flex flex-wrap items-baseline gap-x-[0.5em] transition-colors duration-200 hover:text-neutral-600 motion-reduce:transition-none">
            Blitz{" "}
            <span className="text-[0.4em] tracking-normal text-neutral-300 transition-colors duration-200 group-hover:text-neutral-400 motion-reduce:transition-none">
              useblitz.co
            </span>
          </li>
          <li className="group flex flex-wrap items-baseline gap-x-[0.5em] transition-colors duration-200 hover:text-neutral-600 motion-reduce:transition-none">
            Unlevered{" "}
            <span className="text-[0.4em] tracking-normal text-neutral-300 transition-colors duration-200 group-hover:text-neutral-400 motion-reduce:transition-none">
              unlevered.ai
            </span>
          </li>
        </ul>
      </section>
    </header>
  );
}
