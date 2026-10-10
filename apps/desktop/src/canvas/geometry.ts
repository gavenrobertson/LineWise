// SPDX-License-Identifier: Apache-2.0
/** Pure geometry for nodes and links, shared by the canvas and the SVG exporter. */

export type XY = { x: number; y: number };
export type Routing = 'straight' | 'orthogonal' | 'curved';

/** Device node box: a 56 px icon with the label below. Model positions are icon centers. */
export const DEVICE_W = 96;
export const ICON = 56;
export const ICON_HALF = ICON / 2;
/** Links stop a little outside the icon. */
export const LINK_CLEARANCE = ICON_HALF + 4;
export const PARALLEL_GAP = 14;

export function nodeTopLeft(center: XY): XY {
  return { x: center.x - DEVICE_W / 2, y: center.y - ICON_HALF };
}

export function nodeCenter(topLeft: XY): XY {
  return { x: topLeft.x + DEVICE_W / 2, y: topLeft.y + ICON_HALF };
}

/** Point where the ray from `c` toward `to` leaves a square of half-size `h` around `c`. */
export function squareExit(c: XY, to: XY, h: number = LINK_CLEARANCE): XY {
  const dx = to.x - c.x;
  const dy = to.y - c.y;
  if (dx === 0 && dy === 0) return { ...c };
  const s = h / Math.max(Math.abs(dx), Math.abs(dy));
  return { x: c.x + dx * s, y: c.y + dy * s };
}

/** Polyline points for a link between two device centers. */
export function linkPoints(a: XY, b: XY, routing: Routing, offset = 0, waypoints: XY[] = []): XY[] {
  if (waypoints.length) {
    const first = waypoints[0] as XY;
    const last = waypoints.at(-1) as XY;
    return [squareExit(a, first), ...waypoints, squareExit(b, last)];
  }
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // Perpendicular unit vector for parallel-link offsets.
  const px = -dy / len;
  const py = dx / len;
  if (routing === 'orthogonal') {
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    if (horizontal) {
      const sx = a.x + Math.sign(dx || 1) * LINK_CLEARANCE;
      const tx = b.x - Math.sign(dx || 1) * LINK_CLEARANCE;
      const ay = a.y + offset;
      const by = b.y + offset;
      if (Math.abs(ay - by) < 1)
        return [
          { x: sx, y: ay },
          { x: tx, y: by },
        ];
      const mx = (sx + tx) / 2 + offset;
      return [
        { x: sx, y: ay },
        { x: mx, y: ay },
        { x: mx, y: by },
        { x: tx, y: by },
      ];
    }
    const sy = a.y + Math.sign(dy || 1) * LINK_CLEARANCE;
    const ty = b.y - Math.sign(dy || 1) * LINK_CLEARANCE;
    const ax = a.x + offset;
    const bx = b.x + offset;
    if (Math.abs(ax - bx) < 1)
      return [
        { x: ax, y: sy },
        { x: bx, y: ty },
      ];
    const my = (sy + ty) / 2 + offset;
    return [
      { x: ax, y: sy },
      { x: ax, y: my },
      { x: bx, y: my },
      { x: bx, y: ty },
    ];
  }
  const oa = { x: a.x + px * offset, y: a.y + py * offset };
  const ob = { x: b.x + px * offset, y: b.y + py * offset };
  return [squareExit(oa, ob), squareExit(ob, oa)];
}

/** SVG path data. Curved links bow by `curve` px toward the perpendicular. */
export function pathData(points: XY[], routing: Routing, curve = 0): string {
  const f = (n: number) => Math.round(n * 10) / 10;
  if (routing === 'curved' && points.length === 2) {
    const [p, q] = points as [XY, XY];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const bow = curve || len * 0.12;
    const cx = (p.x + q.x) / 2 + (-dy / len) * bow;
    const cy = (p.y + q.y) / 2 + (dx / len) * bow;
    return `M${f(p.x)} ${f(p.y)}Q${f(cx)} ${f(cy)} ${f(q.x)} ${f(q.y)}`;
  }
  return points.map((p, i) => `${i ? 'L' : 'M'}${f(p.x)} ${f(p.y)}`).join('');
}

function segLen(a: XY, b: XY): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function polylineLength(points: XY[]): number {
  let n = 0;
  for (let i = 1; i < points.length; i++) n += segLen(points[i - 1] as XY, points[i] as XY);
  return n;
}

/** Point at distance `d` along a polyline (clamped). */
export function pointAlong(points: XY[], d: number): XY {
  let rest = Math.max(0, d);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as XY;
    const b = points[i] as XY;
    const l = segLen(a, b);
    if (rest <= l || i === points.length - 1) {
      const t = l ? Math.min(1, rest / l) : 0;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    rest -= l;
  }
  return { ...(points[0] ?? { x: 0, y: 0 }) };
}

/** Label anchors: near each end and in the middle. */
export function labelAnchors(points: XY[]): { a: XY; b: XY; mid: XY } {
  const len = polylineLength(points);
  const near = Math.min(30, len * 0.25);
  return { a: pointAlong(points, near), b: pointAlong(points, len - near), mid: pointAlong(points, len / 2) };
}

/** Direction of the polyline at its midpoint (for the serial zigzag and bundle ellipse). */
export function midDirection(points: XY[]): { mid: XY; ux: number; uy: number } {
  const len = polylineLength(points);
  const mid = pointAlong(points, len / 2);
  const ahead = pointAlong(points, len / 2 + 1);
  const dx = ahead.x - mid.x;
  const dy = ahead.y - mid.y;
  const l = Math.hypot(dx, dy) || 1;
  return { mid, ux: dx / l, uy: dy / l };
}

/** Index offsets so parallel links fan out evenly: n=3 → -14, 0, 14. */
export function parallelOffset(index: number, count: number): number {
  return (index - (count - 1) / 2) * PARALLEL_GAP;
}

/** Distance from point p to segment ab (hit-testing drops onto links). */
export function distanceToSegment(p: XY, a: XY, b: XY): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function distanceToPolyline(p: XY, points: XY[]): number {
  let best = Infinity;
  for (let i = 1; i < points.length; i++)
    best = Math.min(best, distanceToSegment(p, points[i - 1] as XY, points[i] as XY));
  return best;
}
