import * as React from "react";
import { createMap } from "svg-dotted-map";

import { cn } from "@/lib/utils";

export interface Marker {
  lat: number;
  lng: number;
  size?: number;
  pulse?: boolean;
}

/** addMarkers returns markers with lat/lng removed; only x, y and other props (e.g. size) remain */
type MapMarker<M extends Marker> = Omit<M, "lat" | "lng"> & {
  x: number;
  y: number;
};

export interface DottedMapProps<
  M extends Marker = Marker,
> extends React.SVGProps<SVGSVGElement> {
  width?: number;
  height?: number;
  mapSamples?: number;
  markers?: M[];
  dotColor?: string;
  markerColor?: string;
  dotRadius?: number;
  stagger?: boolean;
  pulse?: boolean;
  /** Fade the dots out towards the edges so the map has no rectangular border */
  fade?: boolean;
  /** Where the fade begins, 0 (at the centre) to 1 (at the edge) */
  fadeStart?: number;

  renderMarkerOverlay?: (args: {
    marker: MapMarker<M>;
    index: number;
    x: number;
    y: number;
    r: number;
  }) => React.ReactNode;
}

/**
 * The default for `markers`, hoisted out of the signature.
 *
 * A `= []` default builds a fresh array on every render, and an array that is
 * never twice the same value is one the memo below can never hit — so the
 * marker projection would rerun each time for callers that pass no markers at
 * all. One frozen empty array is the same value forever.
 */
const NO_MARKERS: never[] = [];

export function DottedMap<M extends Marker = Marker>({
  width = 150,
  height = 75,
  mapSamples = 5000,
  markers = NO_MARKERS,
  dotColor = "currentColor",
  markerColor = "#FF6900",
  dotRadius = 0.2,
  stagger = true,
  pulse = false,
  fade = false,
  fadeStart = 0.5,
  renderMarkerOverlay,
  className,
  style,
  ...svgProps
}: DottedMapProps<M>) {
  // Sampling the world at `mapSamples` points is far and away the most
  // expensive thing this component does, and none of it depends on anything but
  // the three numbers below — so left in the render body it was being redone in
  // full every time a parent re-rendered, for a result identical to the one
  // just thrown away. On the hero that render sits inside the pinned section,
  // where the main thread has the least to spare.
  const { points, addMarkers } = React.useMemo(
    () => createMap({ width, height, mapSamples }),
    [width, height, mapSamples],
  );

  // Projecting the markers is cheap by comparison, but it depends on
  // `addMarkers` — which is only stable because of the memo above — so it is
  // memoized alongside it rather than left to run against a fresh closure.
  const processedMarkers = React.useMemo(
    () => addMarkers(markers),
    [addMarkers, markers],
  );

  // Ids have to be unique per instance, and `useId` produces colons that are
  // awkward inside url() references
  const uid = React.useId().replace(/:/g, "-");
  const fadeId = `dotted-map-fade-${uid}`;
  const maskId = `dotted-map-mask-${uid}`;

  // Compute stagger helpers in a single, simple pass
  const { xStep, yToRowIndex } = React.useMemo(() => {
    const sorted = [...points].sort((a, b) => a.y - b.y || a.x - b.x);
    const rowMap = new Map<number, number>();
    let step = 0;
    let prevY = Number.NaN;
    let prevXInRow = Number.NaN;

    for (const p of sorted) {
      if (p.y !== prevY) {
        // new row
        prevY = p.y;
        prevXInRow = Number.NaN;
        if (!rowMap.has(p.y)) rowMap.set(p.y, rowMap.size);
      }
      if (!Number.isNaN(prevXInRow)) {
        const delta = p.x - prevXInRow;
        if (delta > 0) step = step === 0 ? delta : Math.min(step, delta);
      }
      prevXInRow = p.x;
    }

    return { xStep: step || 1, yToRowIndex: rowMap };
  }, [points]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("text-gray-500 dark:text-gray-500", className)}
      style={{ width: "100%", height: "100%", ...style }}
      {...svgProps}
    >
      {fade ? (
        <defs>
          {/* Default cx/cy/r in objectBoundingBox units, so the falloff is an
              ellipse fitted to the map's own box rather than a circle */}
          <radialGradient id={fadeId}>
            <stop offset={fadeStart} stopColor="#fff" stopOpacity={1} />
            <stop offset={1} stopColor="#fff" stopOpacity={0} />
          </radialGradient>
          {/* userSpaceOnUse so the mask covers the whole viewBox; left to
              default it would be sized off the dots' own bounding box */}
          <mask
            id={maskId}
            maskUnits="userSpaceOnUse"
            x={0}
            y={0}
            width={width}
            height={height}
          >
            <rect
              x={0}
              y={0}
              width={width}
              height={height}
              fill={`url(#${fadeId})`}
            />
          </mask>
        </defs>
      ) : null}

      {/* Only the dots are faded. Markers are the point of the map, so they
          keep their opacity wherever they fall */}
      <g mask={fade ? `url(#${maskId})` : undefined}>
        {points.map((point, index) => {
          const rowIndex = yToRowIndex.get(point.y) ?? 0;
          const offsetX = stagger && rowIndex % 2 === 1 ? xStep / 2 : 0;
          return (
            <circle
              cx={point.x + offsetX}
              cy={point.y}
              r={dotRadius}
              fill={dotColor}
              key={`${point.x}-${point.y}-${index}`}
            />
          );
        })}
      </g>

      {processedMarkers.map((marker, index) => {
        const rowIndex = yToRowIndex.get(marker.y) ?? 0;
        const offsetX = stagger && rowIndex % 2 === 1 ? xStep / 2 : 0;

        const x = marker.x + offsetX;
        const y = marker.y;
        const r = marker.size ?? dotRadius;
        const shouldPulse = pulse
          ? marker.pulse !== false
          : marker.pulse === true;
        const pulseTo = r * 2.8;

        return (
          <g key={`${marker.x}-${marker.y}-${index}`}>
            <circle cx={x} cy={y} r={r} fill={markerColor} />

            {shouldPulse ? (
              <g pointerEvents="none">
                <circle
                  cx={x}
                  cy={y}
                  r={r}
                  fill="none"
                  stroke={markerColor}
                  strokeOpacity={1}
                  strokeWidth={0.35}
                >
                  <animate
                    attributeName="r"
                    values={`${r};${pulseTo}`}
                    dur="1.4s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="1;0"
                    dur="1.4s"
                    repeatCount="indefinite"
                  />
                </circle>
                <circle
                  cx={x}
                  cy={y}
                  r={r}
                  fill="none"
                  stroke={markerColor}
                  strokeOpacity={0.9}
                  strokeWidth={0.3}
                >
                  <animate
                    attributeName="r"
                    values={`${r};${pulseTo}`}
                    dur="1.4s"
                    begin="0.7s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.9;0"
                    dur="1.4s"
                    begin="0.7s"
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
            ) : null}

            {renderMarkerOverlay?.({
              marker: { ...marker, x, y },
              index,
              x,
              y,
              r,
            })}
          </g>
        );
      })}
    </svg>
  );
}
