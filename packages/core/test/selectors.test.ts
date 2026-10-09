// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  addDevice,
  connect,
  deviceSummary,
  endLabel,
  interfaceVlans,
  isVisibleInLayer,
  resolveLinks,
  shortestPath,
  updateInterface,
  vlanDomain,
} from '../src/index.ts';
import { newEditor, routerTemplate, switchTemplate, useDeterminism } from './helpers.ts';

useDeterminism();

function campus() {
  const { ed, pageId } = newEditor();
  const add = (role: 'router' | 'l2-switch', tpl = role === 'router' ? routerTemplate : switchTemplate) => {
    const c = addDevice({ role, pageId, position: { x: 0, y: 0 }, template: tpl });
    ed.execute(c);
    return c.deviceId;
  };
  const r1 = add('router');
  const sw1 = add('l2-switch');
  const sw2 = add('l2-switch');
  const sw3 = add('l2-switch');
  const l1 = connect({ deviceId: r1 }, { deviceId: sw1 });
  const l2 = connect({ deviceId: sw1 }, { deviceId: sw2 });
  const l3 = connect({ deviceId: sw2 }, { deviceId: sw3 });
  [l1, l2, l3].forEach((c) => ed.execute(c));
  return { ed, r1, sw1, sw2, sw3, links: [l1.linkId, l2.linkId, l3.linkId] };
}

describe('shortest path [FR-NET-33]', () => {
  it('finds the hop-count shortest path', () => {
    const { ed, r1, sw1, sw2, sw3, links } = campus();
    expect(shortestPath(ed.doc, r1, sw3)).toEqual({ deviceIds: [r1, sw1, sw2, sw3], linkIds: links });
    expect(shortestPath(ed.doc, r1, r1)).toEqual({ deviceIds: [r1], linkIds: [] });
  });

  it('returns null when unreachable', () => {
    const { ed, r1 } = campus();
    const c = addDevice({ role: 'server', pageId: ed.doc.pages[0]?.id as string, position: { x: 0, y: 0 } });
    ed.execute(c);
    expect(shortestPath(ed.doc, r1, c.deviceId)).toBeNull();
  });
});

describe('VLAN domain [FR-NET-32]', () => {
  it('collects interfaces and links that carry a VLAN', () => {
    const { ed, sw1, sw2, sw3 } = campus();
    const ends = resolveLinks(ed.doc);
    const trunk12 = ends[1];
    const link23 = ends[2];
    if (!trunk12 || !link23) throw new Error('missing');
    ed.execute(updateInterface(sw1, trunk12.a.iface.id, { mode: 'trunk', allowedVlans: '10,20' }));
    ed.execute(updateInterface(sw2, trunk12.b.iface.id, { mode: 'trunk', allowedVlans: '' }));
    ed.execute(updateInterface(sw2, link23.a.iface.id, { mode: 'access', accessVlan: 30 }));
    ed.execute(updateInterface(sw3, link23.b.iface.id, { mode: 'access', accessVlan: 30 }));
    const d10 = vlanDomain(ed.doc, 10);
    expect(d10.linkIds.has(trunk12.link.id)).toBe(true);
    expect(d10.linkIds.has(link23.link.id)).toBe(false);
    const d30 = vlanDomain(ed.doc, 30);
    expect(d30.linkIds.has(link23.link.id)).toBe(true);
    expect(d30.linkIds.has(trunk12.link.id)).toBe(false);
    expect(d30.deviceIds.has(sw2)).toBe(true);
  });

  it('reads VLANs for every interface kind', () => {
    const base = resolveLinks(campus().ed.doc)[0]?.a.iface;
    if (!base) throw new Error('missing');
    expect(interfaceVlans({ ...base, type: 'vlan', name: 'Vlan20' })).toEqual(new Set([20]));
    expect(interfaceVlans({ ...base, type: 'subinterface', dot1q: 5 })).toEqual(new Set([5]));
    expect(interfaceVlans({ ...base, mode: 'access' })).toEqual(new Set([1]));
    expect(interfaceVlans({ ...base, mode: 'trunk', allowedVlans: '' })).toBeNull();
    expect(interfaceVlans({ ...base, mode: 'trunk', allowedVlans: 'bad' })).toEqual(new Set());
    expect(interfaceVlans({ ...base, mode: 'routed' })).toEqual(new Set());
  });
});

describe('summaries and labels [FR-NET-09, FR-NET-30, FR-LNK-03]', () => {
  it('summarizes devices', () => {
    const { ed, sw1 } = campus();
    const d = ed.doc.devices.find((x) => x.id === sw1);
    if (!d) throw new Error('missing');
    expect(deviceSummary(ed.doc, d)).toMatchObject({ hostname: 'SW1', interfaceCount: 28, usedCount: 2 });
  });

  it('hides pure L2 devices in the L3 view', () => {
    const { ed, sw1, r1 } = campus();
    const sw = ed.doc.devices.find((x) => x.id === sw1);
    const r = ed.doc.devices.find((x) => x.id === r1);
    if (!sw || !r) throw new Error('missing');
    expect(isVisibleInLayer(sw, 'l1')).toBe(true);
    expect(isVisibleInLayer(sw, 'l3')).toBe(false);
    expect(isVisibleInLayer(r, 'l3')).toBe(true);
  });

  it('builds link end labels per layer', () => {
    const i = resolveLinks(campus().ed.doc)[0]?.a.iface;
    if (!i) throw new Error('missing');
    const withIp = { ...i, ipv4: [{ address: '10.0.0.1', prefix: 30, secondary: false }] };
    const off = { names: false, ips: false, vlans: false };
    expect(endLabel(withIp, 'l1', off)).toBe('Gi0/0');
    expect(endLabel(withIp, 'l3', off)).toBe('10.0.0.1/30');
    expect(endLabel({ ...i, mode: 'trunk', allowedVlans: '10' }, 'l2', off)).toBe('trunk 10');
    expect(
      endLabel({ ...i, mode: 'access', accessVlan: 5 }, 'l2', { names: true, ips: false, vlans: false }),
    ).toBe('Gi0/0\nVLAN 5');
  });
});
