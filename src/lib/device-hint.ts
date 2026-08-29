/**
 * The header the hint travels in — a request header rather than a query
 * parameter so it stays out of access logs, referrers and the browser's own
 * history, none of which have any business holding a description of someone's
 * hardware. Same-origin, so no CORS preflight is involved.
 */
export const DEVICE_HINT_HEADER = "x-device-hint";

/**
 * A short description of the *machine* this browser is running on, for the
 * visitor counter to tell two devices on one network apart.
 *
 * Everything in here is chosen for one property: it must be identical in
 * every browser on a given device, and differ between devices. That rules
 * both directions of the obvious material out —
 *
 * - Anything describing the *browser* (user agent, language, plugin list, a
 *   canvas or WebGL render) differs between Chrome and Safari on one machine,
 *   which is precisely the case this whole mechanism exists to catch.
 * - Anything describing the *window* (`innerWidth`, `outerHeight`,
 *   `devicePixelRatio`) changes with how the visitor happens to have sized or
 *   zoomed that particular browser, so it is unstable even within one browser.
 *
 * What is left is the display, the CPU, the input hardware and the clock — all
 * read from the operating system, so every browser on the device reports the
 * same thing.
 *
 * This is a fingerprint, and worth being clear-eyed about: it is low entropy
 * by design (roughly "what kind of computer is this"), it is never stored in
 * raw form — the server salts and hashes it — and the row it lands in expires
 * within the day. It is not enough to recognise a visitor across networks or
 * across days, which is the line between this and tracking.
 *
 * Returns `""` where there is nothing to measure (during SSR) or where a
 * hardened browser refuses one of these reads. An empty hint is a valid
 * answer, not an error: the server still has the IP and the platform family
 * to work with, and simply falls back to the coarser identity it had before
 * this existed.
 */
export function deviceHint() {
  if (typeof window === "undefined") return "";

  try {
    const { width, height, colorDepth } = window.screen;
    // The OS timezone, not an offset — `America/New_York` rather than `-05:00`
    // — so the hint does not silently change at every daylight-saving
    // transition and split one device into two.
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";

    return [
      `${width}x${height}x${colorDepth}`,
      // Logical cores, reported by every current engine. `deviceMemory` would
      // be the natural companion and is deliberately left out: only Chromium
      // implements it, so it would read as a different machine depending on
      // which browser asked.
      navigator.hardwareConcurrency ?? 0,
      // 0 on a desktop, 5 on a phone or a touch laptop — the cheapest signal
      // that separates two devices sharing a screen size.
      navigator.maxTouchPoints ?? 0,
      timeZone,
    ].join("|");
  } catch {
    return "";
  }
}
