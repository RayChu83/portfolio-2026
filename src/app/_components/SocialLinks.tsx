"use client";

import Link from "next/link";
import EdgeFade from "@/components/edge-fade";
import { RESUME_PATH } from "@/lib/site";
import { useAskAI } from "./AskAI/AskAIContext";

/** The nav, in display order. An entry without an `href` opens Ask AI. */
const NAV = [
  { href: "mailto:chu.ray1219@gmail.com", label: "Send email" },
  { href: "https://www.linkedin.com/in/raychu83/", label: "LinkedIn" },
  { label: "Ask AI" },
  { href: "https://github.com/RayChu83", label: "GitHub" },
  { href: RESUME_PATH, label: "Resume" },
] as const;

/**
 * The floating nav, pinned to the top of the viewport for the whole scroll:
 * centered at `lg` and up, left-aligned with the page's own side padding
 * below it, wrapping onto further lines when the links do not fit.
 *
 * It has to stay readable over both of the page's grounds — the hero's white
 * and the work section's black — and those are not two static regions it
 * could be told about: the work section's ground is a GSAP tween on
 * `backgroundColor`. `mix-blend-mode: difference` answers it with no
 * JavaScript: the content is painted light and the compositor subtracts it
 * from whatever is behind, so every frame of the fade is handled by the same
 * subtraction. Blending needs a shared stacking context with what it blends
 * against, so this is rendered as a sibling of the page's sections — see
 * `page.tsx`.
 */
export default function SocialLinks() {
  const { openAskAI } = useAskAI();

  return (
    <>
      {/* A white fade with a progressive blur behind the nav, so page content
          scrolling under it is softened rather than cut off. Just under the
          nav's z-index so the nav still blends against it. */}
      <EdgeFade
        edge="top"
        peak={1}
        className="fixed inset-x-0 top-0 z-39 h-28"
      />

      {/* The wrapper spans the viewport but ignores the pointer, so only the
          links themselves take clicks. */}
      <nav
        aria-label="Primary"
        className="pointer-events-none fixed inset-x-0 top-0 z-40 flex flex-wrap items-center gap-x-5 gap-y-1 px-6 pt-5 font-aeonik-regular text-sm text-neutral-500 mix-blend-difference sm:px-12 lg:justify-center lg:gap-x-6"
      >
        {NAV.map((item) => {
          const className =
            "pointer-events-auto cursor-pointer whitespace-nowrap transition-colors hover:text-white focus-visible:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current motion-reduce:transition-none";
          return "href" in item ? (
            <Link
              key={item.label}
              href={item.href}
              target={item.href.startsWith("mailto:") ? undefined : "_blank"}
              rel="noopener noreferrer"
              className={className}
            >
              {item.label}
            </Link>
          ) : (
            <button
              key={item.label}
              type="button"
              onClick={openAskAI}
              className={`${className} text-neutral-300`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </>
  );
}
