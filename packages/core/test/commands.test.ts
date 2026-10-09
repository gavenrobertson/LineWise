// SPDX-License-Identifier: Apache-2.0
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  addDevice,
  addInterfaces,
  addPage,
  addZone,
  alignNodes,
  assignIp,
  batch,
  connect,
  copySelection,
  createPortChannel,
  distributeNodes,
  Editor,
  insertDeviceOnLink,
  moveNodes,
  nudgeNodes,
  paste,
  removeInterfaces,
  removeItems,
  removePage,
  renderLabel,
  updateDevices,
  updateInterface,
  updateLinks,
  upsertSubnet,
  upsertVlan,
  createDocument,
  type Command,
} from '../src/index.ts';
import { newEditor, routerTemplate, switchTemplate, useDeterminism } from './helpers.ts';

useDeterminism();

describe('devices [FR-NET-01, FR-CAN-09]', () => {
  it('creates a device from a template with its interfaces', () => {
    const { ed, pageId } = newEditor();
    const cmd = addDevice({
      role: 'l2-switch',
      pageId,
      position: { x: 100, y: 50 },
      template: switchTemplate,
    });
    ed.execute(cmd);
    const dev = ed.doc.devices[0];
    expect(dev?.hostname).toBe('SW1');
    expect(dev?.interfaces).toHaveLength(28);
    expect(dev?.interfaces[0]).toMatchObject({ name: 'GigabitEthernet1/0/1', poe: true });
    expect(dev?.interfaces[27]).toMatchObject({ shortName: 'Te1/1/4', media: 'fiber' });
    expect(ed.doc.pages[0]?.nodePositions[cmd.deviceId]).toEqual({ x: 100, y: 50 });
  });

  it('auto-numbers hostnames per role', () => {
    const { ed, pageId } = newEditor();
    ed.execute(addDevice({ role: 'router', pageId, position: { x: 0, y: 0 } }));
    ed.execute(addDevice({ role: 'router', pageId, position: { x: 0, y: 0 } }));
    ed.execute(addDevice({ role: 'firewall', pageId, position: { x: 0, y: 0 } }));
    expect(ed.doc.devices.map((d) => d.hostname)).toEqual(['R1', 'R2', 'FW1']);
  });

  it('edits several devices at once [FR-INS-02]', () => {
    const { ed, pageId } = newEditor();
    const a = addDevice({ role: 'l2-switch', pageId, position: { x: 0, y: 0 } });
    const b = addDevice({ role: 'l2-switch', pageId, position: { x: 0, y: 0 } });
    ed.execute(a);
    ed.execute(b);
    ed.execute(updateDevices([a.deviceId, b.deviceId], { site: 'Huntsville' }));
    expect(ed.doc.devices.every((d) => d.site === 'Huntsville')).toBe(true);
  });

  it('deletes devices with their links', () => {
    const { ed, pageId } = newEditor();
    const r = addDevice({ role: 'router', pageId, position: { x: 0, y: 0 }, template: routerTemplate });
    const s = addDevice({ role: 'l2-switch', pageId, position: { x: 0, y: 0 }, template: switchTemplate });
    ed.execute(r);
    ed.execute(s);
    ed.execute(connect({ deviceId: r.deviceId }, { deviceId: s.deviceId }));
    ed.execute(removeItems([r.deviceId]));
    expect(ed.doc.devices).toHaveLength(1);
    expect(ed.doc.links).toHaveLength(0);
    expect(ed.doc.pages[0]?.nodePositions[r.deviceId]).toBeUndefined();
  });
});

