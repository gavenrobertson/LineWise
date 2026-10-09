// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  addAnnotation,
  addAsset,
  addDevice,
  addZone,
  applyLayout,
  createPortChannel,
  nextFreeInterface,
  removeSubnets,
  removeVlans,
  renameDocument,
  renamePage,
  resizeZone,
  updateAnnotation,
  updateSettings,
  updateZone,
  upsertSubnet,
  upsertVlan,
  upsertVrf,
  uuidv7,
  validateTemplate,
  copyHostname,
  nextHostname,
} from '../src/index.ts';
import { newEditor, switchTemplate } from './helpers.ts';

describe('uuidv7', () => {
  it('produces RFC 9562 v7 UUIDs that sort by time', () => {
    const a = uuidv7(1_700_000_000_000);
    const b = uuidv7(1_700_000_000_001);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a < b).toBe(true);
  });
});

describe('templates [FR-TPL-01]', () => {
  it('requires a datasheet for verified vendor templates', () => {
    expect(() =>
      validateTemplate({
        id: 'acme/x1',
        name: 'X1',
        vendor: 'Acme',
        model: 'X1',
        role: 'router',
        verified: true,
      }),
    ).toThrow(/sourceUrl/);
    expect(() =>
      validateTemplate({ id: 'Bad Id', name: 'X', vendor: 'A', model: 'X', role: 'router' }),
    ).toThrow();
    const t = validateTemplate({
      id: 'acme/x1',
      name: 'X1',
      vendor: 'Acme',
      model: 'X1',
      role: 'router',
      verified: true,
      sourceUrl: 'https://example.com/x1.pdf',
    });
    expect(t.rackUnits).toBe(1);
  });
});

describe('remaining commands', () => {
  it('handles annotations, zones, settings, assets and names', () => {
    const { ed, pageId } = newEditor();
    const a = addAnnotation(pageId, {
      kind: 'note',
      geometry: { x: 0, y: 0, w: 100, h: 60, rotation: 0 },
      style: {},
      text: 'hi',
      locked: false,
    });
    ed.execute(a);
    ed.execute(updateAnnotation(pageId, a.annotationId, { text: 'hello' }, 'typing'));
    expect(ed.doc.pages[0]?.annotations[0]?.text).toBe('hello');
    const z = addZone(pageId, 'Site A', 'site', { x: 0, y: 0, w: 100, h: 100 });
    ed.execute(z);
    ed.execute(updateZone(z.zoneId, { name: 'Site: Huntsville' }));
    ed.execute(resizeZone(pageId, z.zoneId, { x: 0, y: 0, w: 400, h: 300 }, 'resize'));
    ed.execute(applyLayout(pageId, { [z.zoneId]: { x: 50, y: 60 } }));
    expect(ed.doc.pages[0]?.zoneBoxes[z.zoneId]).toEqual({ x: 50, y: 60, w: 400, h: 300 });
    expect(ed.history.undoLabel).toBe('Auto-layout');
    ed.execute(updateSettings({ showVlans: true }));
    ed.execute(renameDocument('Campus'));
    ed.execute(renamePage(pageId, 'Core'));
    const asset = addAsset('image/png', 'AAAA');
    ed.execute(asset);
    expect(ed.doc).toMatchObject({ name: 'Campus', settings: { showVlans: true } });
    expect(ed.doc.pages[0]?.name).toBe('Core');
    expect(ed.doc.assets[asset.assetId]?.mime).toBe('image/png');
  });

  it('manages VRFs, VLAN and subnet removal', () => {
    const { ed } = newEditor();
    const vrf = upsertVrf({ name: 'CORP', rd: '65000:1' });
    ed.execute(vrf);
    ed.execute(upsertVrf({ id: vrf.vrfId, name: 'CORP2' }));
    expect(ed.doc.vrfs[0]?.name).toBe('CORP2');
    const v = upsertVlan({ number: 20 });
    const s = upsertSubnet({ cidr: '10.0.0.0/24' });
    ed.execute(v);
    ed.execute(s);
    ed.execute(upsertSubnet({ id: s.subnetId, cidr: '10.0.1.0/24' }));
    expect(ed.doc.subnets[0]?.cidr).toBe('10.0.1.0/24');
    ed.execute(removeVlans([v.vlanId]));
    ed.execute(removeSubnets([s.subnetId]));
    expect(ed.doc.vlans).toHaveLength(0);
    expect(ed.doc.subnets).toHaveLength(0);
  });

  it('finds free interfaces and unique hostnames', () => {
    const { ed, pageId } = newEditor();
    const s = addDevice({ role: 'l2-switch', pageId, position: { x: 0, y: 0 }, template: switchTemplate });
    ed.execute(s);
    expect(nextFreeInterface(ed.doc, s.deviceId)?.shortName).toBe('Gi1/0/1');
    expect(nextHostname(ed.doc, 'SW')).toBe('SW2');
    expect(copyHostname(ed.doc, 'SW1')).toBe('SW1-copy');
    const members = ed.doc.devices[0]?.interfaces.slice(0, 2).map((i) => i.id) as string[];
    ed.execute(createPortChannel(s.deviceId, 2, members, 'on'));
    ed.execute(createPortChannel(s.deviceId, 2, [], 'on'));
    expect(ed.doc.devices[0]?.interfaces.filter((i) => i.name === 'Port-channel2')).toHaveLength(1);
  });
});
