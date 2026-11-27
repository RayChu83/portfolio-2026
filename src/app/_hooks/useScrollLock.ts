"use client";

import { useEffect } from "react";

let activeLocks = 0;

function applyLock() {
  const root = document.documentElement;
  const gutter = window.innerWidth - root.clientWidth;
  root.style.overflow = "hidden";
  if (gutter > 0) root.style.paddingRight = `${gutter}px`;
}

function releaseLock() {
  const root = document.documentElement;
  root.style.overflow = "";
  root.style.paddingRight = "";
}

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
 *
 * Never reads the styles it is about to overwrite, and applies them one task
 * late. The Ask AI drawer's own (Base UI) scroll lock saves and restores
 * `<html>`'s styles on a zero-delay timer, so when the viewport crosses the
 * `lg` breakpoint while the panel is open, the drawer's release lands after
 * the sidebar mounts. A lock that remembered "previous" styles at mount would
 * remember the drawer's `overflow: hidden` and put it back on close, leaving
 * the page stuck. The site never sets these inline, so the unlocked state is
 * simply empty; and a lock applied after the drawer's timer cannot be undone
 * by it. A count lets two locks overlap without the first release unlocking
 * the second.
 */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    let applied = false;
    const id = window.setTimeout(() => {
      applied = true;
      activeLocks += 1;
      if (activeLocks === 1) applyLock();
    }, 0);

    return () => {
      window.clearTimeout(id);
      if (!applied) return;
      activeLocks -= 1;
      if (activeLocks === 0) releaseLock();
    };
  }, [locked]);
}
