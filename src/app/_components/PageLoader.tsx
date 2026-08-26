"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import headshotPhoto from "../../../public/headshot.png";
import kawaiiHeadshotBackground from "../../../public/kawaii_headshot_background.svg";
import kawaiiHeadshotForeground from "../../../public/kawaii_headshot_foreground.svg";

/**
 * The images the hero paints before a single pixel of scroll has happened —
 * everything a visitor sees without doing anything first. Preloading exactly
 * these, and nothing further down the page, is what lets the gate close in
 * roughly the time the hero itself takes to become presentable rather than
 * waiting on art the visitor has to scroll to earn.
 */
const HERO_IMAGES = [
  headshotPhoto.src,
  kawaiiHeadshotBackground.src,
  kawaiiHeadshotForeground.src,
];

/**
 * However fast the network is, a visitor is never held here longer than
 * this — a slow font CDN or a stalled image request should degrade to the
 * page arriving unstyled for a moment, not to a loader that never lets go.
 */
const FALLBACK_TIMEOUT = 4000;

const preload = (src: string) =>
  new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });

/**
 * Holds the page behind a plain spinner until the things its first screen
 * actually depends on are in hand: the webfonts the hero's type is measured
 * in, and the three layered images it paints. Without this gate those arrive
 * piecemeal — a fallback face swapping to the real one, drawings popping in
 * out of order — which is the "looks broken, then fine a few seconds later"
 * visitors were seeing.
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

    const fonts =
      typeof document.fonts !== "undefined"
        ? document.fonts.ready.catch(() => {})
        : Promise.resolve();

    Promise.all([fonts, ...HERO_IMAGES.map(preload)]).then(() => {
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
        <div className="size-10 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-800" />
      </div>
    </>
  );
}
