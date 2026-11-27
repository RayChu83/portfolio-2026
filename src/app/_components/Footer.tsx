"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { type RefObject, useEffect, useRef, useState } from "react";
import { FaArrowUp } from "react-icons/fa6";
import { Confetti, type ConfettiRef } from "@/components/ui/confetti";
import { DEVICE_HINT_HEADER, deviceHint } from "@/lib/device-hint";
import { RESUME_PATH } from "@/lib/site";
import { usePrefersReducedMotion } from "../_hooks/usePrefersReducedMotion";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/** `null` until `/api/visitor-count` answers. */
type VisitorCount = number | null;

/**
 * Module scope so Strict Mode's double-mounted effect doesn't fire two
 * requests; the endpoint increments Redis on a visitor's first request.
 */
let hasRequestedVisitorCount = false;

/** `sessionStorage` so the cached count dies with the tab. */
const VISITOR_COUNT_STORAGE_KEY = "visitor-count";

function readCachedVisitorCount(): number | null {
  try {
    const raw = window.sessionStorage.getItem(VISITOR_COUNT_STORAGE_KEY);
    if (raw === null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedVisitorCount(count: number): void {
  try {
    window.sessionStorage.setItem(VISITOR_COUNT_STORAGE_KEY, String(count));
  } catch {
    // Storage unavailable; the next page load just fetches again.
  }
}

/** Fixed width so the digits don't reflow the headline mid-count. */
const format = (n: number) => String(n).padStart(3, "0");

/** 11, 12 and 13 are "th" regardless of their last digit, as are 111–113 etc. */
function ordinalSuffix(n: number): string {
  const lastTwoDigits = n % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) return "th";

  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

const CONFETTI_COLORS = [
  "#0a0a0a",
  "#f04438",
  "#f79009",
  "#12b76a",
  "#2e90fa",
  "#9e77ed",
];

/** Cannon height as a fraction of the footer, just under the headline. */
const HEADLINE_BAND = 0.32;

/** Shared between the two cannons; only the angle and side differ. */
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
 * Whether the footer fits in the viewport. A sticky footer taller than the
 * screen can't be fully uncovered, so it falls back to normal flow instead.
 */
function useCanReveal(ref: RefObject<HTMLElement | null>): boolean {
  const [canReveal, setCanReveal] = useState(true);

  useEffect(() => {
    const footer = ref.current;
    if (!footer) return;
    const measure = () =>
      setCanReveal(footer.offsetHeight <= window.innerHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(footer);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ref]);

  return canReveal;
}

/**
 * The page's last screen, revealed rather than scrolled to: it sticks to the
 * bottom of the viewport while the opaque content above it scrolls away.
 */
export default function Footer() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const canReveal = useCanReveal(footerRef);
  const countRef = useRef<HTMLSpanElement>(null);
  const leftCannon = useRef<ConfettiRef>(null);
  const rightCannon = useRef<ConfettiRef>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [count, setCount] = useState<VisitorCount>(null);

  // Fetched on mount so the count is ready by the time anyone scrolls here.
  useEffect(() => {
    if (hasRequestedVisitorCount) return;
    hasRequestedVisitorCount = true;

    const cached = readCachedVisitorCount();
    if (cached !== null) {
      Promise.resolve().then(() => setCount(cached));
      return;
    }

    fetch("/api/visitor-count", {
      headers: { [DEVICE_HINT_HEADER]: deviceHint() },
    })
      .then((response) => {
        if (!response.ok) throw new Error(`status ${response.status}`);
        return response.json() as Promise<{ count: number }>;
      })
      .then(({ count }) => {
        setCount(count);
        writeCachedVisitorCount(count);
      })
      .catch((error: unknown) => {
        // Count stays null and the headline shows an em dash.
        console.error("Failed to load visitor count:", error);
      });
  }, []);

  useGSAP(
    () => {
      if (prefersReducedMotion || count === null) return;

      const counter = { value: 0 };
      const countUp = gsap.to(counter, {
        value: count,
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
        // Origins sit just off-canvas so the burst arrives from off-screen.
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

      // Triggered off the sentinel, not the footer: the sticky footer reads as
      // visible from the first frame while still covered.
      const trigger = ScrollTrigger.create({
        trigger: sentinelRef.current,
        start: "top 45%",
        once: true,
        onEnter: () => {
          countUp.restart();
          fire();
        },
      });

      return () => trigger.kill();
    },
    { dependencies: [prefersReducedMotion, count] },
  );

  return (
    <>
      {/* Zero-height mark at the boundary between the page and the footer. */}
      <div ref={sentinelRef} aria-hidden className="h-0" />

      {/* `overflow-hidden` stops the absolute canvases from extending the
          document's scrollable area. */}
      <footer
        ref={footerRef}
        className={`z-0 overflow-hidden bg-white font-aeonik-regular ${
          canReveal ? "sticky bottom-0" : "relative"
        }`}
      >
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

        {/* `relative` lifts the content above the canvases. */}
        <div className="relative flex flex-col">
          <div className="border-b border-neutral-200 px-4 py-20 sm:px-8 md:py-28 lg:px-10">
            <p className="mb-6 text-xl text-neutral-500">
              You&apos;ve reached the end
            </p>
            <h2 className="font-aeonik-regular text-5xl tracking-tighter text-balance text-neutral-500 sm:text-6xl lg:text-7xl">
              Congrats, you&rsquo;re the <br className="sm:block hidden" />
              {/* Tabular figures keep the count-up from jittering the text. */}
              <span className="tabular-nums text-neutral-900">
                <span ref={countRef}>
                  {count === null ? "—" : format(count)}
                </span>
                {count !== null && (
                  <sup className="align-super text-[0.42em] leading-none tracking-normal">
                    {ordinalSuffix(count)}
                  </sup>
                )}
                visitor
              </span>{" "}
            </h2>
          </div>

          <ul className="grid w-full grid-cols-1 sm:grid-cols-3">
            {LINKS.map(({ href, label, service }, index) => (
              <li
                key={service}
                className={`border-b border-neutral-200 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 ${
                  index === 0 ? "bg-neutral-50" : ""
                }`}
              >
                <Link
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex h-full w-full flex-col gap-10 px-4 py-6 outline-none transition-colors duration-200 hover:bg-neutral-100 focus-visible:bg-neutral-100 motion-reduce:transition-none sm:px-8 sm:py-8 lg:px-10"
                >
                  <span className="text-sm text-neutral-500 sm:text-base">
                    {label}
                  </span>
                  <span className="flex items-center gap-[0.4em] text-2xl tracking-tight text-neutral-900 lg:text-4xl">
                    {service}
                    <FaArrowUp
                      aria-hidden
                      className="size-[0.55em] rotate-45 text-neutral-500 transition-[transform,color] duration-200 group-hover:translate-x-1 group-hover:text-neutral-900 group-focus-visible:text-neutral-900 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative w-full gap-x-6 gap-y-3 border-t border-neutral-200 px-4 py-5 text-sm text-neutral-500 sm:px-8 lg:px-10">
          <div className="flex justify-between flex-wrap items-center gap-x-6 gap-y-2">
            <span>&copy; {new Date().getFullYear()} Ray Chu</span>
            <Link
              href={RESUME_PATH}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-neutral-900 transition-colors hover:text-black focus-visible:text-black focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-black motion-reduce:transition-none"
            >
              Resume
              <FaArrowUp aria-hidden className="size-3 rotate-45" />
            </Link>
          </div>
        </div>
        <div aria-hidden className="footer-grain" />
      </footer>
    </>
  );
}
