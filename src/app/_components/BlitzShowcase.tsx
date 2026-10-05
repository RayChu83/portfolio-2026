"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { MeshGradient } from "@paper-design/shaders-react";
import Image from "next/image";
import { useRef } from "react";
import { usePrefersReducedMotion } from "../_hooks/usePrefersReducedMotion";

gsap.registerPlugin(useGSAP);

type Tile = { src: string; aspect: string; center?: boolean };

/**
 * Three columns of screens, each cropped to its own aspect ratio and offset
 * vertically so the edges don't line up. The dashboard sits in the middle of
 * the middle column. The grid is larger than the frame and tilted, so the
 * outer tiles bleed off every edge. Classes are spelled out for Tailwind.
 */
const COLUMNS: { offset: string; tiles: Tile[] }[] = [
  {
    offset: "-translate-y-[9%]",
    tiles: [
      { src: "/blitz/commerce.png", aspect: "aspect-[4/3]" },
      { src: "/blitz/funding_methods_1.png", aspect: "aspect-[16/9]" },
      { src: "/blitz/workforce.png", aspect: "aspect-[1/1]" },
    ],
  },
  {
    offset: "translate-y-[5%]",
    tiles: [
      { src: "/blitz/enterprise_bento.png", aspect: "aspect-[16/9]" },
      { src: "/blitz/dashboard.png", aspect: "aspect-[3364/2124]", center: true },
      { src: "/blitz/autopilot_business.png", aspect: "aspect-[4/3]" },
    ],
  },
  {
    offset: "-translate-y-[3%]",
    tiles: [
      { src: "/blitz/settings.png", aspect: "aspect-[1/1]" },
      { src: "/blitz/profile.png", aspect: "aspect-[16/9]" },
      { src: "/blitz/sign-in.png", aspect: "aspect-[4/3]" },
    ],
  },
];

/**
 * The Blitz dashboard at the centre of a tilted grid of the product's other
 * screens. When `active` turns on, the dashboard fades and scales in first and
 * the surrounding tiles follow outward from it.
 */
export default function BlitzShowcase({ active }: { active: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useGSAP(
    () => {
      const center = ".blitz-center";
      const tiles = ".blitz-tile";

      if (prefersReducedMotion || !active) {
        gsap.set([center, tiles], { opacity: active ? 1 : 0, scale: 1 });
        return;
      }

      const from = { opacity: 0, scale: 0.98 };
      const to = { opacity: 1, scale: 1, duration: 1.1, ease: "power3.out" };
      gsap.fromTo(center, from, to);
      gsap.fromTo(tiles, from, {
        ...to,
        delay: 0.2,
        stagger: { each: 0.08, from: "center" },
      });
    },
    { scope: rootRef, dependencies: [active, prefersReducedMotion] },
  );

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 overflow-hidden [container-type:inline-size]"
    >
      <MeshGradient
        className="absolute inset-0 h-full w-full"
        colors={["#e9d5ff", "#f0abfc", "#a5b4fc", "#fbcfe8", "#c4b5fd"]}
        distortion={0.9}
        swirl={0.6}
        grainMixer={0.1}
        grainOverlay={0}
        speed={prefersReducedMotion || !active ? 0 : 0.6}
      />
      <div className="absolute left-1/2 top-1/2 flex w-[190%] -translate-x-1/2 -translate-y-1/2 -rotate-[28deg] items-center gap-[2.5cqw]">
        {COLUMNS.map((column, c) => (
          <div
            key={c}
            className={`flex min-w-0 flex-1 flex-col gap-[2.5cqw] ${column.offset}`}
          >
            {column.tiles.map((tile) => (
              <div
                key={tile.src}
                className={`${tile.center ? "blitz-center z-10 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.18)]" : "blitz-tile shadow-[0_4px_16px_-6px_rgba(0,0,0,0.12)]"} ${tile.aspect} overflow-hidden rounded-lg bg-white opacity-0 ring-1 ring-black/5 will-change-transform`}
              >
                <Image
                  src={tile.src}
                  alt={tile.center && active ? "Blitz dashboard" : ""}
                  width={1600}
                  height={1000}
                  sizes="(min-width: 1024px) 30vw, 70vw"
                  priority={tile.center}
                  className="block h-full w-full object-cover object-top"
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
