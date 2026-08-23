"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether a CSS media query currently matches, kept live.
 *
 * The counterpart to `gsap.matchMedia` for the things a media query has to
 * decide at *render* time rather than at animation-build time — a prop whose
 * value changes how much work a child does, say. Between them the same query
 * string can drive both halves of a responsive decision without either half
 * having to know how the other is implemented.
 *
 * `useSyncExternalStore` rather than state and an effect, because the effect
 * version has a tear in it: it renders once with a guessed value, commits, and
 * only then corrects itself — so every consumer renders twice, and a consumer
 * whose render is expensive does that work twice. Here the subscription is the
 * `MediaQueryList` itself and the snapshot is read straight off it, so the
 * first client render after hydration already has the true answer.
 *
 * Returns `false` while the server-rendered markup is being hydrated, since
 * there is no viewport to measure there. Hydration requires the client's first
 * render to agree with the server's, so this is not a guess that could be
 * wrong — it is the same value both sides are obliged to use. Callers whose
 * answer actually matters should be behind a post-hydration gate of their own.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(
    () => window.matchMedia(query).matches,
    [query],
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
