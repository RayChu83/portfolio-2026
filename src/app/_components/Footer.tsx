"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { useRef } from "react";
import { FaArrowUp } from "react-icons/fa6";
import { Confetti, type ConfettiRef } from "@/components/ui/confetti";
import { usePrefersReducedMotion } from "../_hooks/usePrefersReducedMotion";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * Which visitor this one is.
 *
 * A constant, and deliberately so for now: a number that means anything has to
 * be counted somewhere both visitors can see — a KV store or a route handler —
 * and nothing on this page has a server to ask. Rendered into the markup at its
 * final value rather than at zero, so the sentence is true before any script
 * runs and stays true if none ever does; the count-up below only replays the
 * arrival for people who scroll to it.
 */
const VISITOR = 7;

/** Padded to a fixed width so the digits never reflow the headline mid-count. */
const format = (n: number) => String(n).padStart(3, "0");

/**
 * The confetti's palette — the one place on the page that gets colour.
 *
 * The near-black leads it, so the burst still reads as belonging to a site
 * built out of black, white and grey; the five hues behind it are what make it
 * confetti rather than ash. Mid-saturation on purpose: fully saturated primaries
 * on a white ground glare, and these have to sit behind black display type
 * without competing with it.
 */
const CONFETTI_COLORS = [
  "#0a0a0a",
  "#f04438",
  "#f79009",
  "#12b76a",
  "#2e90fa",
  "#9e77ed",
];

/**
 * Where the cannons sit, as a fraction of the footer's height — a little under
 * the headline, so the burst crosses it on the way up rather than raining onto
 * it from above. The canvases span the whole footer (see below), so this is
 * measured against that and not against the type.
 */
const HEADLINE_BAND = 0.32;

/** Shared between the two cannons; only the angle and the side differ. */
const BURST = {
  particleCount: 70,
  spread: 62,
  startVelocity: 46,
  gravity: 0.9,
  decay: 0.92,
  scalar: 0.95,
  ticks: 220,
  colors: CONFETTI_COLORS,
};

const LINKS = [
  { href: "mailto:chu.ray1219@gmail.com", label: "Say hi", service: "Email" },
  {
    href: "https://www.linkedin.com/in/raychu83/",
    label: "Connect",
    service: "LinkedIn",
  },
  {
    href: "https://github.com/RayChu83",
    label: "Follow",
    service: "GitHub",
  },
] as const;

/**
 * The page's last screen, revealed rather than scrolled to.
 *
 * `sticky bottom-0` is the whole mechanism, and it is worth being precise about
 * why it produces an appearance rather than an arrival. The footer sits in
 * normal flow at the end of the document, so it reserves exactly its own height
 * — which is exactly the scrolling it takes to uncover it, with no measurement
 * to keep in step with a reflow. Sticking to the bottom edge means that for the
 * whole of that scroll it is already sitting against the bottom of the screen,
 * holding still, while the page above slides off it. The alternative — a fixed
 * footer plus a margin under the content — needs that margin measured and
 * re-measured against a box whose height depends on the font, the breakpoint
 * and whether the pills have wrapped, and is wrong for a frame every time one
 * of those changes.
 *
 * What makes it work is the layering, which is stated a level up in `page.tsx`:
 * everything above this is opaque and on a layer above it. Without that the
 * footer is simply visible through the page from the first frame.
 */
