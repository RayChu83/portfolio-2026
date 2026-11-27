import { easedWhiteGradient } from "@/lib/edge-fade";
import { cn } from "@/lib/utils";

/** Blur radii of the stacked layers, weakest (inner) to strongest (outer edge). */
const BLUR_STEPS = [0.5, 1, 2, 4];

/**
 * A white fade with a progressive blur, for the edge of something that
 * content scrolls under, so that content is softened rather than cut off.
 *
 * The blur is several backdrop-blur layers, each stronger than the last and
 * masked to a band nearer the outer edge. Their overlapping masks ramp the
 * blur up gradually; a single flat blur would switch on at a visible line.
 *
 * The caller positions and sizes it through `className` (it needs `absolute`
 * or `fixed`, an inset and a height). `visible` fades it in and out, and the
 * opacity is set on each layer rather than the wrapper: an ancestor with
 * `opacity` below 1 stops a descendant's `backdrop-filter` from seeing the
 * page behind it, so the blur would vanish mid-transition.
 */
export default function EdgeFade({
  edge,
  peak,
  visible = true,
  className,
}: {
  edge: "top" | "bottom";
  /** Opacity of the white at the very edge. */
  peak?: number;
  visible?: boolean;
  className?: string;
}) {
  // Masks run from the inner edge (0%) to the outer edge (100%); the white
  // starts at the outer edge and fades inward.
  const maskDirection = edge === "top" ? "to top" : "to bottom";
  const scrimDirection = edge === "top" ? "to bottom" : "to top";
  const layerClass = cn(
    "absolute inset-0 transition-opacity duration-300 ease-out motion-reduce:transition-none",
    visible ? "opacity-100" : "opacity-0",
  );

  return (
    <div aria-hidden className={cn("pointer-events-none", className)}>
      {BLUR_STEPS.map((blur, i) => {
        const mask = `linear-gradient(${maskDirection}, transparent ${i * 20}%, black ${i * 20 + 20}%, black ${i * 20 + 40}%, transparent ${i * 20 + 60}%)`;
        return (
          <div
            key={blur}
            className={layerClass}
            style={{
              backdropFilter: `blur(${blur}px)`,
              WebkitBackdropFilter: `blur(${blur}px)`,
              maskImage: mask,
              WebkitMaskImage: mask,
            }}
          />
        );
      })}
      <div
        className={layerClass}
        style={{ background: easedWhiteGradient(scrimDirection, peak) }}
      />
    </div>
  );
}
