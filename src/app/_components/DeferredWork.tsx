"use client";

import dynamic from "next/dynamic";

/**
 * `Work` starts a full viewport below the fold, and its effect stack — the
 * carousel arc, the masks, the GSAP wiring — has no business in the bundle
 * that has to parse before the hero's first frame. `ssr: false` keeps it out
 * of the server render too, which nothing above the fold ever sees.
 *
 * A separate client component because `ssr: false` is only allowed inside
 * one — a Server Component (the page) cannot pass it to `next/dynamic`.
 */
const Work = dynamic(() => import("./Work"), { ssr: false });

export default function DeferredWork() {
  return <Work />;
}
