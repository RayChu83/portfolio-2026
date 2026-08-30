/**
 * The one place the site's public identity is written down.
 *
 * Four separate things need to agree on it — the `metadata` export in the
 * root layout, `robots.ts`, `sitemap.ts`, and the absolute URLs Next resolves
 * OG images against — and three of them are files a person edits only once a
 * year, which is exactly how a stale domain survives a migration. Importing
 * from here means a move is one edit rather than a search.
 */

/**
 * The canonical origin, with no trailing slash.
 *
 * Deliberately a hardcoded constant rather than `VERCEL_URL`: that variable
 * holds the *deployment's* URL — `portfolio-abc123-ray.vercel.app`, a new one
 * for every push — which is right for a preview link and wrong for everything
 * here. A canonical tag pointing at a deployment hash tells Google the real
 * page lives at an address that stops existing next week, and a sitemap built
 * from it lists URLs nobody can reach. This is the address the site answers
 * on, so it is written as one.
 *
 * No trailing slash because every consumer appends its own path; `metadataBase`
 * is a `URL` and would swallow the last segment of a relative path resolved
 * against a directory-shaped base.
 */
export const SITE_URL = "https://raychu.info";

export const SITE_NAME = "Ray Chu";

/**
 * What Google prints under the link, and what iMessage and Slack put beside
 * the preview image.
 *
 * Written to be read by a person rather than stuffed for a crawler, and kept
 * near 155 characters — past roughly that, Google truncates mid-sentence and
 * the last thing a searcher sees is an ellipsis.
 */
export const SITE_DESCRIPTION =
  "Ray Chu is a Software Engineer working in New York City" +
  " who specializes in building with careful UI design.";
