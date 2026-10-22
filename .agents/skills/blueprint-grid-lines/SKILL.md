---
name: blueprint-grid-lines
description: The graph-paper / blueprint look used by the Experience section (src/app/_components/Work.tsx) - thin hairline borders that divide a section into a visible grid of cells, with crosshair tick marks on the corners of the media frame. Use when building or restyling a section so it matches that look.
---

# Blueprint Grid Lines

The Experience section (`src/app/_components/Work.tsx`) looks like graph paper or an architect's drawing. Nothing is a card. The layout is a few big cells separated by thin gray lines, and a screenshot frame is pinned to the page with small `+` marks on its corners.

The effect has four parts. Use all four, or the look falls apart.

## 1. Hairline dividers, not boxes

Cells are split by 1px borders in one color: `border-neutral-200`. No shadows, no rounded corners, no filled card backgrounds.

- Section edges: `border-y border-neutral-200`.
- Stacked rows: `border-b border-neutral-200 last:border-b-0` (drop the last line so it doesn't double up with the section edge).
- Side-by-side columns: `lg:border-r lg:border-neutral-200` on the left column only.
- Footer strip under a cell: `border-t border-neutral-200`.
- When columns stack on mobile, swap the vertical line for a horizontal one: `border-b ... lg:border-b-0`.

Always use the same color for every divider so the lines read as one sheet of paper.

## 2. A grid with uneven columns

```tsx
<section className="relative flex h-full flex-col border-y border-neutral-200">
  <div className="grid flex-1 grid-cols-1 lg:grid-cols-[7fr_5fr]">
    <ol className="lg:border-r lg:border-neutral-200">{/* rows */}</ol>
    <div>{/* stage */}</div>
  </div>
</section>
```

- `flex-1` / `h-full` so the cells fill the screen and the lines run edge to edge.
- Rows share height with `flex-1` so the dividers sit evenly.
- Padding lives inside cells (`px-4 sm:px-8 lg:px-10`), never on the lines.

## 3. Crosshair corner ticks

A `+` sits just outside each corner of the media frame, like registration marks on a print.

```tsx
function Tick({ className }: { className: string }) {
  return (
    <span aria-hidden className={`pointer-events-none absolute size-4 ${className}`}>
      <span className="absolute left-1/2 top-0 h-full w-px bg-neutral-900" />
      <span className="absolute left-0 top-1/2 h-px w-full bg-neutral-900" />
    </span>
  );
}

<div className="relative aspect-video w-full bg-neutral-100 outline outline-1 outline-neutral-300">
  <Tick className="-left-2 -top-2" />
  <Tick className="-right-2 -top-2" />
  <Tick className="-bottom-2 -left-2" />
  <Tick className="-bottom-2 -right-2" />
  {/* media */}
</div>
```

- The frame has a 1px `outline` (not `border`, so it adds no layout size) in `neutral-300`, a touch darker than the dividers.
- Each tick is 16px (`size-4`), made of a 1px vertical and a 1px horizontal line in `bg-neutral-900`, centered on the corner by offsetting `-2` (half the tick).
- Ticks are decoration only: `aria-hidden` and `pointer-events-none`.
- The frame parent must be `relative`.

## 4. Quiet type inside the cells

The lines carry the structure, so the text stays plain:

- Neutral palette only: `neutral-900` (active), `neutral-500` (body), `neutral-400`/`300` (inactive).
- Small tabular index numbers (`01`, `02`) beside big display titles.
- Inactive items fade to `neutral-300`; the active one goes `neutral-900`.
- No accent colors, gradients, or shadows.

## Rules

- One divider color (`neutral-200`), one frame outline (`neutral-300`), one tick color (`neutral-900`). Don't mix.
- Lines are 1px. Never `border-2`.
- Don't round corners on cells or the media frame.
- Don't add `shadow-*` or card backgrounds to cells.
- Respect `motion-reduce:` for any transitions you add inside the cells.
- Check that lines meet cleanly at junctions and that no cell shows a doubled border.

## Checklist

- [ ] Every divider is a 1px `neutral-200` border
- [ ] No doubled lines at edges (`last:border-b-0`, one-sided `border-r`)
- [ ] Mobile swaps vertical dividers for horizontal ones
- [ ] Media frame has a `neutral-300` outline plus four corner ticks
- [ ] Ticks are `aria-hidden`, `pointer-events-none`
- [ ] No shadows, rounded corners, or accent colors
