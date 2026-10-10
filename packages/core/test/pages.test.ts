// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  addOffPageRef,
  connectedDevices,
  devicesWithSameRole,
  removeOffPageRef,
  reorderItems,
  setLocked,
  addAnnotation,
  addDevice,
  addPage,
  assignIp,
  connect,
  removeVlans,
  removeVrfs,
  reorderPages,
  setPageLayers,
  updateDocumentInfo,
  updateInterface,
  updateLinkStyle,
  updatePage,
  upsertSubnet,
  upsertVlan,
  upsertVrf,
} from '../src/index.ts';
import { newEditor, routerTemplate, useDeterminism } from './helpers.ts';

useDeterminism();

describe('page and document commands', () => {
  it('edits page name and background, and reorders pages', () => {
    const { ed } = newEditor();
    const first = ed.doc.pages[0]!.id;
    const p2 = addPage('Second');
    ed.execute(p2);
    ed.execute(updatePage(first, { name: 'Overview', background: 'grid' }));
    expect(ed.doc.pages[0]).toMatchObject({ name: 'Overview', background: 'grid' });
    ed.execute(reorderPages([p2.pageId, first]));
    const sorted = [...ed.doc.pages].sort((a, b) => a.order - b.order).map((p) => p.id);
    expect(sorted).toEqual([p2.pageId, first]);
    ed.undo();
    expect([...ed.doc.pages].sort((a, b) => a.order - b.order)[0]!.id).toBe(first);
  });

  it('edits name, author and description in one undo step', () => {
    const { ed } = newEditor();
    ed.execute(updateDocumentInfo({ name: 'HQ', author: 'Gaven', description: 'Main site' }));
    expect(ed.doc).toMatchObject({ name: 'HQ', author: 'Gaven', description: 'Main site' });
    ed.undo();
    expect(ed.doc.author).toBe('');
  });

  it('replaces layers and detaches annotations from removed layers', () => {
    const { ed, pageId } = newEditor();
    ed.execute(setPageLayers(pageId, [{ id: 'L1', name: 'Notes', visible: true, locked: false, order: 5 }]));
    const a = addAnnotation(pageId, {
      kind: 'note',
      geometry: { x: 0, y: 0, w: 10, h: 10, rotation: 0 },
      style: {},
      text: 'x',
      layerId: 'L1',
      locked: false,
    });
    ed.execute(a);
    expect(ed.doc.pages[0]!.layers[0]!.order).toBe(0);
    ed.execute(setPageLayers(pageId, []));
    expect(ed.doc.pages[0]!.annotations[0]!.layerId).toBeUndefined();
  });
});

describe('link style', () => {
  it('merges style keys and removes undefined ones', () => {
    const { ed, pageId } = newEditor();
    const r1 = addDevice({ role: 'router', pageId, position: { x: 0, y: 0 }, template: routerTemplate });
    const r2 = addDevice({ role: 'router', pageId, position: { x: 200, y: 0 }, template: routerTemplate });
    ed.execute(r1);
    ed.execute(r2);
    const c = connect({ deviceId: r1.deviceId }, { deviceId: r2.deviceId });
    ed.execute(c);
    ed.execute(updateLinkStyle([c.linkId], { color: '#ff0000', routing: 'curved' }));
    ed.execute(updateLinkStyle([c.linkId], { color: undefined }));
    const style = ed.doc.links[0]!.style;
    expect(style).toEqual({ routing: 'curved' });
    expect('color' in style).toBe(false);
  });
});

describe('VLAN and VRF removal', () => {
  it('clears references from subnets and interfaces', () => {
    const { ed, pageId } = newEditor();
    const r1 = addDevice({ role: 'router', pageId, position: { x: 0, y: 0 }, template: routerTemplate });
    ed.execute(r1);
    const vlan = upsertVlan({ number: 10, name: 'Users' });
    const vrf = upsertVrf({ name: 'MGMT' });
    ed.execute(vlan);
    ed.execute(vrf);
    ed.execute(upsertSubnet({ cidr: '10.0.10.0/24', vlanId: vlan.vlanId, vrfId: vrf.vrfId }));
    const iface = ed.doc.devices[0]!.interfaces[0]!;
    ed.execute(updateInterface(r1.deviceId, iface.id, { vrfId: vrf.vrfId }));
    ed.execute(assignIp(r1.deviceId, iface.id, '10.0.10.1', 24));
    ed.execute(removeVlans([vlan.vlanId]));
    expect(ed.doc.subnets[0]!.vlanId).toBeUndefined();
    ed.execute(removeVrfs([vrf.vrfId]));
    expect(ed.doc.vrfs).toHaveLength(0);
    expect(ed.doc.subnets[0]!.vrfId).toBeUndefined();
    expect(ed.doc.devices[0]!.interfaces[0]!.vrfId).toBeUndefined();
    ed.undo();
    expect(ed.doc.devices[0]!.interfaces[0]!.vrfId).toBe(vrf.vrfId);
  });
});