describe('links [FR-LNK-01]', () => {
  it('picks the next free port on each end', () => {
    const { ed, pageId } = newEditor();
    const r = addDevice({ role: 'router', pageId, position: { x: 0, y: 0 }, template: routerTemplate });
    const s = addDevice({ role: 'l2-switch', pageId, position: { x: 0, y: 0 }, template: switchTemplate });
    ed.execute(r);
    ed.execute(s);
    ed.execute(connect({ deviceId: r.deviceId }, { deviceId: s.deviceId }));
    ed.execute(connect({ deviceId: r.deviceId }, { deviceId: s.deviceId }));
    const [l1, l2] = ed.doc.links;
    const name = (dev: string, iface: string) =>
      ed.doc.devices.find((d) => d.id === dev)?.interfaces.find((i) => i.id === iface)?.shortName;
    expect(name(r.deviceId, l1?.endpointA.interfaceId ?? '')).toBe('Gi0/0');
    expect(name(r.deviceId, l2?.endpointA.interfaceId ?? '')).toBe('Gi0/1');
    expect(name(s.deviceId, l2?.endpointB.interfaceId ?? '')).toBe('Gi1/0/2');
  });

  it('uses a chosen interface and refuses one already in use', () => {
    const { ed, pageId } = newEditor();
    const r = addDevice({ role: 'router', pageId, position: { x: 0, y: 0 }, template: routerTemplate });
    const s = addDevice({ role: 'l2-switch', pageId, position: { x: 0, y: 0 }, template: switchTemplate });
    ed.execute(r);
    ed.execute(s);
    const gi03 = ed.doc.devices[0]?.interfaces[3]?.id as string;
    ed.execute(connect({ deviceId: r.deviceId, interfaceId: gi03 }, { deviceId: s.deviceId }));
    expect(ed.doc.links[0]?.endpointA.interfaceId).toBe(gi03);
    expect(() =>
      ed.execute(connect({ deviceId: r.deviceId, interfaceId: gi03 }, { deviceId: s.deviceId })),
    ).toThrow(/already linked/);
  });

  it('creates a port on devices without free interfaces', () => {
    const { ed, pageId } = newEditor();
    const cloud = addDevice({ role: 'internet', pageId, position: { x: 0, y: 0 } });
    const r = addDevice({ role: 'router', pageId, position: { x: 0, y: 0 }, template: routerTemplate });
    ed.execute(cloud);
    ed.execute(r);
    ed.execute(connect({ deviceId: cloud.deviceId }, { deviceId: r.deviceId }, 'fiber-sm', { label: 'ISP' }));
    expect(ed.doc.devices[0]?.interfaces).toHaveLength(1);
    expect(ed.doc.links[0]).toMatchObject({ medium: 'fiber-sm', label: 'ISP' });
    ed.execute(updateLinks([ed.doc.links[0]?.id as string], { bandwidthMbps: 10000 }));
    expect(ed.doc.links[0]?.bandwidthMbps).toBe(10000);
  });

  it('inserts a device on an existing link, splitting it', () => {
    const { ed, pageId } = newEditor();
    const r = addDevice({ role: 'router', pageId, position: { x: 0, y: 0 }, template: routerTemplate });
    const s = addDevice({ role: 'l2-switch', pageId, position: { x: 200, y: 0 }, template: switchTemplate });
    ed.execute(r);
    ed.execute(s);
    const c = connect({ deviceId: r.deviceId }, { deviceId: s.deviceId });
    ed.execute(c);
    const ins = insertDeviceOnLink(c.linkId, {
      role: 'firewall',
      pageId,
      position: { x: 100, y: 0 },
      template: routerTemplate,
    });
    ed.execute(ins);
    expect(ed.doc.links).toHaveLength(2);
    expect(
      ed.doc.links.every(
        (l) => l.endpointA.deviceId === ins.deviceId || l.endpointB.deviceId === ins.deviceId,
      ),
    ).toBe(true);
    ed.undo();
    expect(ed.doc.links).toHaveLength(1);
    expect(ed.doc.devices).toHaveLength(2);
  });
});

describe('interfaces [FR-NET-02, FR-INS-03]', () => {
  it('bulk-creates, edits and deletes interfaces', () => {
    const { ed, pageId } = newEditor();
    const r = addDevice({ role: 'router', pageId, position: { x: 0, y: 0 } });
    ed.execute(r);
    const add = addInterfaces(r.deviceId, 'Gi0/0-1, Lo0');
    ed.execute(add);
    expect(add.names).toEqual(['GigabitEthernet0/0', 'GigabitEthernet0/1', 'Loopback0']);
    const lo = ed.doc.devices[0]?.interfaces[2];
    expect(lo?.mode).toBe('routed');
    const gi0 = ed.doc.devices[0]?.interfaces[0]?.id as string;
    ed.execute(updateInterface(r.deviceId, gi0, { name: 'g0/5', description: 'uplink' }));
    expect(ed.doc.devices[0]?.interfaces[0]).toMatchObject({
      name: 'GigabitEthernet0/5',
      shortName: 'Gi0/5',
      description: 'uplink',
    });
    ed.execute(assignIp(r.deviceId, gi0, '10.0.12.1', 30));
    ed.execute(assignIp(r.deviceId, gi0, '10.0.12.5', 30));
    expect(ed.doc.devices[0]?.interfaces[0]?.ipv4).toEqual([
      { address: '10.0.12.5', prefix: 30, secondary: false },
    ]);
    ed.execute(assignIp(r.deviceId, gi0, '2001:db8::1', 64));
    expect(ed.doc.devices[0]?.interfaces[0]?.ipv6).toHaveLength(1);
    ed.execute(removeInterfaces(r.deviceId, [gi0]));
    expect(ed.doc.devices[0]?.interfaces).toHaveLength(2);
  });

  it('creates port-channels with a logical interface', () => {
    const { ed, pageId } = newEditor();
    const s = addDevice({ role: 'l2-switch', pageId, position: { x: 0, y: 0 }, template: switchTemplate });
    ed.execute(s);
    const members = ed.doc.devices[0]?.interfaces.slice(24, 26).map((i) => i.id) as string[];
    const pc = createPortChannel(s.deviceId, 1, members);
    ed.execute(pc);
    expect(ed.doc.portChannels[0]?.memberInterfaceIds).toEqual(members);
    expect(ed.doc.devices[0]?.interfaces.find((i) => i.name === 'Port-channel1')).toBeTruthy();
    expect(ed.doc.devices[0]?.interfaces[24]?.portChannelId).toBe(pc.portChannelId);
  });
});

