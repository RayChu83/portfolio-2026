"use client";

import { useEffect } from "react";

/**
 * Locks page scroll while `locked` is true. Anything the wheel does
 * behind it is invisible movement the visitor cannot see the result of —
 * and on the page's pinned hero it is movement that costs a full
 * ScrollTrigger pass per frame.
 * This has to go on `<html>`, not `<body>`. The usual `body { overflow:
 * hidden }` lock only works because the body's overflow *propagates* to the
 * viewport — and propagation happens only while the root element's own
 * overflow is `visible`. `globals.css` gives `html` an `overflow-x: clip`
 * (the headshot tilts past its box and must not scroll the page sideways),
 * and a root with one axis clipped no longer computes `visible` on the
 * other, so the root keeps the scroll for itself and a lock on the body is
 * simply ignored. Setting it here locks the actual scroller.
 * `overflow: hidden` rather than `position: fixed` because it holds the
 * scroll offset where it is instead of needing it saved and restored, and
 * the padding makes up for the scrollbar the lock removes — both so the
 * page underneath does not jump, and so the width change does not fire a
 * resize that has ScrollTrigger re-measure the pinned hero.
 */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

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
  }, [locked]);
}
