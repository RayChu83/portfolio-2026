"use client";

import { useMediaQuery } from "./useMediaQuery";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Whether the visitor has asked the OS for less motion, kept live.
 *
 * A thin, named wrapper over {@link useMediaQuery} rather than each caller
 * spelling out the query string itself — the query is easy to get backwards
 * (`reduce` vs. `no-preference`), and a single spelling means every consumer
 * of this hook agrees with `gsap.matchMedia`'s own `(prefers-reduced-motion:
 * reduce)` branches on what "reduced" means.
 *
 * This is the render-time half of the decision. Where an animation's setup
 * genuinely needs to branch — two timelines, both real, that have to be built
 * and torn down as the preference changes — reach for `gsap.matchMedia`
 * directly instead, off the same query string; see `HeroAnimated.tsx` for
 * that pattern. Use this hook where a component needs the plain boolean: to
 * change what it renders, to read inside an effect that already re-runs off
 * other dependencies, or where one of the two branches is simply the absence
 * of the animation, which `matchMedia` has nothing to offer.
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery(QUERY);
}
