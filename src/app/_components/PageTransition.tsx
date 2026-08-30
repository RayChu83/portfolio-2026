"use client";

import gsap from "gsap";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

/**
 * How far the departing page has shrunk by the time it is gone. Far enough to
 * read as a card being lifted off the stack, close enough that the type on it
 * is still legible on the way — a page that collapses to a thumbnail reads as
 * a zoom-out, not as a hand-off.
 */
const EXIT_SCALE = 0.75;

/** Corner radius the departing page picks up as it goes. */
const EXIT_RADIUS = 64;

/**
 * Past -100% the card is fully off the top edge; the extra few percent buys a
 * beat of empty screen before the overlay is torn down, so the arriving page
 * is never revealed by the clone popping out of existence.
 */
const EXIT_Y = -108;

/** How long the whole exit takes, start to finish. */
const EXIT_DURATION = 0.9;

/**
 * How dark the departing card gets by the time it is gone — fully bright at
 * rest, only a little dimmed by the time it leaves. Dims alongside the shrink
 * and the slide rather than after them, so the card reads as receding into
 * shadow as it lifts off the stack instead of just getting smaller.
 *
 * Expressed as a target brightness (1 = untouched) rather than as the scrim
 * opacity that actually produces it — see `EXIT_SCRIM_OPACITY` for why a
 * `filter` cannot be used to get there directly.
 */
const EXIT_BRIGHTNESS = 0.8;

/**
 * The dim is a black scrim faded in over the card, not a `brightness()`
 * filter — deliberately, because a filter cannot be applied here safely.
 *
 * `SocialLinks` renders its corner icons with `mix-blend-difference`
 * (SocialLinks.tsx), fixed to the viewport and rendered as a sibling of every
 * section specifically so that blend mode sees the whole page as its
 * backdrop. That element is cloned into `holder` along with everything else.
 * Giving *any* ancestor of a `mix-blend-mode` element a `filter` is not
 * optional styling — the CSS spec requires that ancestor to become an
 * isolated blending group root the moment it does, which changes what the
 * icons blend against: instead of the real page content behind `stage`, the
 * difference blend now resolves only against whatever is painted inside that
 * ancestor's own isolated group, which starts as nothing. Chromium's
 * implementation paints that isolated group as an empty black backdrop for a
 * frame while it resolves the composite, which is the flash — and it follows
 * the filter to whichever element carries it, `stage` or `holder` alike, so
 * moving the filter between them cannot avoid it.
 *
 * A plain `background-color` + `opacity` scrim never triggers isolation, so
 * it is the only way to darken this specific card without the flash. It
 * approximates rather than reproduces `brightness()` — a multiplicative
 * per-pixel darken versus a flat black wash — but at this shallow a dim
 * (1 → 0.75) the two are not visually distinguishable.
 */
const EXIT_SCRIM_OPACITY = 1 - EXIT_BRIGHTNESS;

type PageTransitionContextValue = {
  /**
   * Freezes what is currently on screen into an inert copy and starts playing
   * it out. Call this *before* the route change commits — once React has
   * unmounted the old tree there is nothing left to copy.
   *
   * Returns nothing and never throws: a transition is decoration, and a
   * navigation that cannot be decorated still has to happen.
   */
  playExit: () => void;
};

const PageTransitionContext = createContext<PageTransitionContextValue>({
  playExit: () => {},
});

export const usePageTransition = () => useContext(PageTransitionContext);