describe('layout commands [FR-CAN-05, FR-CAN-06]', () => {
  function threeDevices() {
    const { ed, pageId } = newEditor();
    const ids = [
      [0, 10],
      [50, 40],
      [200, 90],
    ].map(([x, y]) => {
      const c = addDevice({ role: 'router', pageId, position: { x: x as number, y: y as number } });
      ed.execute(c);
      return c.deviceId;
    });
    return { ed, pageId, ids };
  }

  it('aligns and distributes', () => {
    const { ed, pageId, ids } = threeDevices();
    ed.execute(alignNodes(pageId, ids, 'top'));
    expect(ids.map((id) => ed.doc.pages[0]?.nodePositions[id]?.y)).toEqual([10, 10, 10]);
    ed.execute(distributeNodes(pageId, ids, 'horizontal'));
    expect(ids.map((id) => ed.doc.pages[0]?.nodePositions[id]?.x)).toEqual([0, 100, 200]);
  });

  it('coalesces a drag gesture into one undo step [FR-CAN-07]', () => {
    const { ed, pageId, ids } = threeDevices();
    const id = ids[0] as string;
    for (let i = 1; i <= 10; i++) ed.execute(moveNodes(pageId, { [id]: { x: i * 10, y: 0 } }, 'drag-1'));
    ed.history.breakCoalescing();
    expect(ed.history.size).toBe(4);
    ed.undo();
    expect(ed.doc.pages[0]?.nodePositions[id]).toEqual({ x: 0, y: 10 });
  });

  it('nudges selections', () => {
    const { ed, pageId, ids } = threeDevices();
    ed.execute(nudgeNodes(pageId, [ids[0] as string], 10, -1));
    expect(ed.doc.pages[0]?.nodePositions[ids[0] as string]).toEqual({ x: 10, y: 9 });
  });
});

describe('clipboard [FR-CAN-08]', () => {
  it('pastes with new ids, unique hostnames, cleared IPs and internal links', () => {
    const { ed, pageId } = newEditor();
    const r = addDevice({
      role: 'router',
      pageId,
      position: { x: 0, y: 0 },
      template: routerTemplate,
      hostname: 'R1',
    });
    const s = addDevice({ role: 'l2-switch', pageId, position: { x: 100, y: 0 }, template: switchTemplate });
    ed.execute(r);
    ed.execute(s);
    ed.execute(connect({ deviceId: r.deviceId }, { deviceId: s.deviceId }));
    ed.execute(assignIp(r.deviceId, ed.doc.devices[0]?.interfaces[0]?.id as string, '10.0.0.1', 24));
    const clip = copySelection(ed.doc, pageId, [r.deviceId, s.deviceId]);
    const p = paste(pageId, clip);
    ed.execute(p);
    expect(ed.doc.devices).toHaveLength(4);
    const copy = ed.doc.devices.find((d) => d.id === p.newDeviceIds[0]);
    expect(copy?.hostname).toBe('R1-copy');
    expect(copy?.interfaces.every((i) => i.ipv4.length === 0)).toBe(true);
    expect(ed.doc.links).toHaveLength(2);
    expect(ed.doc.pages[0]?.nodePositions[p.newDeviceIds[0] as string]).toEqual({ x: 40, y: 40 });
    ed.execute(paste(pageId, clip));
    expect(ed.doc.devices.map((d) => d.hostname)).toContain('R1-copy2');
  });
});

