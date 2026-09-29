"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { BsVolumeMuteFill } from "react-icons/bs";
import { usePrefersReducedMotion } from "../_hooks/usePrefersReducedMotion";

gsap.registerPlugin(useGSAP, ScrollTrigger);

// A mobile address bar sliding away is a viewport resize, and a resize is a
// full ScrollTrigger refresh. The section is sized in `dvh` and absorbs the
// change on its own, so the refresh is skipped.
ScrollTrigger.config({ ignoreMobileResize: true });

/**
 * The work on display. Image paths match the files in `public/` exactly, case
 * included — the local filesystem is case-insensitive but the deploy target is
 * not, so a casing slip is a 404 that only ever shows up in production.
 *
 * `summary` is one short line: the role and what the work was about. The copy
 * is always in the markup (only visually collapsed on inactive rows), so it is
 * present in the server-rendered HTML for crawlers.
 */
const WORK = [
  {
    title: "Blitz",
    kind: "Internship",
    when: "Mar 2026 – Present",
    summary:
      "Software Engineer Intern rebuilding a payouts platform's front end.",
    image: "/Blitz.webp",
    href: "https://useblitz.co",
  },
  {
    title: "Unlevered",
    kind: "Internship",
    when: "Jul 2024 – Jan 2025",
    summary:
      "Software Engineer Intern building AI summaries for financial filings.",
    image: "/Unlevered.webp",
    video: "/Unlevered%20Product%20Showcase.mp4",
  },
  {
    title: "Syllabus to Calendar",
    kind: "Project",
    when: "Personal project",
    summary: "Turns college syllabus PDFs into Google Calendar events.",
    image: "/Syllabus_To_Calendar.webp",
    href: "https://syllabustocalendar.com",
  },
] as const;

/** Type scale shared with the hero so the two sections read as one voice. */
const DISPLAY = "text-4xl sm:text-5xl md:text-6xl xl:text-7xl 2xl:text-8xl";

