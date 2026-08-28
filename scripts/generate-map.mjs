/**
 * Build-time generation of the hero's dotted world map.
 *
 * `createMap` samples the world raster and takes the better part of a second
 * on a fast desktop — far too much to run on a visitor's phone (see
 * PERFORMANCE-AUDIT.md, P0-1). Nothing about its output depends on runtime
 * state, so it is run here, once, and the result is committed as JSON.
 *
 * Each density is serialised as a single SVG path (one circle subpath per
 * dot, radius baked in) rather than thousands of <circle> elements, so the
 * client renders one DOM node instead of 3,200–8,600.
 *
 * Run with: node scripts/generate-map.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createMap } from "svg-dotted-map";

/**
 * The coordinate space the map is drawn in. Nothing on screen is measured in
 * these units — the SVG's viewBox is taken from them and the frame is held to
 * 2:1 — but they cap how many dots there can be: `svg-dotted-map` dedupes its
 * samples on `Math.round`ed coordinates, so a 150x75 space plateaus at ~4,300
 * land dots no matter how high `mapSamples` goes. Raising the space is what
 * lets the grid get finer; `mapSamples` alone cannot.
 */
const WIDTH = 240;
const HEIGHT = 120;
const NEW_YORK = { lat: 40.7128, lng: -74.006 };

/** Mirrors the stagger pass the old runtime component performed. */
function staggerHelpers(points) {
  const sorted = [...points].sort((a, b) => a.y - b.y || a.x - b.x);
  const rowMap = new Map();
  let step = 0;
  let prevY = Number.NaN;
  let prevXInRow = Number.NaN;

  for (const p of sorted) {
    if (p.y !== prevY) {
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
}

const round = (n) => Math.round(n * 100) / 100;

/**
 * One circle as a pair of arc subpath segments, minus every character SVG's
 * path grammar lets us drop: `.2` for `0.2`, no separator between a number and
 * a following `.` or `-`. At ~8,600 dots the difference is tens of kilobytes.
 */
const trim = (n) => String(round(n)).replace(/^(-?)0\./, "$1.");

/** Two numbers, with a separator only where one would otherwise run into the next. */
const pair = (a, b) => `${a}${b.startsWith(".") || b.startsWith("-") ? "" : " "}${b}`;

const arcs = (r) => {
  const rr = pair(trim(r), trim(r));
  return `a${rr} 0 1 0 ${trim(2 * r)} 0a${rr} 0 1 0${trim(-2 * r)} 0`;
};

/**
 * The dots, chained into one path. Each arc pair closes back on the point it
 * started from, so every dot after the first is reached by a relative `m` from
 * the previous one rather than an absolute `M` — shorter, and the deltas are
 * lattice steps that repeat, which is what gzip wants to see.
 */
function dotsPath(points, r) {
  const a = arcs(r);
  let out = "";
  let px = 0;
  let py = 0;
  points.forEach(({ x, y }, i) => {
    const cx = x - r;
    if (i === 0) out += `M${trim(cx)} ${trim(y)}`;
    else out += `m${trim(cx - px)} ${trim(y - py)}`;
    out += a;
    px = cx;
    py = y;
  });
  return out;
}

function build(mapSamples, dotRadius) {
  const { points, addMarkers } = createMap({
    width: WIDTH,
    height: HEIGHT,
    mapSamples,
  });
  const { xStep, yToRowIndex } = staggerHelpers(points);
  const offsetFor = (y) =>
    (yToRowIndex.get(y) ?? 0) % 2 === 1 ? xStep / 2 : 0;

  const path = dotsPath(
    points.map((p) => ({ x: p.x + offsetFor(p.y), y: p.y })),
    dotRadius,
  );

  const [marker] = addMarkers([NEW_YORK]);
  const markerX = marker.x + offsetFor(marker.y);

  return {
    path,
    // New York's position as a fraction of the 2:1 frame — what the hero's
    // flight path and transform origin need. Computed here so the client
    // never has to measure the SVG.
    marker: { x: markerX / WIDTH, y: marker.y / HEIGHT },
  };
}

// One file per density, so the client dynamic-imports only the one the
// viewport needs instead of bundling both. The radii are a little under half
// the grid step: at the size the map is actually drawn that is a dot of about
// the same couple of pixels it has always been, on a grid twice as fine, which
// is what makes coastlines legible as coastlines rather than as a scatter.
const dir = join(dirname(fileURLToPath(import.meta.url)), "../src/app/_components");
for (const [name, samples, radius] of [
  ["full", 24000, 0.2],
  ["compact", 9000, 0.34],
]) {
  const data = { width: WIDTH, height: HEIGHT, ...build(samples, radius) };
  const out = join(dir, `map-data.${name}.json`);
  writeFileSync(out, JSON.stringify(data));
  console.log(`wrote ${out}: path ${data.path.length} chars`);
}
