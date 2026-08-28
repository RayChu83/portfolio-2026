import Link from "next/link";
import {
  FaEnvelope,
  FaFileArrowDown,
  FaGithub,
  FaLinkedinIn,
} from "react-icons/fa6";

const LINKS = [
  {
    href: "mailto:chu.ray1219@gmail.com",
    label: "Email Ray",
    Icon: FaEnvelope,
  },
  {
    href: "https://www.linkedin.com/in/raychu83/",
    label: "LinkedIn",
    Icon: FaLinkedinIn,
  },
  {
    href: "https://github.com/RayChu83",
    label: "GitHub",
    Icon: FaGithub,
  },
  // TODO: point this at a real résumé once one is hosted — it currently
  // repeats the GitHub URL, which is what the labelled version linked to.
  {
    href: "https://github.com/RayChu83",
    label: "Résumé",
    Icon: FaFileArrowDown,
  },
] as const;

/**
 * The floating social nav, pinned to the top-right corner of the viewport for
 * the whole scroll.
 *
 * It has to stay readable over both of the page's grounds — the hero's white
 * and the work section's black — and those are not two static regions it could
 * be told about: the work section's ground is a GSAP tween on
 * `backgroundColor` that fades white to black and back as the section crosses
 * the middle of the viewport. Anything class-based would have to be driven by
 * that tween, which means either this component knowing about a section far
 * below it or a second scroll-observation system running alongside the one the
 * page already has.
 *
 * `mix-blend-mode: difference` answers it with no JavaScript at all. The
 * content is painted white and the compositor subtracts it from whatever is
 * behind: white over black stays white, white over white comes out black, and
 * every frame of the fade in between is handled by the same subtraction — no
 * sampling, no listener, no forced layout read on a page that is already
 * spending its frame budget on the hero.
 *
 * The one thing difference cannot do is mid-grey: at a background around
 * `#808080` the subtraction lands back near the same grey. That is only ever
 * true for a fraction of the 0.6s ground fade, never at rest, so it reads as
 * the nav dimming through the transition rather than as unreadable chrome.
 *
 * Blending needs the element to share a stacking context with what it is
 * blending against, so this is rendered as a sibling of the page's sections
 * rather than inside any of them — see `page.tsx`. `z-50` keeps it under
 * `PageLoader`'s `z-100` gate, which should cover it like everything else.
 */
export default function SocialLinks() {
  return (
    <nav
      aria-label="Social links"
      className="fixed top-0 right-0 z-50 flex items-center gap-5 p-6 text-white opacity-40 mix-blend-difference sm:gap-6 sm:p-8"
    >
      {LINKS.map(({ href, label, Icon }) => (
        <Link
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
          // Hover is a transform rather than a colour change: under difference
          // the colour is not this element's to choose, and dimming toward the
          // backdrop is the one direction that makes it harder to see.
          className="transition-transform duration-200 hover:-translate-y-0.5 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100"
        >
          <Icon className="size-3 sm:size-4" aria-hidden />
        </Link>
      ))}
    </nav>
  );
}