/** A crosshair that marks a corner of the media frame. */
function Tick({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute size-4 ${className}`}
    >
      <span className="absolute left-1/2 top-0 h-full w-px bg-neutral-900" />
      <span className="absolute left-0 top-1/2 h-px w-full bg-neutral-900" />
    </span>
  );
}

export default function Work() {
  const [active, setActive] = useState(0);
  /**
   * Index of the project whose video currently has sound on, or `null`. Sound
   * is opt-in per visit: selecting anything else drops it back to `null`, so
   * returning to the video never starts it playing out loud.
   */
  const [unmutedIndex, setUnmutedIndex] = useState<number | null>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const trackRef = useRef<HTMLDivElement>(null);
  /** The pin's trigger — `null` under reduced motion, where nothing is pinned. */
  const triggerRef = useRef<ScrollTrigger | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  // Only the selected video plays; the 70 MB file is never fetched until it
  // is first selected (`preload="none"`).
  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (!video) return;
      if (index === active && !prefersReducedMotion) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, [active, prefersReducedMotion]);

  const select = useCallback((index: number) => {
    setActive(index);
    setUnmutedIndex((unmuted) => (unmuted === index ? unmuted : null));
  }, []);

  /**
   * The section is a tall track with the stage pinned inside it, and scroll
   * progress through the track picks the project: one flick can no longer
   * carry a visitor past all three, and the page is still scrolled natively —
   * nothing is snapped or intercepted.
   *
   * Under reduced motion there is no trigger at all. The track collapses to
   * a single screen through CSS (`motion-reduce:` on the markup, so the
   * server's HTML is already right) and selection is by hover and click.
   */
  useGSAP(
    () => {
      if (prefersReducedMotion) return;

      const sync = (self: ScrollTrigger) =>
        select(
          Math.min(WORK.length - 1, Math.floor(self.progress * WORK.length)),
        );

      const trigger = ScrollTrigger.create({
        trigger: trackRef.current,
        start: "top top",
        end: "bottom bottom",
        onUpdate: sync,
        onRefresh: sync,
      });
      triggerRef.current = trigger;

      return () => {
        trigger.kill();
        triggerRef.current = null;
      };
    },
    { scope: trackRef, dependencies: [prefersReducedMotion, select] },
  );

  /**
   * Pinned, the scroll position is the only source of truth, so choosing a
   * project scrolls to the middle of its stretch of the track. Unpinned
   * (reduced motion) it simply selects.
   */
  const choose = (index: number) => {
    const trigger = triggerRef.current;
    if (!trigger) {
      select(index);
      return;
    }
    const target =
      trigger.start +
      ((index + 0.5) / WORK.length) * (trigger.end - trigger.start);
    if (Math.abs(window.scrollY - target) < 1) return;
    window.scrollTo({ top: target, behavior: "smooth" });
  };

  const current = WORK[active];
  const href = "href" in current ? current.href : undefined;

  return (
    <div ref={trackRef} className="h-[300dvh] motion-reduce:h-auto">
      <div className="sticky top-0 h-dvh motion-reduce:static motion-reduce:h-auto">
        <section
          aria-label="Internships and projects"
          className="relative flex h-full min-h-dvh flex-col border-y border-neutral-200 font-aeonik-regular"
        >
          <div className="grid flex-1 grid-cols-1 lg:grid-cols-[7fr_5fr]">
            <h2 className="sr-only">Products I&apos;ve helped ship</h2>

            {/* Index */}
            <ol className="order-2 flex flex-col lg:order-1 lg:border-r lg:border-neutral-200">
              {WORK.map((work, index) => {
                const isActive = index === active;
                return (
                  <li
                    key={work.title}
                    className="flex-1 border-b border-neutral-200 last:border-b-0"
                  >
                    <button
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => choose(index)}
                      onFocus={() => choose(index)}
                      onMouseEnter={() => {
                        // Pinned, hovering must not fight the scroll position.
                        if (!triggerRef.current) select(index);
                      }}
                      className="group flex h-full w-full cursor-pointer flex-col justify-center gap-3 px-4 py-6 text-left outline-none focus-visible:bg-neutral-50 sm:px-8 lg:py-10"
                    >
                      <span className="flex items-baseline gap-4 sm:gap-6">
                        <span
                          className={`w-6 shrink-0 text-sm tabular-nums transition-colors duration-300 sm:w-8 sm:text-base ${
                            isActive ? "text-neutral-900" : "text-neutral-400"
                          }`}
                        >
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span
                          className={`${DISPLAY} tracking-tighter transition-[color,transform] duration-500 ease-out motion-reduce:transition-none ${
                            isActive
                              ? "translate-x-2 text-neutral-900"
                              : "text-neutral-300 group-hover:text-neutral-500"
                          }`}
                        >
                          {work.title}
                        </span>
                        <span
                          className={`ml-auto hidden shrink-0 text-sm transition-colors duration-300 sm:block sm:text-base ${
                            isActive ? "text-neutral-900" : "text-neutral-400"
                          }`}
                        >
                          {work.kind}
                        </span>
                      </span>

                      <span
                        className={`grid pl-10 transition-[grid-template-rows,opacity] duration-500 ease-out motion-reduce:transition-none sm:pl-14 ${
                          isActive
                            ? "grid-rows-[1fr] opacity-100"
                            : "grid-rows-[0fr] opacity-0"
                        }`}
                      >
                        <span className="overflow-hidden">
                          <span className="block max-w-[32ch] pl-2 text-lg text-neutral-500 sm:text-xl xl:text-2xl">
                            {work.summary}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            {/* Stage */}
            <div className="order-1 flex flex-col border-b border-neutral-200 lg:order-2 lg:border-b-0">
              <div className="flex flex-1 items-center px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
                <div className="relative aspect-video w-full bg-neutral-100 outline outline-1 outline-neutral-300">
                  <Tick className="-left-2 -top-2" />
                  <Tick className="-right-2 -top-2" />
                  <Tick className="-bottom-2 -left-2" />
                  <Tick className="-bottom-2 -right-2" />

                  {WORK.map((work, index) => {
                    const isActive = index === active;
                    const fade = `absolute inset-0 size-full object-cover transition-opacity duration-500 motion-reduce:transition-none ${
                      isActive ? "opacity-100" : "opacity-0"
                    }`;
                    return "video" in work ? (
                      <video
                        key={work.title}
                        ref={(el) => {
                          videoRefs.current[index] = el;
                        }}
                        src={work.video}
                        poster={work.image}
                        className={fade}
                        muted={unmutedIndex !== index}
                        loop
                        playsInline
                        preload="none"
                        aria-hidden={!isActive}
                      />
                    ) : (
                      <Image
                        key={work.title}
                        src={work.image}
                        alt={isActive ? `${work.title} screenshot` : ""}
                        fill
                        sizes="(min-width: 1024px) 40vw, 100vw"
                        priority={index === 0}
                        className={fade}
                      />
                    );
                  })}

                  {"video" in current ? (
                    // The whole frame is the control: dimmed and marked while
                    // muted, clear once it has sound. Clicking again mutes.
                    <button
                      type="button"
                      aria-label={
                        unmutedIndex === active ? "Mute video" : "Unmute video"
                      }
                      onClick={() =>
                        setUnmutedIndex((unmuted) =>
                          unmuted === active ? null : active,
                        )
                      }
                      className={`absolute inset-0 flex cursor-pointer items-center justify-center outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white motion-reduce:transition-none ${
                        unmutedIndex === active
                          ? "bg-transparent"
                          : "bg-black/40"
                      }`}
                    >
                      <BsVolumeMuteFill
                        aria-hidden
                        className={`size-10 text-white transition-opacity duration-300 motion-reduce:transition-none ${
                          unmutedIndex === active ? "opacity-0" : "opacity-100"
                        }`}
                      />
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-neutral-200 px-4 py-5 sm:px-8 lg:px-10">
                <span className="text-sm text-neutral-500 sm:text-base">
                  {current.when}
                </span>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-1.5 text-base text-neutral-900 transition-[gap] duration-300 hover:gap-3"
                  >
                    <span className="underline decoration-neutral-300 underline-offset-4 group-hover:decoration-neutral-900">
                      View more
                    </span>
                    <span aria-hidden>→</span>
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
