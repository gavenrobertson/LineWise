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
export function linkPoints(a: XY, b: XY, routing: Routing, offset = 0, waypoints: XY[] = [], lane = 0): XY[] {
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
      const mx = (sx + tx) / 2 + offset + lane;
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
    const my = (sy + ty) / 2 + offset + lane;
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

export const END_LABEL_DIST = 30;

/** Label anchors: near each end (at the given distances along the link) and in the middle. */
export function labelAnchors(
  points: XY[],
  distA = END_LABEL_DIST,
  distB = END_LABEL_DIST,
): { a: XY; b: XY; mid: XY } {
  const len = polylineLength(points);
  const cap = len * 0.4;
  return {
    a: pointAlong(points, Math.min(distA, cap)),
    b: pointAlong(points, len - Math.min(distB, cap)),
    mid: pointAlong(points, len / 2),
  };
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

// ---------------------------------------------------------------- obstacle-avoiding orthogonal routes

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Device icon box used as a routing obstacle (icon plus a small margin). */
export function iconRect(center: XY, margin = 6): Rect {
  const h = ICON_HALF + margin;
  return { x: center.x - h, y: center.y - h, w: 2 * h, h: 2 * h };
}

/** Uniform-grid spatial index so each link only looks at nearby obstacles. */
export class ObstacleIndex {
  private readonly cells = new Map<string, number[]>();
  constructor(
    readonly rects: Rect[],
    private readonly cell = 240,
  ) {
    rects.forEach((r, i) => {
      for (let cx = Math.floor(r.x / cell); cx <= Math.floor((r.x + r.w) / cell); cx++)
        for (let cy = Math.floor(r.y / cell); cy <= Math.floor((r.y + r.h) / cell); cy++) {
          const k = `${cx},${cy}`;
          const list = this.cells.get(k);
          if (list) list.push(i);
          else this.cells.set(k, [i]);
        }
    });
  }

  query(box: Rect): Rect[] {
    const seen = new Set<number>();
    const out: Rect[] = [];
    const c = this.cell;
    for (let cx = Math.floor(box.x / c); cx <= Math.floor((box.x + box.w) / c); cx++)
      for (let cy = Math.floor(box.y / c); cy <= Math.floor((box.y + box.h) / c); cy++)
        for (const i of this.cells.get(`${cx},${cy}`) ?? []) {
          if (seen.has(i)) continue;
          seen.add(i);
          const r = this.rects[i] as Rect;
          if (r.x < box.x + box.w && r.x + r.w > box.x && r.y < box.y + box.h && r.y + r.h > box.y)
            out.push(r);
        }
    return out;
  }
}

/** True when the axis-aligned segment p→q passes through the interior of r. */
export function segmentHitsRect(p: XY, q: XY, r: Rect): boolean {
  const x0 = Math.min(p.x, q.x);
  const x1 = Math.max(p.x, q.x);
  const y0 = Math.min(p.y, q.y);
  const y1 = Math.max(p.y, q.y);
  return x1 > r.x && x0 < r.x + r.w && y1 > r.y && y0 < r.y + r.h;
}

export function polylineHits(points: XY[], obstacles: Rect[]): number {
  let n = 0;
  for (const r of obstacles)
    for (let i = 1; i < points.length; i++)
      if (segmentHitsRect(points[i - 1] as XY, points[i] as XY, r)) {
        n++;
        break;
      }
  return n;
}

/** Drop the part of a polyline inside the square of half-size h around its first point. */
function clipStart(points: XY[], h: number): XY[] {
  const c = points[0] as XY;
  const inside = (p: XY) => Math.abs(p.x - c.x) <= h && Math.abs(p.y - c.y) <= h;
  let i = 1;
  while (i < points.length - 1 && inside(points[i] as XY)) i++;
  const a = points[i - 1] as XY;
  const b = points[i] as XY;
  // a is inside, b outside: walk from a toward b to the square's edge (axis-aligned segment).
  const exit =
    a.x === b.x
      ? { x: a.x, y: c.y + Math.sign(b.y - c.y || 1) * h }
      : { x: c.x + Math.sign(b.x - c.x || 1) * h, y: a.y };
  return [exit, ...points.slice(i)];
}

const BEND_COST = 40;

/** Minimal binary min-heap of [cost, key] pairs. */
class Heap {
  private readonly items: [number, number][] = [];
  get size(): number {
    return this.items.length;
  }
  push(item: [number, number]): void {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if ((a[p] as [number, number])[0] <= item[0]) break;
      a[i] = a[p] as [number, number];
      i = p;
    }
    a[i] = item;
  }
  pop(): [number, number] {
    const a = this.items;
    const top = a[0] as [number, number];
    const last = a.pop() as [number, number];
    if (a.length) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        const cur = (k: number) => (k === i ? last[0] : (a[k] as [number, number])[0]);
        if (l < a.length && (a[l] as [number, number])[0] < cur(m)) m = l;
        if (r < a.length && (a[r] as [number, number])[0] < cur(m)) m = r;
        if (m === i) break;
        a[i] = a[m] as [number, number];
        i = m;
      }
      a[i] = last;
    }
    return top;
  }
}

