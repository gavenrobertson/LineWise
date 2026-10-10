// SPDX-License-Identifier: Apache-2.0
/** Link path geometry, shared by the canvas edge and the SVG exporter (no React). */
import { labelAnchors, linkPoints, pathData, type XY } from './geometry.ts';
import type { LinkView } from './model.ts';

export function edgeGeometryPure(a: XY, b: XY, view: Pick<LinkView, 'routing' | 'offset' | 'waypoints'>) {
  const points = linkPoints(a, b, view.routing, view.offset, view.waypoints);
  const d = pathData(
    points,
    view.waypoints.length ? 'straight' : view.routing,
    view.routing === 'curved' ? view.offset * 2 : 0,
  );
  return { points, d, anchors: labelAnchors(points) };
}
