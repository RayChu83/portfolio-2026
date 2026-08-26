import localFont from "next/font/local";

/**
 * Only the two faces the markup actually uses. The other six weights were
 * declared, preloaded, and — via `document.fonts.ready` — even gated the old
 * page loader, without a single element ever rendering in them.
 *
 * `display: "swap"` so text paints immediately in the fallback face and swaps
 * when the webfont lands — the page is never blocked on a font.
 */
export const aeonikRegular = localFont({
  src: "./Aeonik/AeonikProTRIAL-Regular.woff2",
  variable: "--font-aeonik-regular",
  weight: "400",
  display: "swap",
});

export const aeonikMedium = localFont({
  src: "./Aeonik/AeonikProTRIAL-Medium.woff2",
  variable: "--font-aeonik-medium",
  weight: "500",
  display: "swap",
});

export const aeonikVariables = [
  aeonikRegular.variable,
  aeonikMedium.variable,
].join(" ");