const routeCache = new Map<string, XY[] | null>();

/**
 * Right-angle route from center a to center b around obstacle boxes (FR-LNK-02). Builds a
 * sparse grid from the obstacle edges near the link and runs Dijkstra with a bend penalty.
 * Returns null when no clear route exists (callers fall back to the simple route).
 */
export function routeAround(a: XY, b: XY, obstacles: Rect[], margin = 10): XY[] | null {
  const cacheKey = `${a.x},${a.y};${b.x},${b.y};${margin};${obstacles.map((r) => `${r.x},${r.y},${r.w},${r.h}`).join(';')}`;
  const cached = routeCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const result = routeAroundUncached(a, b, obstacles, margin);
  if (routeCache.size > 4000) routeCache.clear();
  routeCache.set(cacheKey, result);
  return result;
}

function routeAroundUncached(a: XY, b: XY, obstacles: Rect[], margin: number): XY[] | null {
  const xs = new Set<number>([a.x, b.x]);
  const ys = new Set<number>([a.y, b.y]);
  for (const r of obstacles) {
    xs.add(r.x - margin);
    xs.add(r.x + r.w + margin);
    ys.add(r.y - margin);
    ys.add(r.y + r.h + margin);
  }
  const X = [...xs].sort((p, q) => p - q);
  const Y = [...ys].sort((p, q) => p - q);
  const blocked = (p: XY) =>
    obstacles.some((r) => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h);
  const ix = (x: number) => X.indexOf(x);
  const iy = (y: number) => Y.indexOf(y);
  const W = X.length;
  const H = Y.length;
  // State: node index * 4 + incoming direction (0 none/start, 1 horizontal, 2 vertical).
  const key = (i: number, j: number, d: number) => (j * W + i) * 3 + d;
  const dist = new Map<number, number>();
  const prev = new Map<number, number>();
  const start = key(ix(a.x), iy(a.y), 0);
  const goalI = ix(b.x);
  const goalJ = iy(b.y);
  dist.set(start, 0);
  const open = new Heap();
  open.push([0, start]);
  let found = -1;
  while (open.size) {
    const [cost, k] = open.pop();
    if (cost > (dist.get(k) ?? Infinity)) continue;
    const d = k % 3;
    const n = (k - d) / 3;
    const i = n % W;
    const j = (n - i) / W;
    if (i === goalI && j === goalJ) {
      found = k;
      break;
    }
    const p = { x: X[i] as number, y: Y[j] as number };
    for (const [di, dj, dir] of [
      [1, 0, 1],
      [-1, 0, 1],
      [0, 1, 2],
      [0, -1, 2],
    ] as const) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const q = { x: X[ni] as number, y: Y[nj] as number };
      const isGoal = ni === goalI && nj === goalJ;
      if (!isGoal && blocked(q)) continue;
      if (obstacles.some((r) => segmentHitsRect(p, q, r))) continue;
      const step = Math.abs(q.x - p.x) + Math.abs(q.y - p.y) + (d && d !== dir ? BEND_COST : 0);
      const nk = key(ni, nj, dir);
      const nc = cost + step;
      if (nc < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, nc);
        prev.set(nk, k);
        open.push([nc, nk]);
      }
    }
  }
  if (found < 0) return null;
  const path: XY[] = [];
  for (let k: number | undefined = found; k !== undefined; k = prev.get(k)) {
    const n = (k - (k % 3)) / 3;
    const i = n % W;
    path.unshift({ x: X[i] as number, y: Y[(n - i) / W] as number });
  }
  // Merge collinear points.
  const out: XY[] = [path[0] as XY];
  for (let i = 1; i < path.length - 1; i++) {
    const p = out.at(-1) as XY;
    const q = path[i] as XY;
    const r = path[i + 1] as XY;
    if ((p.x === q.x && q.x === r.x) || (p.y === q.y && q.y === r.y)) continue;
    out.push(q);
  }
  out.push(path.at(-1) as XY);
  return out;
}

