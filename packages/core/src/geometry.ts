import type { Element } from './elements.ts';

export type Box = { x: number; y: number; width: number; height: number };
export type Point = [number, number];

/** How far a child may poke past its container's edge and still count as inside. Hand-drawn edges wobble. */
export const CONTAIN_SLACK = 4;

/** The element's unrotated bounding box. Linear elements measure their points, which can run left of or above `x, y`. */
export function boxOf(el: Element): Box {
  const pts = el.points;
  if (!pts || pts.length === 0) {
    return normalize({ x: el.x, y: el.y, width: el.width, height: el.height });
  }
  const xs = pts.map((p) => el.x + p[0]);
  const ys = pts.map((p) => el.y + p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

function normalize(b: Box): Box {
  return {
    x: b.width < 0 ? b.x + b.width : b.x,
    y: b.height < 0 ? b.y + b.height : b.y,
    width: Math.abs(b.width),
    height: Math.abs(b.height),
  };
}

export function area(b: Box): number {
  return b.width * b.height;
}

export function contains(outer: Box, inner: Box): boolean {
  return (
    inner.x >= outer.x - CONTAIN_SLACK &&
    inner.y >= outer.y - CONTAIN_SLACK &&
    inner.x + inner.width <= outer.x + outer.width + CONTAIN_SLACK &&
    inner.y + inner.height <= outer.y + outer.height + CONTAIN_SLACK
  );
}

export function containsPoint(b: Box, [px, py]: Point): boolean {
  return (
    px >= b.x - CONTAIN_SLACK &&
    py >= b.y - CONTAIN_SLACK &&
    px <= b.x + b.width + CONTAIN_SLACK &&
    py <= b.y + b.height + CONTAIN_SLACK
  );
}

/** First and last points of a linear element, in scene coordinates. */
export function endpoints(el: Element): [Point, Point] | null {
  const pts = el.points;
  if (!pts || pts.length < 2) return null;
  const first = pts[0] as Point;
  const last = pts[pts.length - 1] as Point;
  return [
    [el.x + first[0], el.y + first[1]],
    [el.x + last[0], el.y + last[1]],
  ];
}

export function center(b: Box): Point {
  return [b.x + b.width / 2, b.y + b.height / 2];
}

export function rounded(b: Box): Box {
  return {
    x: Math.round(b.x),
    y: Math.round(b.y),
    width: Math.round(b.width),
    height: Math.round(b.height),
  };
}

export type Layout = 'row' | 'column' | 'grid' | 'rows';

/**
 * Groups boxes into rows (boxes whose vertical centers fall inside the row's span) and returns the
 * rows in reading order: top to bottom, then left to right.
 */
export function readingRows<T>(items: readonly T[], box: (item: T) => Box): T[][] {
  const sorted = [...items].sort((a, b) => box(a).y - box(b).y || box(a).x - box(b).x);
  const rows: { top: number; bottom: number; items: T[] }[] = [];
  for (const item of sorted) {
    const b = box(item);
    const mid = b.y + b.height / 2;
    const row = rows.find((r) => mid >= r.top && mid <= r.bottom);
    if (row) {
      row.items.push(item);
      row.top = Math.min(row.top, b.y);
      row.bottom = Math.max(row.bottom, b.y + b.height);
    } else {
      rows.push({ top: b.y, bottom: b.y + b.height, items: [item] });
    }
  }
  return rows.map((r) => r.items.sort((a, b) => box(a).x - box(b).x));
}

/** The arrangement a set of rows suggests. Undefined for fewer than two items. */
export function layoutOf(rows: readonly (readonly unknown[])[]): Layout | undefined {
  const count = rows.reduce((n, r) => n + r.length, 0);
  if (count < 2) return undefined;
  if (rows.length === 1) return 'row';
  if (rows.every((r) => r.length === 1)) return 'column';
  const width = rows[0]?.length ?? 0;
  return rows.every((r) => r.length === width) ? 'grid' : 'rows';
}

/** Where the line from a box's center toward `toward` crosses the box's edge, pushed `gap` further out. */
function edgeToward(b: Box, toward: Point, gap: number): Point {
  const [cx, cy] = center(b);
  const dx = toward[0] - cx;
  const dy = toward[1] - cy;
  if (dx === 0 && dy === 0) return [cx, cy];
  const halfW = b.width / 2 + gap;
  const halfH = b.height / 2 + gap;
  const scale = Math.min(
    dx === 0 ? Infinity : halfW / Math.abs(dx),
    dy === 0 ? Infinity : halfH / Math.abs(dy),
  );
  return [cx + dx * scale, cy + dy * scale];
}

/**
 * A straight arrow from one box's edge to another's, as an origin and points relative to it, stopping
 * `gaps` short of each box. Boxes that overlap get an arrow between their centers.
 */
export function arrowBetween(
  from: Box,
  to: Box,
  [fromGap, toGap]: [number, number] = [0, 0],
): { x: number; y: number; points: Point[] } {
  const start = edgeToward(from, center(to), fromGap);
  const end = edgeToward(to, center(from), toGap);
  return {
    x: start[0],
    y: start[1],
    points: [
      [0, 0],
      [end[0] - start[0], end[1] - start[1]],
    ],
  };
}
