"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { ReactNode } from "react";
import { useRef } from "react";

gsap.registerPlugin(useGSAP, ScrollTrigger, ScrollSmoother);

/**
 * How long the page takes to catch up to the scrollbar, in seconds.
 *
 * This is a duration, not a rate: ScrollSmoother eases the content toward
 * wherever the real scroll position has got to, so the number reads as how far
 * behind the wheel the page is allowed to run. Much past this and the hero's
 * scrub starts to feel disconnected from the gesture driving it — the labels
 * are still arriving after the wheel has stopped.
 */
const SMOOTH = 1;

/**
 * Touch is left alone.
 *
 * A finger on the glass is already a direct manipulation with the platform's
 * own momentum behind it, and smoothing puts a second, slower spring in front
 * of that one — which reads as lag rather than as polish. It also costs the
 * most on exactly the hardware least able to pay for it, and the pinned scrub
 * in the hero is the heaviest thing on the page.
 */
const SMOOTH_TOUCH = false;

/**
 * The page's smooth-scrolling shell, used on the home route only.
 *
 * ScrollSmoother does not intercept the wheel or fake a scrollbar: the document
 * keeps its real height and its real scroll position, and what moves is the
 * content, translated toward that position under an ease. Everything downstream
 * — deep links, the scrollbar, `scrollRestoration`, find-in-page — therefore
 * goes on working, and ScrollTrigger reads the same numbers it always did.
 *
 * That translation is also the one thing to design around. `#smooth-content`
 * carries a transform, and a transform makes an element the containing block
 * for every `fixed` descendant under it — so anything that has to stay welded
 * to the viewport must live outside this component's content, which is why the
 * hero portals its two corner labels to `document.body`.
 *
 * A component rather than something in the root layout, because the route is
 * the unit of choice here: `/` is one continuous pinned sequence and reads far
 * better under an ease, and a page of ordinary prose does not need the browser
 * held at arm's length.
 */
export default function SmoothScroll({ children }: { children: ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    // Reduced motion gets the browser's own scrolling, untouched. Easing the
    // whole page is a large, unrequested movement of everything on screen, and
    // for a visitor prone to motion sickness it is the sort that has nothing
    // to do with the content and cannot be looked away from.
    //
    // `matchMedia` rather than a one-off check so the preference is live: flip
    // it in the OS and the context reverts, `kill()` puts the wrapper, the
    // content and the body's height back exactly as they were, and native
    // scrolling resumes without a reload.
    const media = gsap.matchMedia();

    media.add("(prefers-reduced-motion: no-preference)", () => {
      const smoother = ScrollSmoother.create({
        wrapper: wrapperRef.current,
        content: contentRef.current,
        smooth: SMOOTH,
        smoothTouch: SMOOTH_TOUCH,
        // No `data-speed` or `data-lag` anywhere on the page. Left on,
        // ScrollSmoother searches for them and keeps a parallax bookkeeping
        // pass alive on every refresh for a set that is always empty.
        effects: false,
        // A mobile address bar sliding away is a viewport resize, and a resize
        // is a full ScrollTrigger refresh — which, mid-pin, re-measures the
        // hero against a viewport that is only briefly that size and visibly
        // jumps the scrub. The hero is sized in `dvh`, so it absorbs the change
        // on its own; this just stops the refresh from firing.
        ignoreMobileResize: true,
      });

      // Keeps the page long enough for every trigger it hosts to reach its end.
      //
      // A pin props the document open by exactly its own length, but it does
      // not begin at the top of the page — the hero's waits until scrolling has
      // carried the headshot to the middle of the viewport, which costs half
      // the header's height first. So the pin's last pixel is at `start +
      // length` while the page only offers `length`, and the final `start`
      // pixels of the scrub are past the bottom of the document and can never
      // be reached: the reveal freezes a few percent short of its last frame.
      //
      // A full-height section below the hero used to hide this by supplying
      // slack of its own. Nothing about the hero changed when it went.
      //
      // Padding on the content rather than on the pin's own spacer, which is
      // the obvious place and is a trap. ScrollTrigger rebuilds that spacer
      // from scratch on every refresh, so slack added there survives only until
      // the next one — and because growing it resizes the content, the
      // `ResizeObserver` above sees the change and schedules exactly that
      // refresh. The two chase each other forever and the tab locks up. The
      // content's own padding is nobody else's to rewrite, so it simply stays.
      //
      // Written as a correction to what is already there rather than
      // recalculated from zero, which is what makes it settle: once the padding
      // is right the shortfall is zero, the style is left untouched, the
      // content does not resize, and no further refresh is provoked.
      const fitContentToTriggers = () => {
        const content = contentRef.current;
        if (!content) return;

        const current = parseFloat(content.style.paddingBottom) || 0;
        // Reading this also has the side effect of making ScrollSmoother
        // re-derive the body's height from the content's, which is what
        // actually gives the document its scrollbar.
        const reachable = ScrollTrigger.maxScroll(smoother.wrapper());
        const furthest = Math.max(
          0,
          ...ScrollTrigger.getAll().map((trigger) => trigger.end),
        );

        const shortfall = furthest - reachable;
        if (!shortfall) return;

        content.style.paddingBottom = `${Math.max(0, current + shortfall)}px`;
        ScrollTrigger.maxScroll(smoother.wrapper());
      };

      // Hung off the refresh event rather than any one trigger's `onRefresh`,
      // so it runs once, after everything on the page has finished measuring
      // and there is a real furthest end to compare against.
      ScrollTrigger.addEventListener("refresh", fitContentToTriggers);
      fitContentToTriggers();

      return () => {
        ScrollTrigger.removeEventListener("refresh", fitContentToTriggers);
        contentRef.current?.style.removeProperty("padding-bottom");
        smoother.kill();
      };
    });

    return () => media.revert();
  });

  // Both elements are always rendered, whatever the motion preference and
  // whether or not the script has run yet: ScrollSmoother needs them to exist
  // before it can adopt them, and left alone they are two plain block boxes
  // that lay out exactly as if they were not here. The ids are the names
  // ScrollSmoother uses by default and are what the refs above pass explicitly,
  // kept for the sake of anyone reading the DOM.
  return (
    <div ref={wrapperRef} id="smooth-wrapper">
      <div ref={contentRef} id="smooth-content" className="pb-0!">
        {children}
      </div>
    </div>
  );
}
