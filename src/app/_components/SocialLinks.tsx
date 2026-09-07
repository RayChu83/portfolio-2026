"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RESUME_PATH } from "@/lib/site";
import { MdArrowOutward } from "react-icons/md";
import { RxCross1, RxHamburgerMenu } from "react-icons/rx";
import { usePrefersReducedMotion } from "../_hooks/usePrefersReducedMotion";

const LINKS = [
  { href: "mailto:chu.ray1219@gmail.com", label: "Email" },
  { href: "https://www.linkedin.com/in/raychu83/", label: "LinkedIn" },
  { href: "https://github.com/RayChu83", label: "GitHub" },
  { href: RESUME_PATH, label: "Résumé" },
] as const;

/** How long the sheet takes to cover the screen, in ms. */
const SHEET_MS = 700;

/** The gap between one line starting to rise and the next, in ms. */
const LINE_STAGGER_MS = 70;

/**
 * The panel's easing — a symmetric in-out curve, so the sheet leaves the way
 * it arrived rather than snapping back.
 */
const EASE = "cubic-bezier(0.76, 0, 0.24, 1)";

/**
 * The floating nav: a hamburger pinned to the top-right corner of the
 * viewport for the whole scroll, and the full-screen white sheet it opens.
 *
 * The trigger has to stay readable over both of the page's grounds — the
 * hero's white and the work section's black — and those are not two static
 * regions it could be told about: the work section's ground is a GSAP tween
 * on `backgroundColor` that fades white to black and back as the section
 * crosses the middle of the viewport. Anything class-based would have to be
 * driven by that tween, which means either this component knowing about a
 * section far below it or a second scroll-observation system running
 * alongside the one the page already has.
 *
 * `mix-blend-mode: difference` answers it with no JavaScript at all. The
 * content is painted white and the compositor subtracts it from whatever is
 * behind: white over black stays white, white over white comes out black, and
 * every frame of the fade in between is handled by the same subtraction — no
 * sampling, no listener, no forced layout read on a page that is already
 * spending its frame budget on the hero. It is also what carries the trigger
 * across the sheet itself: the panel slides up *underneath* the button, and
 * the same subtraction turns the glyph black against it without a second
 * colour to keep in sync.
 *
 * Blending needs the element to share a stacking context with what it is
 * blending against, so this is rendered as a sibling of the page's sections
 * rather than inside any of them — see `page.tsx`.
 *
 * Layering: the sheet is `z-90` and the trigger `z-95`, so the panel covers
 * the page but never the control that closes it. Both stay under
 * `PageLoader`'s `z-100` gate, which should cover them like everything else.
 *
 * The open/close motion is a CSS transition rather than a GSAP timeline on
 * purpose: it is one transform per element, driven entirely by a boolean this
 * component already holds, and a transition reverses mid-flight for free —
 * interrupt the open halfway and the sheet retreats from where it actually
 * is, which is exactly the "outwards the same way, reversed" behaviour asked
 * for. A timeline would need its own playhead management to do the same.
 */