export default function Footer() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const leftCannon = useRef<ConfettiRef>(null);
  const rightCannon = useRef<ConfettiRef>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useGSAP(
    () => {
      // Both halves of the celebration are motion for its own sake, and the
      // sentence they decorate is already complete in the markup. Under the
      // preference there is nothing here worth doing a quieter version of.
      if (prefersReducedMotion) return;

      // Built paused and restarted on the way in, rather than created inside
      // the callback: a tween made in a scroll handler outlives the effect that
      // registered the handler, and this one is owned by `useGSAP`'s context
      // and reverted with it.
      const counter = { value: 0 };
      const countUp = gsap.to(counter, {
        value: VISITOR,
        duration: 0.9,
        ease: "power3.out",
        paused: true,
        onUpdate: () => {
          if (countRef.current) {
            countRef.current.textContent = format(Math.round(counter.value));
          }
        },
      });

      const fire = () => {
        // Off the two edges rather than from them — a hair outside the canvas,
        // so the burst reads as arriving from off-screen instead of being born
        // at the margin.
        leftCannon.current?.fire({
          ...BURST,
          angle: 58,
          origin: { x: -0.02, y: HEADLINE_BAND },
        });
        rightCannon.current?.fire({
          ...BURST,
          angle: 122,
          origin: { x: 1.02, y: HEADLINE_BAND },
        });
      };

      // Hung off the sentinel — the last pixel of the page above — and not off
      // the footer itself. The footer is `sticky`, so for the whole of this
      // stretch its box is already parked against the bottom of the viewport
      // and any observer pointed at it reports it visible from the first frame,
      // while it is still completely covered. The sentinel is the only thing
      // here whose position actually tracks how much of the footer has been
      // uncovered.
      //
      // `top 45%` puts the trigger at the point where the bottom of the screen
      // is a little over half footer, which is where the headline has cleared
      // the page above and the burst has somewhere to land.
      const trigger = ScrollTrigger.create({
        trigger: sentinelRef.current,
        start: "top 45%",
        // Not a one-shot: scrolling back up and returning is a second arrival,
        // and a second arrival should be celebrated. `onEnter` fires on every
        // downward crossing, so the re-arming is free.
        onEnter: () => {
          countUp.restart();
          fire();
        },
      });

      // Nothing restates the past-the-line case the way `Work` has to. A
      // visitor who loads the page already scrolled down here has the final
      // number in front of them from the server render, and confetti for an
      // arrival they did not make would be a lie about what just happened.

      return () => trigger.kill();
    },
    { dependencies: [prefersReducedMotion] },
  );

  return (
    <>
      {/* Zero-height, in flow, immediately before the sticky box — so its
          position is the boundary between the page and the footer. Purely a
          measuring mark; there is nothing here to read. */}
      <div ref={sentinelRef} aria-hidden className="h-0" />

      {/* `overflow-hidden` is load-bearing, not tidiness. A canvas is a box
          like any other, and an `absolute` one that reaches past its parent
          extends the *document's* scrollable area — which reads as dead space
          under the footer that grows with the viewport, because the canvases
          are sized off type that scales with it. The canvases below are inset
          to this box exactly, so nothing is clipped today; this is what stops
          the next thing added here from putting that space back. */}
      <footer className="sticky bottom-0 z-0 overflow-hidden bg-white">
        {/* Two cannons, one per side, each spanning the whole footer.
            Deliberately the footer and not the headline: particles need room to
            cross and fall, a canvas only clips what it is big enough to draw,
            and the footer is the largest box here that costs the page nothing
            to cover. `pointer-events-none` because they lie over the links. */}
        <Confetti
          ref={leftCannon}
          manualstart
          aria-hidden
          className="pointer-events-none absolute inset-0 size-full"
        />
        <Confetti
          ref={rightCannon}
          manualstart
          aria-hidden
          className="pointer-events-none absolute inset-0 size-full"
        />

        {/* `relative` only to lift the content off the canvases behind it —
            the confetti passes behind the type, never over it. */}
        <div className="relative flex flex-col gap-16 px-6 pt-24 pb-12 md:gap-20 md:px-12 md:pt-32 lg:px-20">
          <div className="text-center">
            <p className="text-neutral-700 font-aeonik-regular text-2xl mb-4">
              You've reached the end!
            </p>
            <h2 className="font-aeonik-medium text-5xl tracking-tighter text-balance text-black sm:text-6xl lg:text-7xl xl:text-8xl">
              Congrats, you&rsquo;re the <br />
              {/* Tabular figures so the count-up cannot jitter the words after
                  it as the digits change. */}
              <span className="tabular-nums">
                <span ref={countRef}>{format(VISITOR)}</span>
                <sup className="align-super text-[0.42em] leading-none tracking-normal">
                  th
                </sup>
              </span>{" "}
              visitor
            </h2>
          </div>

          <ul className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
            {LINKS.map(({ href, label, service }) => (
              <li key={service} className="flex flex-col items-center gap-3.5">
                <Link
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex w-full items-center justify-center gap-[0.4em] rounded-full bg-black px-6 py-6 font-aeonik-regular text-2xl tracking-tight text-white transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-neutral-800 focus-visible:-translate-y-0.5 focus-visible:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:focus-visible:translate-y-0 sm:py-8 lg:text-4xl"
                >
                  {label}
                  <FaArrowUp
                    aria-hidden
                    className="size-[0.55em] rotate-45 text-white/50 transition-[transform,color] duration-200 group-hover:text-white group-focus-visible:text-white motion-reduce:transition-none"
                  />
                </Link>
                <span className="text-neutral-500">{service}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* `relative` for the same reason as the block above: the cannons are
            absolutely positioned over the whole footer, and a static sibling
            would sit under them. */}
        <div className="relative flex flex-wrap items-center justify-between gap-x-6 gap-y-3 bg-neutral-100 px-6 py-6 text-neutral-500 md:px-12 lg:px-20">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span>&copy; {new Date().getFullYear()} Ray Chu</span>
            <Link
              href="https://github.com/RayChu83"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-black focus-visible:text-black focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-black motion-reduce:transition-none"
            >
              Resume
              <FaArrowUp aria-hidden className="size-3 rotate-45" />
            </Link>
          </div>

          <BackToTop />
        </div>
      </footer>
    </>
  );
}

/**
 * Its own component only so the click handler is not rebuilt on every render of
 * the footer around it.
 */
function BackToTop() {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <button
      type="button"
      onClick={() =>
        window.scrollTo({
          top: 0,
          behavior: prefersReducedMotion ? "auto" : "smooth",
        })
      }
      className="inline-flex cursor-pointer items-center gap-1.5 transition-colors hover:text-black focus-visible:text-black focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-black motion-reduce:transition-none"
    >
      Back to top
      <FaArrowUp aria-hidden className="size-3.5" />
    </button>
  );
}
