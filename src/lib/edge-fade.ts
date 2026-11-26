/** An ease-in-out white falloff, from the edge (alpha 0.85) to nothing, so the tint has no visible start or end. */
const SCRIM_STOPS = [
  [0, 0.85],
  [19, 0.8],
  [34, 0.68],
  [47, 0.52],
  [56, 0.4],
  [65, 0.27],
  [73, 0.17],
  [80, 0.1],
  [86, 0.05],
  [91, 0.02],
  [100, 0],
] as const;

/**
 * A CSS `linear-gradient` that is white at the start of `direction` and fades
 * out smoothly. `peak` is the opacity at the edge (default 0.85); the whole
 * curve is scaled with it, so a bolder fade keeps the same shape.
 */
export function easedWhiteGradient(
  direction: "to top" | "to bottom",
  peak = 0.85,
): string {
  const scale = peak / SCRIM_STOPS[0][1];
  const stops = SCRIM_STOPS.map(
    ([at, alpha]) => `rgba(255,255,255,${+(alpha * scale).toFixed(3)}) ${at}%`,
  ).join(", ");
  return `linear-gradient(${direction}, ${stops})`;
}