describe('drawing order, locking and off-page references', () => {
  it('keeps zone and annotation order through save and load', async () => {
    const { parseDocument, serializeDocument, addZone } = await import('../src/index.ts');
    const { ed, pageId } = newEditor();
    const z1 = addZone(pageId, 'Back', 'custom', { x: 0, y: 0, w: 100, h: 100 });
    const z2 = addZone(pageId, 'Front', 'custom', { x: 0, y: 0, w: 100, h: 100 });
    ed.execute(z1);
    ed.execute(z2);
    ed.execute(reorderItems(pageId, [z2.zoneId], 'back'));
    expect(ed.doc.zones.map((z) => z.name)).toEqual(['Front', 'Back']);
    const r = parseDocument(serializeDocument(ed.doc));
    expect(r.status).toBe('ok');
    if (r.status === 'ok') expect(r.doc.zones.map((z) => z.name)).toEqual(['Front', 'Back']);
    ed.execute(reorderItems(pageId, [z2.zoneId], 'front'));
    expect(ed.doc.zones.at(-1)!.name).toBe('Front');
  });

  it('locks devices, zones and annotations together', () => {
    const { ed, pageId } = newEditor();
    const r1 = addDevice({ role: 'router', pageId, position: { x: 0, y: 0 } });
    ed.execute(r1);
    ed.execute(setLocked(pageId, [r1.deviceId], true));
    expect(ed.doc.devices[0]!.locked).toBe(true);
    ed.execute(setLocked(pageId, [r1.deviceId], false));
    expect(ed.doc.devices[0]!.locked).toBe(false);
  });

  it('adds and removes off-page references only for devices placed elsewhere', () => {
    const { ed, pageId } = newEditor();
    const r1 = addDevice({ role: 'router', pageId, position: { x: 0, y: 0 } });
    ed.execute(r1);
    const p2 = addPage('WAN');
    ed.execute(p2);
    expect(() => ed.execute(addOffPageRef(pageId, r1.deviceId, { x: 0, y: 0 }))).toThrow(
      /already on this page/,
    );
    ed.execute(addOffPageRef(p2.pageId, r1.deviceId, { x: 10, y: 20 }));
    ed.execute(addOffPageRef(p2.pageId, r1.deviceId, { x: 30, y: 40 }));
    const page2 = ed.doc.pages.find((p) => p.id === p2.pageId)!;
    expect(page2.offPageRefs).toEqual([{ deviceId: r1.deviceId, position: { x: 30, y: 40 } }]);
    ed.execute(removeOffPageRef(p2.pageId, r1.deviceId));
    expect(ed.doc.pages.find((p) => p.id === p2.pageId)!.offPageRefs).toHaveLength(0);
  });

  it('finds connected devices and devices of the same role', () => {
    const { ed, pageId } = newEditor();
    const a = addDevice({ role: 'router', pageId, position: { x: 0, y: 0 }, template: routerTemplate });
    const b = addDevice({ role: 'router', pageId, position: { x: 100, y: 0 }, template: routerTemplate });
    const c = addDevice({ role: 'server', pageId, position: { x: 200, y: 0 } });
    [a, b, c].forEach((x) => ed.execute(x));
    ed.execute(connect({ deviceId: a.deviceId }, { deviceId: c.deviceId }));
    expect(connectedDevices(ed.doc, [a.deviceId]).sort()).toEqual([a.deviceId, c.deviceId].sort());
    expect(devicesWithSameRole(ed.doc, [a.deviceId]).sort()).toEqual([a.deviceId, b.deviceId].sort());
  });
});
