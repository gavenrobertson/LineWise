// SPDX-License-Identifier: Apache-2.0
/** Link routing around devices (FR-LNK-02) and end-label spreading (FR-LNK-03). */
import { addDevice, connect, createDocument, Editor, updateSettings } from '@linewise/core';
import { getTemplate } from '@linewise/device-library';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { edgeGeometryPure } from '../src/canvas/edgeGeometry.ts';
import {
  iconRect,
  LINK_CLEARANCE,
  linkPoints,
  orthogonalPoints,
  polylineHits,
  routeAround,
  type Rect,
  type XY,
} from '../src/canvas/geometry.ts';
import { buildPageModel } from '../src/canvas/model.ts';

const axisAligned = (pts: XY[]) =>
  pts.every((p, i) => i === 0 || p.x === (pts[i - 1] as XY).x || p.y === (pts[i - 1] as XY).y);

describe('FR-LNK-02 orthogonal routes avoid other devices', () => {
  it('keeps the simple route when nothing is in the way', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 300, y: 120 };
    expect(orthogonalPoints(a, b, 0, [])).toEqual(linkPoints(a, b, 'orthogonal', 0));
    expect(orthogonalPoints(a, b, 0, [iconRect({ x: 150, y: 400 })])).toEqual(
      linkPoints(a, b, 'orthogonal', 0),
    );
  });

  it('goes around a device sitting on the straight route', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 400, y: 0 };
    const block = iconRect({ x: 200, y: 0 });
    expect(polylineHits(linkPoints(a, b, 'orthogonal', 0), [block])).toBe(1);
    const pts = orthogonalPoints(a, b, 0, [block]);
    expect(polylineHits(pts, [block])).toBe(0);
    expect(axisAligned(pts)).toBe(true);
    expect(pts.length).toBeGreaterThan(2);
    // Ends sit just outside the two icons.
    const first = pts[0] as XY;
    const last = pts.at(-1) as XY;
    expect(Math.max(Math.abs(first.x - a.x), Math.abs(first.y - a.y))).toBeCloseTo(LINK_CLEARANCE, 5);
    expect(Math.max(Math.abs(last.x - b.x), Math.abs(last.y - b.y))).toBeCloseTo(LINK_CLEARANCE, 5);
  });

  it('property: any route it finds is right-angled and clear of every obstacle', () => {
    const point = fc.record({
      x: fc.integer({ min: -600, max: 600 }),
      y: fc.integer({ min: -600, max: 600 }),
    });
    fc.assert(
      fc.property(point, point, fc.array(point, { maxLength: 12 }), (a, b, centers) => {
        const far = (c: XY, p: XY) => Math.max(Math.abs(c.x - p.x), Math.abs(c.y - p.y)) > 80;
        const obstacles: Rect[] = centers.filter((c) => far(c, a) && far(c, b)).map((c) => iconRect(c));
        const route = routeAround(a, b, obstacles);
        if (!route) return;
        expect(axisAligned(route)).toBe(true);
        expect(polylineHits(route, obstacles)).toBe(0);
        expect(route[0]).toEqual(a);
        expect(route.at(-1)).toEqual(b);
      }),
      { numRuns: 300 },
    );
  });

  it('the page model gives orthogonal links their nearby obstacles', () => {
    const ed = new Editor(createDocument('t'));
    const pageId = ed.doc.pages[0]!.id;
    const tpl = getTemplate('generic/router-4ge');
    const add = (h: string, x: number) => {
      const c = addDevice({ role: 'router', pageId, position: { x, y: 0 }, template: tpl, hostname: h });
      ed.execute(c);
      return c.deviceId;
    };
    const r1 = add('R1', 0);
    add('R2', 200);
    const r3 = add('R3', 400);
    ed.execute(connect({ deviceId: r1 }, { deviceId: r3 }));
    ed.execute(updateSettings({ defaultLinkRouting: 'orthogonal' }));
    const page = ed.doc.pages[0]!;
    const m = buildPageModel(ed.doc, page, { layer: 'l1', highlight: null, issues: [] });
    const link = m.links[0]!;
    expect(link.obstacles).toHaveLength(1);
    const { points } = edgeGeometryPure(page.nodePositions[r1]!, page.nodePositions[r3]!, link);
    expect(polylineHits(points, link.obstacles)).toBe(0);
  });
});

