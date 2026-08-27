"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "../_hooks/usePrefersReducedMotion";
import HeroAnimated from "./HeroAnimated";
import HeroStatic from "./HeroStatic";
import { COMPACT, type MapData } from "./hero-shared";

/**
 * The hero, in one of its two builds.
 *
 * `HeroAnimated` is the reveal: pinned, scrubbed, three beats read out as the
 * visitor scrolls. `HeroStatic` is the same three beats as three still panels,
 * for visitors who have asked for less motion. They show the same graphics and
 * the same words; only the movement between them differs.
 *
 * A switch in a parent rather than an early return inside one component,
 * because the two builds do not agree on hooks — the animated one calls
 * `useTilt`, `useGSAP` and a portal handshake that the static one has no use
 * for, and hooks cannot be called conditionally. Splitting them also means a
 * preference flipped mid-session is a clean unmount and mount rather than two
 * builds contending over the same inline styles on the same elements, which is
 * what the interleaved version had to keep untangling.
 *
 * Which leaves this component holding exactly the two things neither build can
 * own alone: the preference, and the map.
 */
export default function HeroHeadshot() {
  // The map's precomputed geometry, dynamic-imported after mount so the JSON
  // for the *other* density never ships, and nothing about the map sits on the
  // hero's first paint. Fetched here rather than in either build because both
  // want it and only this component knows which density to ask for — and
  // because a visitor toggling the preference should not re-download it.
  const [mapData, setMapData] = useState<MapData | null>(null);

  // Reads `false` during hydration, like every media-query hook here, so the
  // server's markup and the hydrating render agree — the animated build is
  // what the server renders, and the swap happens on the commit after. The one
  // paint before it corrects is the paint the site always had.
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    let cancelled = false;
    // Decided off `matchMedia` directly rather than a hook value, which is
    // still `false` during hydration — keying the import off it would fetch
    // the full-density file first and the compact one a beat later.
    const wantsCompact = window.matchMedia(COMPACT).matches;
    (wantsCompact
      ? import("./map-data.compact.json")
      : import("./map-data.full.json")
    ).then((module_) => {
      if (!cancelled) setMapData(module_.default as MapData);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return reducedMotion ? (
    <HeroStatic mapData={mapData} />
  ) : (
    <HeroAnimated mapData={mapData} />
  );
}
