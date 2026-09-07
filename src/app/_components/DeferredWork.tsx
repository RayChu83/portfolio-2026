"use client";

import dynamic from "next/dynamic";

/**
 * `Work` starts a full viewport below the fold, and its effect stack — the
 * carousel arc, the masks, the GSAP wiring — has no business in the bundle
 * that has to parse before the hero's first frame. `dynamic` keeps it in a
 * chunk of its own for exactly that reason.
 *
 * What it deliberately does *not* do any more is pass `ssr: false`. That flag
 * kept the section out of the server render too, and the section is where
 * every substantive word on this site lives — the two internships, the three
 * projects, their copy and their stacks. The rendered HTML contained none of
 * it: a crawler was handed a page whose entire body was the greeting, the
 * visitor counter and the footer links. Google's renderer would eventually
 * have run the JavaScript and found the rest, on a second pass it makes at
 * its own convenience; Bing, LinkedIn's unfurler, Slack's and every AI
 * crawler would not have. Server-rendering it puts the copy in the first
 * response, which is the only version of it that every consumer sees.
 *
 * Nothing in `Work` touches `window` outside an effect or an event handler,
 * and its media-query hooks return their server snapshot during hydration, so
 * the server render was always going to work — it was only ever switched off.
 *
 * A separate client component because `next/dynamic` is a client-side API; the
 * page is a Server Component and cannot call it.
 */
const Work = dynamic(() => import("./Work"));

export default function DeferredWork() {
  return <Work />;
}