describe('FR-LNK-02 lanes', () => {
  it('links whose middle legs share a channel get separate lanes', () => {
    const ed = new Editor(createDocument('t'));
    const pageId = ed.doc.pages[0]!.id;
    const top = addDevice({ role: 'l3-switch', pageId, position: { x: 0, y: 0 }, hostname: 'TOP' });
    ed.execute(top);
    for (const [i, x] of [-60, 60].entries()) {
      const r = addDevice({ role: 'l2-switch', pageId, position: { x, y: 300 }, hostname: `A${i}` });
      ed.execute(r);
      ed.execute(connect({ deviceId: top.deviceId }, { deviceId: r.deviceId }));
    }
    ed.execute(updateSettings({ defaultLinkRouting: 'orthogonal' }));
    const page = ed.doc.pages[0]!;
    const m = buildPageModel(ed.doc, page, { layer: 'l1', highlight: null, issues: [] });
    const lanes = m.links.map((l) => l.lane);
    expect(lanes[0]).not.toBe(lanes[1]);
    const legs = m.links.map((l) => {
      const { points } = edgeGeometryPure(
        page.nodePositions[l.sourceId]!,
        page.nodePositions[l.targetId]!,
        l,
      );
      return points[1]!.y;
    });
    expect(legs[0]).not.toBe(legs[1]);
  });
});

describe('FR-LNK-03 end labels spread apart instead of overlapping', () => {
  it('pushes labels of links that leave a device side by side further along their links', () => {
    const ed = new Editor(createDocument('t'));
    const pageId = ed.doc.pages[0]!.id;
    const sw = addDevice({
      role: 'l2-switch',
      pageId,
      position: { x: 0, y: 0 },
      template: getTemplate('generic/access-switch-24ge-4sfp'),
      hostname: 'SW',
    });
    ed.execute(sw);
    // Three routers almost in the same direction: their link ends leave SW a few degrees apart.
    for (const [i, y] of [-12, 0, 12].entries()) {
      const r = addDevice({ role: 'router', pageId, position: { x: 400, y }, hostname: `R${i}` });
      ed.execute(r);
      ed.execute(connect({ deviceId: sw.deviceId }, { deviceId: r.deviceId }));
    }
    const m = buildPageModel(ed.doc, ed.doc.pages[0]!, { layer: 'l1', highlight: null, issues: [] });
    // Each label gets its own slot: further along its link, or beside it (FR-UX-05).
    const atSwitch = m.links.map((l) =>
      l.sourceId === sw.deviceId
        ? `${l.labelDist.a}/${l.labelDist.side?.a ?? 0}`
        : `${l.labelDist.b}/${l.labelDist.side?.b ?? 0}`,
    );
    expect(new Set(atSwitch).size).toBe(3);
  });
});

describe('FR-LNK-01 dropping a link on a device body', () => {
  it('finds the device under the drop point and ignores the source', async () => {
    const { deviceAt } = await import('../src/canvas/geometry.ts');
    const pos = { a: { x: 0, y: 0 }, b: { x: 200, y: 0 } };
    expect(deviceAt(pos, { x: 210, y: 30 })).toBe('b');
    expect(deviceAt(pos, { x: 5, y: 5 }, 'a')).toBeNull();
    expect(deviceAt(pos, { x: 100, y: 0 })).toBeNull();
    expect(deviceAt(pos, { x: 200, y: -40 })).toBeNull();
  });
});
