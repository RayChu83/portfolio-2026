"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { usePageTransition } from "./PageTransition";

type TransitionLinkProps = ComponentProps<typeof Link>;

/**
 * A `next/link` that plays the page-to-page transition on its way out.
 *
 * The work hangs off `onNavigate` rather than `onClick`, which is the whole
 * reason this component is three lines of logic: Next only fires
 * `onNavigate` for navigations it is actually going to perform on the client.
 * A cmd-click opening a new tab, an external URL, a `download` link — all of
 * them reach `onClick` and none of them reach here, so none of them can leave
 * a frozen copy of the page sitting over a tab that never navigated.
 *
 * The navigation is not prevented and not deferred. The copy is taken while
 * the old DOM is still standing, the router commits underneath it, and the
 * arriving page is what the copy uncovers as it goes — waiting for the
 * animation to finish before pushing would put a second of dead air between
 * the click and the request instead.
 */
export default function TransitionLink({
  onNavigate,
  ...props
}: TransitionLinkProps) {
  const { playExit } = usePageTransition();
  const pathname = usePathname();

  return (
    <Link
      {...props}
      onNavigate={(event) => {
        /**
         * The event Next hands to `onNavigate` exposes `preventDefault()` and
         * nothing else — no `defaultPrevented` to read back afterwards. So a
         * caller that wants to cancel is given a stand-in that both cancels
         * for real and leaves a note here, which is the only way to find out
         * whether there is still going to be a navigation to decorate.
         */
        let cancelled = false;
        onNavigate?.({
          preventDefault: () => {
            cancelled = true;
            event.preventDefault();
          },
        });

        // A cancelled navigation gets no transition; neither does a link
        // pointing at the page already on screen, where there would be
        // nothing behind the departing copy to reveal.
        if (cancelled) return;
        if (typeof props.href === "string" && props.href === pathname) return;

        playExit();
      }}
    >
      {props.children}
    </Link>
  );
}
