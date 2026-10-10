// SPDX-License-Identifier: Apache-2.0
/** Link path geometry, shared by the canvas edge and the SVG exporter (no React). */
import { labelAnchors, linkPoints, orthogonalPoints, pathData, type XY } from './geometry.ts';
import type { LinkView } from './model.ts';

type GeometryView = Pick<LinkView, 'routing' | 'offset' | 'waypoints'> &
  Partial<Pick<LinkView, 'obstacles' | 'labelDist' | 'lane'>>;

export function edgeGeometryPure(a: XY, b: XY, view: GeometryView) {
  // Orthogonal links route around other devices (FR-LNK-02).
  const points =
    view.routing === 'orthogonal' && !view.waypoints.length
      ? orthogonalPoints(a, b, view.offset, view.obstacles ?? [], view.lane ?? 0)
      : linkPoints(a, b, view.routing, view.offset, view.waypoints);
  const d = pathData(
    points,
    view.waypoints.length ? 'straight' : view.routing,
    view.routing === 'curved' ? view.offset * 2 : 0,
  );
  return { points, d, anchors: labelAnchors(points, view.labelDist?.a, view.labelDist?.b) };
}