describe('pages, zones, VLANs, subnets [FR-CAN-11, FR-CAN-12, FR-NET-05]', () => {
  it('manages pages', () => {
    const { ed, pageId } = newEditor();
    const p2 = addPage('WAN');
    ed.execute(p2);
    ed.execute(addDevice({ role: 'router', pageId: p2.pageId, position: { x: 0, y: 0 } }));
    expect(ed.doc.pages.map((p) => p.order)).toEqual([0, 1]);
    ed.execute(removePage(p2.pageId));
    expect(ed.doc.pages).toHaveLength(1);
    expect(ed.doc.devices).toHaveLength(0);
    expect(() => ed.execute(removePage(pageId))).toThrow(/at least one page/);
  });

  it('manages zones, VLANs and subnets', () => {
    const { ed, pageId } = newEditor();
    const z = addZone(pageId, 'DMZ', 'security-zone', { x: 0, y: 0, w: 300, h: 200 });
    ed.execute(z);
    const r = addDevice({ role: 'firewall', pageId, position: { x: 10, y: 10 }, zoneId: z.zoneId });
    ed.execute(r);
    ed.execute(removeItems([z.zoneId]));
    expect(ed.doc.devices[0]?.zoneId).toBeUndefined();
    const v = upsertVlan({ number: 10, name: 'Users' });
    ed.execute(v);
    expect(() => ed.execute(upsertVlan({ number: 10 }))).toThrow(/already exists/);
    ed.execute(upsertVlan({ id: v.vlanId, number: 10, name: 'Staff' }));
    expect(ed.doc.vlans[0]?.name).toBe('Staff');
    ed.execute(upsertSubnet({ cidr: '10.10.0.0/24', vlanId: v.vlanId }));
    expect(ed.doc.subnets).toHaveLength(1);
  });
});

describe('undo/redo [FR-CAN-07]', () => {
  it('undoes and redoes, and labels entries', () => {
    const { ed, pageId } = newEditor();
    ed.execute(addDevice({ role: 'router', pageId, position: { x: 0, y: 0 } }));
    expect(ed.history.undoLabel).toBe('Add device');
    ed.undo();
    expect(ed.doc.devices).toHaveLength(0);
    expect(ed.history.redoLabel).toBe('Add device');
    ed.redo();
    expect(ed.doc.devices).toHaveLength(1);
  });

  it('batches several commands into one step', () => {
    const { ed, pageId } = newEditor();
    ed.execute(
      batch('Import', [
        addDevice({ role: 'router', pageId, position: { x: 0, y: 0 } }),
        addDevice({ role: 'router', pageId, position: { x: 0, y: 0 } }),
      ]),
    );
    expect(ed.doc.devices).toHaveLength(2);
    ed.undo();
    expect(ed.doc.devices).toHaveLength(0);
  });

  it('property: any command sequence, fully undone, restores the original document', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 25 }), (ops) => {
        const doc = createDocument('P');
        const ed = new Editor(doc);
        const pageId = doc.pages[0]?.id as string;
        for (const op of ops) {
          const devs = ed.doc.devices;
          const last = devs.at(-1);
          const first = devs[0];
          let cmd: Command | undefined;
          if (op === 0 || !last)
            cmd = addDevice({ role: 'router', pageId, position: { x: op, y: op }, template: routerTemplate });
          else if (op === 1) cmd = moveNodes(pageId, { [last.id]: { x: 5, y: 5 } }, 'k');
          else if (op === 2 && first && first.id !== last.id)
            cmd = connect({ deviceId: first.id }, { deviceId: last.id });
          else if (op === 3) cmd = updateDevices([last.id], { site: 'S' });
          else if (op === 4) cmd = removeItems([last.id]);
          else if (op === 5) cmd = upsertVlan({ number: 100 + ed.doc.vlans.length });
          else cmd = addInterfaces(last.id, 'Lo0-1');
          try {
            ed.execute(cmd);
          } catch {
            // commands may legitimately refuse (e.g. no free ports); that is not a change
          }
        }
        while (ed.history.canUndo) ed.undo();
        expect(ed.doc).toEqual(doc);
      }),
      { numRuns: 60 },
    );
  });
});

describe('labels [FR-NET-10]', () => {
  it('renders label templates', () => {
    const { ed, pageId } = newEditor();
    ed.execute(
      addDevice({
        role: 'router',
        pageId,
        position: { x: 0, y: 0 },
        fields: { mgmtIp: '10.0.0.1', model: 'ISR' },
      }),
    );
    const d = ed.doc.devices[0];
    if (!d) throw new Error('missing');
    expect(renderLabel('{hostname}\\n{mgmtIp}', d)).toBe('R1\n10.0.0.1');
    expect(renderLabel('{hostname} ({model})', d)).toBe('R1 (ISR)');
    expect(renderLabel('{hostname}\\n{serial}', d)).toBe('R1');
  });
});