export default function SocialLinks() {
  const [open, setOpen] = useState(false);
  const reduceMotion = usePrefersReducedMotion();

  // Scroll lock. The sheet covers the viewport, so anything the wheel does
  // behind it is invisible movement the visitor cannot see the result of —
  // and on the page's pinned hero it is movement that costs a full
  // ScrollTrigger pass per frame.
  //
  // This has to go on `<html>`, not `<body>`. The usual `body { overflow:
  // hidden }` lock only works because the body's overflow *propagates* to the
  // viewport — and propagation happens only while the root element's own
  // overflow is `visible`. `globals.css` gives `html` an `overflow-x: clip`
  // (the headshot tilts past its box and must not scroll the page sideways),
  // and a root with one axis clipped no longer computes `visible` on the
  // other, so the root keeps the scroll for itself and a lock on the body is
  // simply ignored. Setting it here locks the actual scroller.
  //
  // `overflow: hidden` rather than `position: fixed` because it holds the
  // scroll offset where it is instead of needing it saved and restored, and
  // the padding makes up for the scrollbar the lock removes — both so the
  // page underneath does not jump, and so the width change does not fire a
  // resize that has ScrollTrigger re-measure the pinned hero.
  useEffect(() => {
    if (!open) return;

    const root = document.documentElement;
    const gutter = window.innerWidth - root.clientWidth;
    const previousOverflow = root.style.overflow;
    const previousPadding = root.style.paddingRight;

    root.style.overflow = "hidden";
    if (gutter > 0) root.style.paddingRight = `${gutter}px`;

    return () => {
      root.style.overflow = previousOverflow;
      root.style.paddingRight = previousPadding;
    };
  }, [open]);

  // Escape closes it, the same as clicking the trigger. Bound only while the
  // sheet is up, so the page carries no listener at rest.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const sheetMs = reduceMotion ? 0 : SHEET_MS;

  return (
    <>
      {/* The panel. It is always mounted — mounting it on open would mean the
          first frame of the entrance is also the frame the browser lays it
          out in, which is the one frame it cannot afford — and held at zero
          opacity when closed.
          The white itself fades rather than sliding: the ground arriving as a
          wash lets the lines be the thing that travels, and a transform on
          the sheet would have carried them with it. `inert` is what keeps the
          invisible copy out of the tab order and out of a screen reader's
          document, and `pointer-events-none` keeps a transparent full-screen
          box from swallowing clicks meant for the page under it — neither of
          which zero opacity does on its own. */}
      <div
        id="site-menu"
        inert={!open}
        aria-hidden={!open}
        className={`fixed inset-0 z-90 bg-white will-change-[opacity] ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        } motion-reduce:transition-none`}
        style={{ transition: `opacity ${sheetMs}ms ${EASE}` }}
      >
        <nav
          aria-label="Social links"
          className="flex h-full flex-col justify-center gap-8 px-8 sm:px-16"
        >
          {LINKS.map(({ href, label }, index) => (
            // Each line rides up out of its own clipped box, so the text is
            // revealed by the edge of that box rather than sliding in from
            // nowhere. The stagger runs forwards on the way in and is
            // deliberately dropped on the way out: the sheet is leaving with
            // the text on it, and holding lines back while their ground
            // retreats reads as lag, not choreography.
            <span key={label} className="block overflow-hidden py-1">
              <Link
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className={`group flex items-baseline gap-3 font-aeonik-regular text-5xl tracking-tighter text-neutral-900 transition-[transform,opacity] sm:text-7xl lg:text-8xl motion-reduce:!translate-y-0 motion-reduce:!opacity-100 motion-reduce:transition-none ${
                  open
                    ? "translate-y-0 opacity-100"
                    : "translate-y-full opacity-0"
                }`}
                style={{
                  transitionDuration: `${reduceMotion ? 0 : SHEET_MS}ms`,
                  transitionTimingFunction: EASE,
                  transitionDelay: reduceMotion
                    ? "0ms"
                    : open
                      ? `${100 + index * LINE_STAGGER_MS}ms`
                      : "0ms",
                }}
              >
                {label}
                <MdArrowOutward
                  className="size-6 shrink-0 self-start text-neutral-400 transition-[transform,color] duration-200 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-neutral-900 sm:size-9 lg:size-11 motion-reduce:transition-none motion-reduce:group-hover:translate-none"
                  aria-hidden
                />
              </Link>
            </span>
          ))}
        </nav>
      </div>

      {/* Above the sheet, and the only thing that is. */}
      <button
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-expanded={open}
        aria-controls="site-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        className="fixed top-0 right-0 z-95 cursor-pointer p-6 text-white mix-blend-difference transition-transform duration-200 hover:scale-110 focus-visible:outline-2 focus-visible:-outline-offset-8 focus-visible:outline-current sm:p-8 motion-reduce:transition-none motion-reduce:hover:scale-100"
      >
        {open ? (
          <RxCross1 className="size-8 sm:size-10" aria-hidden />
        ) : (
          <RxHamburgerMenu className="size-8 sm:size-10" aria-hidden />
        )}
      </button>
    </>
  );
}