/**
 * The route-to-route transition: the page being left behind scales down and
 * slides up off the top of the screen, uncovering the page being navigated
 * to, which is already sitting underneath it.
 *
 * ## Why a DOM copy
 *
 * The App Router hands the layout one `children` at a time. The moment a
 * navigation commits, the old page's tree is unmounted and its nodes are
 * gone — so there is no "outgoing page" element left to animate, and no
 * second copy of the app to cross-fade between.
 *
 * So the outgoing page is captured as a plain `cloneNode(true)` copy the
 * instant the link is clicked, parked in a fixed overlay above everything,
 * and animated there while the real navigation proceeds underneath it. The
 * copy is inert markup: no React, no effects, no ScrollTriggers re-arming,
 * no second `PageLoader` gate. It is a photograph of the page, and a
 * photograph is exactly what the effect needs.
 *
 * Re-rendering the previous `children` element into a second tree would have
 * been the more React-shaped answer, and it is the wrong one here: every
 * animated component on this site (`HeroHeadshot`, `Work`, `Header`) would
 * mount a *second* set of scroll triggers measuring a page that is in the
 * middle of being scaled and translated away.
 *
 * ## `display: contents`
 *
 * The wrapper around `children` exists only to give the capture a handle on
 * the page's top-level nodes. `display: contents` keeps it from being a box:
 * `<body>` is `flex flex-col`, and a real wrapper `<div>` would become the
 * one flex child, quietly collapsing the layout every page below depends on.
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  /** Empties the overlay and drops the timeline. Safe to call at any time. */
  const clear = useCallback(() => {
    timelineRef.current?.kill();
    timelineRef.current = null;
    if (overlayRef.current) overlayRef.current.replaceChildren();
  }, []);

  // The provider lives in the root layout and so never unmounts in practice,
  // but a timeline holding a detached DOM tree is not something to leave to
  // that assumption.
  useEffect(() => clear, [clear]);

  const playExit = useCallback(() => {
    const root = rootRef.current;
    const overlay = overlayRef.current;
    if (!root || !overlay) return;

    /**
     * Read at click time rather than at mount: the preference can be flipped
     * while the tab is open, and a value captured during hydration would go
     * on animating for the rest of the session. There is no fallback effect
     * to run in its place — the whole point of the transition is the motion,
     * so under `reduce` the navigation is simply the navigation, and the new
     * page is there on the next frame.
     */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // A second click while the first is still playing: the old copy is stale
    // the moment a new one is taken, so it goes rather than stacking up.
    clear();

    /**
     * The card. Everything the visitor is about to watch leave happens to
     * this element, which means the clone underneath is never touched and
     * never has to be measured.
     *
     * `overflow: hidden` is what makes it a card rather than a page: the copy
     * inside is full-length, and without a clip the part that was below the
     * fold would come into view as the whole thing shrinks.
     */
    const stage = document.createElement("div");
    stage.style.cssText =
      "position:absolute;inset:0;overflow:hidden;background:#fff;transform-origin:50% 50%;will-change:transform";

    /**
     * The copy, hung at its own scroll offset so the card opens on the part
     * of the page the visitor was actually looking at.
     *
     * Offset with `top`, deliberately not with a transform: a transformed
     * ancestor becomes the containing block for `position: fixed`, and this
     * page has fixed children (the social rail, the hero's corner labels).
     * Under a transform here they would be pinned to a box that starts
     * `scrollY` pixels above the screen and be nowhere to be seen. `stage`
     * *is* transformed, and that is the containing block they should resolve
     * against — it is viewport-sized, so they land where they were.
     */
    const holder = document.createElement("div");
    holder.style.cssText = `position:absolute;left:0;width:100%;top:${-window.scrollY}px`;
    // Belt and braces with the overlay's `pointer-events: none`: `inert` also
    // takes the duplicated links, buttons and headings out of the tab order
    // and out of the accessibility tree, so a screen reader is never read a
    // page that no longer exists.
    holder.setAttribute("inert", "");

    /**
     * `cloneNode` copies attributes, and a scroll offset is not one — it is a
     * property of the live element, so every scroller in the copy arrives at
     * zero however far its original had been scrolled.
     *
     * On this page that is the carousel, and there it is not a subtle
     * difference. `scrollLeft` is the only thing recording which project is
     * centred; the card faces carry the arc's inline transforms for whatever
     * offset the real one was at. Clone the two apart and the copy snaps back
     * to the first card while still wearing the poses built for the third —
     * the carousel appears to reset itself the instant the visitor clicks.
     * (Invisible from the first card, where zero was the right answer already,
     * which is why this only ever showed up on the second and third.)
     *
     * So the offsets are carried across by hand. The originals are read here,
     * before the copy joins the document, so the reads land on a layout that
     * is already clean.
     */
    const originals: Element[] = [];
    const copies: Element[] = [];

    for (const child of Array.from(root.children)) {
      const copy = child.cloneNode(true) as Element;
      holder.appendChild(copy);
      // `querySelectorAll` walks in document order, and the two trees are
      // identical by construction, so equal indices are the same element.
      originals.push(child, ...child.querySelectorAll("*"));
      copies.push(copy, ...copy.querySelectorAll("*"));
    }

    const scrolled: { node: Element; left: number; top: number }[] = [];
    for (let i = 0; i < originals.length; i++) {
      const { scrollLeft, scrollTop } = originals[i];
      if (scrollLeft || scrollTop) {
        scrolled.push({ node: copies[i], left: scrollLeft, top: scrollTop });
      }
    }

    stage.appendChild(holder);

    /**
     * The dim, as a plain black wash faded in over the content — see
     * `EXIT_SCRIM_OPACITY` for why this is a scrim and not a `filter`.
     *
     * A sibling of `holder` inside `stage` (so it clips and rounds with the
     * card) painted after it (so it sits over the content, not under it),
     * and `pointer-events: none` since it is decoration over an already-inert
     * copy.
     */
    const scrim = document.createElement("div");
    scrim.style.cssText =
      "position:absolute;inset:0;background:#000;opacity:0;pointer-events:none";
    stage.appendChild(scrim);

    overlay.appendChild(stage);

    // Only now the copy is in the document and has been laid out: a scroll
    // offset written to a detached element has no overflow to measure itself
    // against and is silently dropped.
    for (const { node, left, top } of scrolled) {
      node.scrollLeft = left;
      node.scrollTop = top;
    }

    /**
     * One tween for the card's motion, not a sequence. Every property it
     * moves through — how far up it has travelled, how small it has got, how
     * rounded and how lifted off the page behind it — is driven off the same
     * clock and the same ease, so the shrink is not a separate beat that
     * happens before the exit but the shape the exit has the whole way
     * through: the card is already smaller by the time it has moved its
     * first hundred pixels, and still shrinking as the last of it clears the
     * top edge.
     *
     * Chaining them was the obvious first cut and the wrong one. Two tweens
     * meeting in the middle is two gestures however tightly they are
     * overlapped — the card visibly settles at its small size, pauses, and
     * only then leaves.
     *
     * `power2.in` for the same reason there is only one tween: it leaves from
     * rest and accelerates the whole way out, so the motion has a soft start
     * and no landing. An `inOut` ease would spend its final, slowest quarter
     * decelerating a card that cleared the top edge some time ago — easing
     * into a stop nobody is there to see, and holding the overlay up for it.
     *
     * The scrim is a second tween on the same timeline at `"<"` — same start,
     * same duration, same ease as the motion above — so the dim still reads
     * as one property of the single gesture rather than an effect bolted on
     * after it, even though it is a different element under the hood.
     */
    timelineRef.current = gsap
      .timeline({ onComplete: clear })
      .to(stage, {
        yPercent: EXIT_Y,
        scale: EXIT_SCALE,
        borderRadius: EXIT_RADIUS,
        duration: EXIT_DURATION,
        ease: "power2.in",
      })
      .to(
        scrim,
        {
          opacity: EXIT_SCRIM_OPACITY,
          duration: EXIT_DURATION,
          ease: "power2.in",
        },
        "<",
      );
  }, [clear]);

  return (
    <PageTransitionContext value={{ playExit }}>
      <div ref={rootRef} style={{ display: "contents" }}>
        {children}
      </div>
      {/*
        Empty until a navigation starts, and a sibling of the captured wrapper
        rather than a child of it — inside, it would clone itself.

        `pointer-events-none` so the arriving page is live from the first
        frame: the departing copy is a picture, and a picture should not be
        eating clicks for the second it takes to leave.
      */}
      <div
        ref={overlayRef}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-200 overflow-hidden empty:hidden"
      />
    </PageTransitionContext>
  );
}
