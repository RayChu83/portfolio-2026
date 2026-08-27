"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import kawaiiHeadshotBackground from "../../../public/kawaii_headshot_background.svg";
import kawaiiHeadshotForeground from "../../../public/kawaii_headshot_foreground.svg";

/**
 * The two drawn layers the hero paints over the photograph. These are the
 * only things the gate waits for: they are SVGs, which Next serves at their
 * static URL — so preloading `src` here warms exactly the request the page
 * goes on to make. The photograph is *not* on this list, deliberately: as a
 * raster it is routed through `/_next/image`, so its static-import `src` is a
 * different URL from the one the page paints, and preloading it fetched a
 * copy the visitor never saw while releasing the gate with the real request
 * still cold. It carries `priority` on its `<Image>` instead, which has Next
 * emit a preload for the URL that is actually painted.
 */
const HERO_IMAGES = [
  kawaiiHeadshotBackground.src,
  kawaiiHeadshotForeground.src,
];

/**
 * However fast the network is, a visitor is never held here longer than
 * this. Short, because the gate now exists only to keep the two drawings
 * from popping in out of order — the fonts are `display: swap` and paint a
 * fallback face immediately, so there is nothing else worth holding a white
 * screen for. A long gate converts a slow-but-progressive load into a blank
 * one, which is strictly worse.
 */
const FALLBACK_TIMEOUT = 1500;

const preload = (src: string) =>
  new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });

/**
 * Holds the page behind a plain spinner until the hero's two drawn layers
 * are in hand, so they arrive as one picture rather than piecemeal.
 *
 * The page itself is still rendered underneath from the first frame, not
 * mounted late — this only paints over it, so there is nothing extra for the
 * browser to construct once the gate lifts.
 */
export default function PageLoader({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fallback = window.setTimeout(() => {
      if (!cancelled) setReady(true);
    }, FALLBACK_TIMEOUT);

    Promise.all(HERO_IMAGES.map(preload)).then(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
    };
  }, []);

  return (
    <>
      {children}
      <div
        aria-hidden
        className={`fixed inset-0 z-100 flex items-center justify-center bg-white transition-opacity duration-500 ${
          ready ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        {/* Under reduced motion the spin stops and the accent segment goes,
            leaving a plain static ring — still a "loading" mark, no longer a
            perpetual rotation the preference asked not to see. */}
        <div className="size-10 animate-spin motion-reduce:animate-none rounded-full border-2 border-neutral-200 border-t-neutral-800 motion-reduce:border-t-neutral-200" />
      </div>
    </>
  );
}
