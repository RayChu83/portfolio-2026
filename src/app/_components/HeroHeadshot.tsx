"use client";

import Image from "next/image";
import kawaiiHeadshotBackground from "../../../public/kawaii_headshot_background.svg";
import kawaiiHeadshotForeground from "../../../public/kawaii_headshot_foreground.svg";
import { useTilt } from "../_hooks/useTilt";

/**
 * Camera distance in px. Must stay in step with the `perspective-distant`
 * utility on the scene wrapper, which Tailwind defines as 1200px — the maths
 * below reads depth as a fraction of it.
 */
const PERSPECTIVE = 1200;

/** How far in front of the head the face features float, in px. */
const FOREGROUND_DEPTH = 70;

/**
 * A layer at +z projects larger by PERSPECTIVE / (PERSPECTIVE - depth). Scaling
 * it back by the inverse keeps the features registered to the head at rest, so
 * depth changes only how they slide when the head turns — not how big they are.
 */
const FOREGROUND_SCALE = (PERSPECTIVE - FOREGROUND_DEPTH) / PERSPECTIVE;

/**
 * Degrees the whole head turns at full tilt.
 *
 * One rotation drives both layers, because that is what a rigid object does:
 * the depth between them, not a difference in their angles, is what produces
 * the parallax. Perspective then generates it for free, with the right
 * magnitude everywhere in the frame and the right sign on both sides.
 *
 * rotateX is negative so the two axes agree in handedness — a positive rotateY
 * turns the right edge away from the camera, and a negative rotateX does the
 * same for the bottom edge. Mixing them makes the head follow the pointer
 * sideways while shying away from it vertically.
 */
const SWING = { rotateX: -8, rotateY: 12 };

/**
 * The features float in front of the head, so they cast onto it. The offset
 * leans against the tilt — the shadow pools on the side the layer has slid away
 * from — over a small fixed offset that keeps a light source overhead at rest.
 */
const FOREGROUND_SHADOW =
  "drop-shadow(calc(var(--tilt-x, 0) * -8px + 2px) " +
  "calc(var(--tilt-y, 0) * -8px + 3px) 4px rgb(0 0 0 / 0.2))";

export default function HeroHeadshot() {
  // Driven by the pointer anywhere on the page, or by the device's own tilt on
  // phones and tablets. Publishes `--tilt-x` / `--tilt-y` onto the scene below.
  const sceneRef = useTilt<HTMLDivElement>();

  return (
    <div className="flex-1 min-h-0 flex justify-center">
      {/* Perspective lives on a wrapper that is exactly the scene's box, so the
          vanishing point sits at the headshot's centre no matter how the row
          around it is laid out. */}
      <div className="h-full aspect-square max-w-full perspective-distant">
        {/* Both SVGs share a 1:1 viewBox with `preserveAspectRatio="xMidYMid
            meet"`, so rendering them into the same square box lines their
            artwork up exactly, whatever size that box ends up. */}
        <div
          ref={sceneRef}
          className="relative size-full transform-3d will-change-transform"
          style={{
            transform:
              `rotateX(calc(var(--tilt-y, 0) * ${SWING.rotateX}deg)) ` +
              `rotateY(calc(var(--tilt-x, 0) * ${SWING.rotateY}deg))`,
          }}
        >
          <Image
            src={kawaiiHeadshotBackground}
            alt="Kawaii-style headshot of Ray"
            loading="eager"
            fill
            className="block pointer-events-none object-contain"
            style={{ transform: "translateZ(0px)" }}
          />
          <Image
            src={kawaiiHeadshotForeground}
            alt=""
            aria-hidden
            loading="eager"
            fill
            className="block pointer-events-none object-contain"
            style={{
              transform: `translateZ(${FOREGROUND_DEPTH}px) scale(${FOREGROUND_SCALE})`,
              filter: FOREGROUND_SHADOW,
            }}
          />
        </div>
      </div>
    </div>
  );
}
