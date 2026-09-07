import {
  SITE_DESCRIPTION,
  SITE_JOB_TITLE,
  SITE_NAME,
  SITE_PROFILES,
  SITE_URL,
} from "@/lib/site";

/**
 * The machine-readable version of what the page already says in prose.
 *
 * Meta tags describe the *document*; this describes the *subject*. For a
 * personal site those are different claims, and only the second one is what a
 * search engine assembles a knowledge panel from — the name query this site
 * competes for is answered by an entity, not by a `<title>`.
 *
 * Two graph nodes rather than one, cross-referenced by `@id`:
 *
 * - `Person` is Ray. `sameAs` is the load-bearing field: it is what lets a
 *   crawler merge this page's Ray Chu with the LinkedIn and GitHub profiles
 *   of the same name into one entity rather than three coincidences.
 * - `WebSite` is the site, with its `publisher` pointing back at the Person.
 *   Without it the site name in a result is inferred from the domain and the
 *   `<title>`; with it, it is stated.
 *
 * Every URL here is absolute. Schema.org consumers do not resolve relative
 * references against `metadataBase` the way Next's own metadata does, so the
 * origin is spelled out from `SITE_URL` — the same constant the canonical
 * tag, the sitemap and `robots.txt` read, so a domain move stays one edit.
 *
 * A Server Component with no interactivity, so this ships zero JavaScript: it
 * is a `<script>` tag of static text, emitted into the server's HTML.
 * `dangerouslySetInnerHTML` is the required idiom — React escapes the `<` in
 * a text child, which would corrupt the JSON. Nothing user-supplied goes in,
 * so there is no injection surface; every value is a module constant.
 */
export default function StructuredData() {
  const personId = `${SITE_URL}/#person`;

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": personId,
        name: SITE_NAME,
        url: SITE_URL,
        jobTitle: SITE_JOB_TITLE,
        description: SITE_DESCRIPTION,
        // The Open Graph card doubles as the entity's image — one file to
        // keep current rather than two that can drift apart.
        image: `${SITE_URL}/opengraph-image.png`,
        address: {
          "@type": "PostalAddress",
          addressLocality: "New York",
          addressRegion: "NY",
          addressCountry: "US",
        },
        knowsAbout: [
          "Front-end engineering",
          "User interface design",
          "React",
          "Next.js",
          "TypeScript",
        ],
        sameAs: [...SITE_PROFILES],

        /**
         * The two internships the work section describes, stated as roles
         * with dates. `worksFor` is the current one and only the current one
         * — it is a present-tense claim, and listing a finished role there
         * would assert Ray still works at Unlevered.
         */
        worksFor: {
          "@type": "Organization",
          name: "Blitz",
          url: "https://useblitz.co",
        },
        hasOccupation: [
          {
            "@type": "Role",
            roleName: "Software Engineer Intern",
            startDate: "2026-03",
            worksFor: {
              "@type": "Organization",
              name: "Blitz",
              url: "https://useblitz.co",
            },
          },
          {
            "@type": "Role",
            roleName: "Software Engineer Intern",
            startDate: "2024-07",
            endDate: "2025-01",
            worksFor: { "@type": "Organization", name: "Unlevered" },
          },
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: `${SITE_NAME} — ${SITE_JOB_TITLE}`,
        description: SITE_DESCRIPTION,
        inLanguage: "en-US",
        publisher: { "@id": personId },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
