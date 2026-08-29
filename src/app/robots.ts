import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * `robots.ts` rather than a static `robots.txt` for one reason: the sitemap
 * line has to carry an absolute URL, and a literal one in a text file is a
 * second place the domain is written down and a second place it goes stale.
 * This reads it from the same constant `sitemap.ts` and the layout do.
 *
 * Cached and emitted at build time — nothing here reads the request.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      /**
       * `/api/visitor-count` increments a counter and plants a cookie on a
       * plain `GET` — the increment is a side effect of *who is asking*, not
       * of the verb — so a crawler that follows it is a crawler inflating the
       * number the footer prints. There is nothing in there to index either
       * way.
       *
       * Worth being clear about what this does and does not buy: robots.txt
       * is advisory. Googlebot and Bingbot honour it; a scraper written this
       * afternoon will not. The real defence is already in the route — the
       * per-network device cap in `MAX_DEVICES_PER_NETWORK` bounds what any
       * one address can add no matter how many requests it sends. This just
       * keeps the well-behaved majority from tripping it in the first place.
       */
      disallow: "/api/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
