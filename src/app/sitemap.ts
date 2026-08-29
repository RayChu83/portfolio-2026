import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * One page, one entry — which is worth writing down rather than skipping.
 *
 * The value is not that Google would otherwise fail to find a single-page
 * site; it is that a sitemap is what Search Console wants submitted, and what
 * gives a `lastModified` date to compare against on the next crawl.
 *
 * `lastModified` is deliberately the build time rather than `new Date()`
 * evaluated per request: this file is statically generated, so the date is
 * stamped when the site is deployed and moves only when the site actually
 * changes. A per-request date would claim the page was modified seconds ago
 * every single time a crawler looked, which is a claim crawlers learn to stop
 * believing.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
