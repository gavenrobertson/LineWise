// SPDX-License-Identifier: Apache-2.0
/** Link drawing rules from the page model: media styles, trunk cue, mid labels, parallel links, bundles. */
import {
  addDevice,
  connect,
  createDocument,
  createPortChannel,
  Editor,
  updateInterface,
  updateLinks,
  type LinkMedium,
} from '@linewise/core';
import { getTemplate } from '@linewise/device-library';
import { describe, expect, it } from 'vitest';
import { buildPageModel } from '../src/canvas/model.ts';

function pair() {
  const ed = new Editor(createDocument('t'));
  const pageId = ed.doc.pages[0]!.id;
  const tpl = getTemplate('generic/access-switch-24ge-4sfp');
  const a = addDevice({ role: 'l2-switch', pageId, position: { x: 0, y: 0 }, template: tpl, hostname: 'A' });
  const b = addDevice({
    role: 'l2-switch',
    pageId,
    position: { x: 400, y: 0 },
    template: tpl,
    hostname: 'B',
  });
  ed.execute(a);
  ed.execute(b);
  return { ed, a: a.deviceId, b: b.deviceId };
}

const model = (ed: Editor, layer: 'l1' | 'l2' | 'l3' = 'l1') =>
  buildPageModel(ed.doc, ed.doc.pages[0]!, { layer, highlight: null, issues: [] });

describe('FR-LNK-04 link styling by medium and role', () => {
  it('gives each medium its own look', () => {
    const { ed, a, b } = pair();
    const media: LinkMedium[] = ['copper', 'fiber-sm', 'serial', 'wireless', 'virtual', 'console'];
    for (const m of media) ed.execute(connect({ deviceId: a }, { deviceId: b }, m));
    const views = new Map(model(ed).links.map((l) => [l.link.medium, l]));
    expect(views.get('copper')!.dash).toBeNull();
    expect(views.get('fiber-sm')!.color).not.toBe(views.get('copper')!.color);
    expect(views.get('serial')!.serial).toBe(true);
    expect(views.get('wireless')!.dash).toBeTruthy();
    expect(views.get('virtual')!.dash).toBeTruthy();
    expect(views.get('console')!.width).toBeLessThan(views.get('copper')!.width);
    expect(new Set(media.map((m) => views.get(m)!.dash)).size).toBeGreaterThanOrEqual(3);
    // Spec styles: wireless dashed, VPN/tunnel dotted, console thin dashed.
    const seg = (m: LinkMedium) => Number(views.get(m)!.dash!.split(' ')[0]);
    expect(seg('virtual')).toBeLessThanOrEqual(2);
    expect(seg('wireless')).toBeGreaterThan(seg('virtual'));
    expect(seg('console')).toBeGreaterThan(seg('virtual'));
  });

  it('draws trunks heavier than access links in L1 and L2', () => {
    const { ed, a, b } = pair();
    const access = connect({ deviceId: a }, { deviceId: b });
    const trunk = connect({ deviceId: a }, { deviceId: b });
    ed.execute(access);
    ed.execute(trunk);
    const t = ed.doc.links.find((l) => l.id === trunk.linkId)!;
    for (const e of [t.endpointA, t.endpointB])
      ed.execute(updateInterface(e.deviceId, e.interfaceId, { mode: 'trunk' }));
    const views = new Map(model(ed, 'l2').links.map((l) => [l.link.id, l]));
    expect(views.get(trunk.linkId)!.width).toBeGreaterThan(views.get(access.linkId)!.width);
  });
});

describe('FR-LNK-05 middle label', () => {
  it('shows the link label and bandwidth in the middle', () => {
    const { ed, a, b } = pair();
    const c = connect({ deviceId: a }, { deviceId: b });
    ed.execute(c);
    ed.execute(updateLinks([c.linkId], { label: 'MPLS – AT&T', bandwidthMbps: 10000 }));
    expect(model(ed).links[0]!.labelMid).toBe('MPLS – AT&T · 10G');
  });
});

describe('FR-LNK-06 parallel links and bundles', () => {
  it('fans parallel links out evenly and marks port-channel members as one bundle', () => {
    const { ed, a, b } = pair();
    const links = [0, 1, 2].map(() => {
      const c = connect({ deviceId: a }, { deviceId: b });
      ed.execute(c);
      return c.linkId;
    });
    const offsets = model(ed)
      .links.map((l) => l.offset + 0)
      .sort((x, y) => x - y);
    expect(offsets).toEqual([-14, 0, 14]);
    const members = links.slice(0, 2).map((id) => ed.doc.links.find((l) => l.id === id)!);
    ed.execute(
      createPortChannel(
        a,
        1,
        members.map((l) => l.endpointA.interfaceId),
      ),
    );
    ed.execute(
      createPortChannel(
        b,
        1,
        members.map((l) => l.endpointB.interfaceId),
      ),
    );
    const bundles = model(ed).links.filter((l) => l.bundle);
    expect(bundles).toHaveLength(2);
    expect(bundles.filter((l) => l.bundle!.lead)).toHaveLength(1);
    expect(bundles[0]!.bundle!.size).toBe(2);
  });
});