/** Center-to-center Z route: horizontal-vertical-horizontal (or the vertical variant) via `mid`. */
function zRoute(a: XY, b: XY, horizontal: boolean, mid: number): XY[] {
  if (horizontal) return a.y === b.y ? [a, b] : [a, { x: mid, y: a.y }, { x: mid, y: b.y }, b];
  return a.x === b.x ? [a, b] : [a, { x: a.x, y: mid }, { x: b.x, y: mid }, b];
}

function clipEnds(points: XY[]): XY[] {
  return clipStart(clipStart(points, LINK_CLEARANCE).reverse(), LINK_CLEARANCE).reverse();
}

/**
 * Orthogonal link points (FR-LNK-02): the simple Z route when it is clear; otherwise the
 * clearest of a few readable alternatives (the other Z orientation, L shapes, Z routes whose
 * middle leg moves into a nearby gap); otherwise a route around the obstacles on a grid. All are
 * clipped so the line starts and ends just outside the icons.
 */
export function orthogonalPoints(a: XY, b: XY, offset: number, obstacles: Rect[], lane = 0): XY[] {
  const simple = linkPoints(a, b, 'orthogonal', offset, [], lane);
  if (!obstacles.length || polylineHits(simple, obstacles) === 0) return simple;
  const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
  const shift = (p: XY, h: boolean) => (h ? { x: p.x, y: p.y + offset } : { x: p.x + offset, y: p.y });
  const candidates: XY[][] = [];
  for (const h of [horizontal, !horizontal]) {
    const oa = shift(a, h);
    const ob = shift(b, h);
    const lo = h ? Math.min(oa.x, ob.x) : Math.min(oa.y, ob.y);
    const hi = h ? Math.max(oa.x, ob.x) : Math.max(oa.y, ob.y);
    const midpoint = (lo + hi) / 2 + offset + (h === horizontal ? lane : 0);
    // Middle-leg positions: the midpoint, then gaps beside obstacles, nearest the midpoint first.
    const mids = [midpoint];
    for (const r of obstacles) {
      const edges = h ? [r.x - 12, r.x + r.w + 12] : [r.y - 12, r.y + r.h + 12];
      for (const m of edges) if (m > lo + LINK_CLEARANCE && m < hi - LINK_CLEARANCE) mids.push(m);
    }
    mids.sort((p, q) => Math.abs(p - midpoint) - Math.abs(q - midpoint));
    for (const m of mids) candidates.push(zRoute(oa, ob, h, m));
    // L shapes turn once, at a corner.
    candidates.push(h ? [oa, { x: ob.x, y: oa.y }, ob] : [oa, { x: oa.x, y: ob.y }, ob]);
  }
  for (const c of candidates) {
    const clipped = clipEnds(c);
    if (polylineHits(clipped, obstacles) === 0) return clipped;
  }
  const routed = routeAround(shift(a, horizontal), shift(b, horizontal), obstacles);
  if (!routed || routed.length < 2) return simple;
  return clipEnds(routed);
}

/**
 * Structural equality up to `depth` levels (arrays and plain objects); anything deeper must be
 * the same object. Used to keep unchanged canvas nodes and edges as the same objects between
 * model rebuilds so React Flow and React skip them (NFR-PERF-04).
 */
export function sameShape(a: unknown, b: unknown, depth: number): boolean {
  if (a === b) return true;
  if (depth <= 0 || typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!sameShape(a[i], b[i], depth - 1)) return false;
    return true;
  }
  if (
    Array.isArray(b) ||
    Object.getPrototypeOf(a) !== Object.prototype ||
    Object.getPrototypeOf(b) !== Object.prototype
  )
    return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka)
    if (!sameShape((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], depth - 1))
      return false;
  return true;
}

/** Reuse previous items (by id) that are structurally unchanged; reuse the whole array if nothing changed. */
export function stabilize<T extends { id: string }>(prev: T[], next: T[], depth: number): T[] {
  const byId = new Map(prev.map((x) => [x.id, x]));
  let changed = prev.length !== next.length;
  const out = next.map((n, i) => {
    const p = byId.get(n.id);
    if (p && sameShape(p, n, depth)) {
      if (prev[i] !== p) changed = true;
      return p;
    }
    changed = true;
    return n;
  });
  return changed ? out : prev;
}
