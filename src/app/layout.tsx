import type { Metadata, Viewport } from "next";
import { aeonikVariables } from "./fonts/aeonik";
import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import PageLoader from "./_components/PageLoader";
import PageTransition from "./_components/PageTransition";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  /**
   * The base every relative URL below is resolved against — the canonical
   * link, and the `opengraph-image.png` sitting beside this file.
   *
   * Not optional in practice: Open Graph consumers do not resolve relative
   * URLs, so without a base Next has nothing to build an absolute `og:image`
   * from and warns at build time before falling back to `localhost`. A
   * preview card pointing at localhost is a preview card nobody outside this
   * laptop can load.
   */
  metadataBase: new URL(SITE_URL),

  title: {
    /**
     * What a tab, a bookmark and a search result say when the page sets no
     * title of its own — which today is every page, there being one.
     *
     * Front-loaded with the name because that is the query this site is
     * competing for, and because a tab strip truncates from the right.
     */
    default: "Ray Chu — Software Engineer",
    /**
     * Waiting for the second page. A route that exports `title: "Writing"`
     * gets "Writing · Ray Chu" without having to remember the suffix.
     */
    template: "%s · Ray Chu",
  },
  description: SITE_DESCRIPTION,

  /**
   * Says this URL is the original, which is the answer to every accidental
   * duplicate of it: the `.vercel.app` deployment domains, a `www.` host, a
   * link that arrives carrying `?utm_source=…`. All of them serve the same
   * HTML, and all of them now point home rather than competing with it.
   */
  alternates: { canonical: "/" },

  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,

  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "Ray Chu — Software Engineer",
    description: SITE_DESCRIPTION,
    locale: "en_US",
    /**
     * No `images` key on purpose. `opengraph-image.png` next to this file is
     * picked up by the file convention, which reads the file to fill in
     * `og:image:type`, `:width` and `:height` as well — facts that would have
     * to be hand-written and hand-maintained here, and that Facebook and
     * iMessage use to reserve the right box before the image has loaded.
     * Listing it here as well would emit the tag twice.
     */
  },

  twitter: {
    /**
     * The large card rather than the default thumbnail-beside-text one.
     * Twitter falls back to `og:image` when no `twitter-image` file exists,
     * so this one line is the whole difference between a postage stamp and a
     * full-width preview.
     */
    card: "summary_large_image",
    title: "Ray Chu — Software Engineer",
    description: SITE_DESCRIPTION,
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      /**
       * Without this Google shows at most a thumbnail beside the result. The
       * site is a visual portfolio; the larger preview is the point.
       */
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

/**
 * A separate export, not a field on `metadata` — `viewport` and `themeColor`
 * moved out of the metadata object and live here.
 *
 * Next already emits the default `width=device-width, initial-scale=1`, so
 * what this adds is `themeColor`: the colour Safari and Chrome on Android
 * paint their own chrome with. White because the page opens on a white hero,
 * and the alternative is a browser bar in the OS default grey butting against
 * it.
 */
export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn(aeonikVariables, "font-sans", inter.variable)}
    >
      <body className="min-h-full flex flex-col">
        {/* Inside the loader, not outside it: the loader's gate is a fixed
            sheet painted over the page and has nothing to do with routing,
            while the transition needs to own the page's own top-level nodes
            so it can photograph them on the way out. Nesting it the other way
            would put the gate inside the picture. */}
        <PageLoader>
          <PageTransition>{children}</PageTransition>
        </PageLoader>
      </body>
    </html>
  );
}
