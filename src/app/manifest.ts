import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_JOB_TITLE, SITE_NAME } from "@/lib/site";

/**
 * The web app manifest, emitted at `/manifest.webmanifest`.
 *
 * Not a ranking factor on its own, and worth being honest about that: what it
 * buys is the last of the "this is a complete, well-formed site" signals that
 * Lighthouse's SEO and PWA audits look for, and a home-screen install on
 * Android that carries a name and an icon instead of a screenshot and a URL.
 *
 * `display: "browser"` rather than `"standalone"`. This is a one-page site
 * that is read and linked out of, not an app — launching it chromeless would
 * take the back button and the address bar away from a visitor whose next
 * action is almost certainly following a link to LinkedIn or GitHub.
 *
 * The colours are the same two the rest of the site states: `theme_color`
 * matches the `themeColor` in the root layout's `viewport` export, and
 * `background_color` is the white the page opens on, so a splash screen does
 * not flash a different ground than the page behind it.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — ${SITE_JOB_TITLE}`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "browser",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        /**
         * `any`, not `maskable`. A maskable icon is cropped to whatever shape
         * the launcher wants and needs its subject inside the safe zone; this
         * is a headshot that already fills its frame, and declaring it
         * maskable would have Android crop the top of Ray's head off.
         */
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
