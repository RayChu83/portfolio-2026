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

const AURORA =
  "linear-gradient(90deg, rgb(0,90,200) 0%, rgb(90,60,220) 35%, rgb(200,100,20) 70%, rgb(170,20,190) 100%)";

const ITEM_CLASS =
  "pointer-events-auto cursor-pointer whitespace-nowrap transition-colors hover:text-neutral-900 focus-visible:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current motion-reduce:transition-none";

/** Floating top nav, centered at `lg` and up, wrapping when links don't fit. */
export default function SocialLinks() {
  const { openAskAI } = useAskAI();

  return (
    <>
      <EdgeFade
        edge="top"
        peak={1}
        className="fixed inset-x-0 top-0 z-39 h-28"
      />

      {/* Ignores the pointer so only the links take clicks. */}
      <nav
        aria-label="Primary"
        className="pointer-events-none fixed inset-x-0 top-0 z-40 flex flex-wrap items-center gap-x-5 gap-y-1 px-6 pt-5 font-aeonik-regular text-sm text-neutral-500 sm:px-12 lg:justify-center lg:gap-x-6"
      >
        {NAV.map((item) =>
          "href" in item ? (
            <Link
              key={item.label}
              href={item.href}
              target={item.href.startsWith("mailto:") ? undefined : "_blank"}
              rel="noopener noreferrer"
              className={ITEM_CLASS}
            >
              {item.label}
            </Link>
          ) : (
            <button
              key={item.label}
              type="button"
              onClick={openAskAI}
              className="pointer-events-auto cursor-pointer whitespace-nowrap bg-clip-text text-transparent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
              style={{ backgroundImage: AURORA }}
            >
              {item.label}
            </button>
          ),
        )}
      </nav>
    </>
  );
}
