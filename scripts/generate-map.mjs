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
 * client renders one DOM node instead of 1,600–3,650.
 *
 * Run with: node scripts/generate-map.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createMap } from "svg-dotted-map";

const WIDTH = 150;
const HEIGHT = 75;
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

/** One circle as a pair of arc subpath segments. */
const circlePath = (x, y, r) =>
  `M${round(x - r)} ${round(y)}` +
  `a${r} ${r} 0 1 0 ${2 * r} 0` +
  `a${r} ${r} 0 1 0 ${-2 * r} 0`;

function build(mapSamples, dotRadius) {
  const { points, addMarkers } = createMap({
    width: WIDTH,
    height: HEIGHT,
    mapSamples,
  });
  const { xStep, yToRowIndex } = staggerHelpers(points);
  const offsetFor = (y) =>
    (yToRowIndex.get(y) ?? 0) % 2 === 1 ? xStep / 2 : 0;

  const path = points
    .map((p) => circlePath(p.x + offsetFor(p.y), p.y, dotRadius))
    .join("");

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

// Sample counts / radii match the MAP_SAMPLES(_COMPACT) and
// MAP_DOT_RADIUS(_COMPACT) constants that used to live in HeroHeadshot.tsx.
// One file per density, so the client dynamic-imports only the one the
// viewport needs instead of bundling both.
const dir = join(dirname(fileURLToPath(import.meta.url)), "../src/app/_components");
for (const [name, samples, radius] of [
  ["full", 10000, 0.15],
  ["compact", 4500, 0.22],
]) {
  const data = { width: WIDTH, height: HEIGHT, ...build(samples, radius) };
  const out = join(dir, `map-data.${name}.json`);
  writeFileSync(out, JSON.stringify(data));
  console.log(`wrote ${out}: path ${data.path.length} chars`);
}
