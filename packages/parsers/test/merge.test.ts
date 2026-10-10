// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  addDevice,
  connect,
  createDocument,
  Editor,
  sequentialIds,
  setClock,
  setIdSource,
} from '@linewise/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyImportPlan, buildImportPlan, parseCdp, parseRunningConfig, parseText } from '../src/index.ts';

const FIX = join(import.meta.dirname, '..', 'fixtures');
const read = (rel: string) => readFileSync(join(FIX, rel), 'utf8');

let restore: (() => void)[] = [];
beforeEach(() => {
  restore = [setIdSource(sequentialIds('m')), setClock(() => '2026-10-09T00:00:00.000Z')];
});
afterEach(() => restore.forEach((r) => r()));

const R1_CDP = `R1#show cdp neighbors detail
-------------------------
Device ID: SW1
Entry address(es):
  IP address: 10.0.0.2
Platform: cisco WS-C3850-24P,  Capabilities: Switch IGMP
Interface: GigabitEthernet0/1,  Port ID (outgoing port): GigabitEthernet1/0/24
`;
const SW1_CDP = `SW1#show cdp neighbors detail
-------------------------
Device ID: R1
Entry address(es):
  IP address: 10.0.0.1
Platform: cisco ISR4331/K9,  Capabilities: Router
Interface: GigabitEthernet1/0/24,  Port ID (outgoing port): GigabitEthernet0/1
`;

describe('import plan [FR-IMP-21, FR-IMP-23]', () => {
  it('de-duplicates a link seen from both sides and merges device data', () => {
    const doc = createDocument();
    const plan = buildImportPlan(doc, [
      { source: 'r1.txt', result: parseCdp(R1_CDP) },
      { source: 'sw1.txt', result: parseCdp(SW1_CDP) },
    ]);
    expect(plan.links).toHaveLength(1);
    expect(plan.devices.map((d) => [d.hostname, d.action, d.role])).toEqual([
      ['R1', 'create', 'router'],
      ['SW1', 'create', 'l2-switch'],
    ]);
    expect(plan.devices[0]?.parsed.mgmtIp).toBe('10.0.0.1');
  });

  it('matches existing devices by hostname, then serial, then management IP', () => {
    const ed = new Editor(createDocument());
    const pageId = ed.doc.pages[0]?.id as string;
    ed.execute(addDevice({ role: 'router', pageId, position: { x: 0, y: 0 }, hostname: 'r1' }));
    ed.execute(
      addDevice({
        role: 'l2-switch',
        pageId,
        position: { x: 0, y: 0 },
        hostname: 'old-name',
        fields: { mgmtIp: '10.0.0.2' },
      }),
    );
    const plan = buildImportPlan(ed.doc, [{ source: 'r1', result: parseCdp(R1_CDP) }]);
    expect(plan.devices.map((d) => [d.hostname, d.action])).toEqual([
      ['old-name', 'update'],
      ['r1', 'update'],
    ]);
  });

  it('applies the plan as one undo step, creating devices, interfaces, VLANs, VRFs, port-channels and links', () => {
    const ed = new Editor(createDocument());
    const pageId = ed.doc.pages[0]?.id as string;
    const plan = buildImportPlan(ed.doc, [
      { source: 'access', result: parseRunningConfig(read('running-config/01-ios-access.txt')) },
      { source: 'router', result: parseRunningConfig(read('running-config/02-ios-router.txt')) },
      { source: 'cdp', result: parseCdp(read('cdp/01-ios-two-neighbors.txt'), {}) },
    ]);
    const cmd = applyImportPlan(plan, { pageId, origin: { x: 100, y: 100 } });
    ed.execute(cmd);
    expect(ed.doc.devices.map((d) => d.hostname).sort()).toEqual(['ACCESS-1', 'EDGE-R1', 'R1', 'R2', 'SW1']);
    expect(ed.doc.vlans.map((v) => v.number)).toEqual([10, 20, 99]);
    expect(ed.doc.vrfs.map((v) => v.name)).toEqual(['CUSTOMER-A']);
    expect(ed.doc.portChannels).toHaveLength(1);
    const access = ed.doc.devices.find((d) => d.hostname === 'ACCESS-1');
    expect(access?.interfaces.find((i) => i.name === 'GigabitEthernet1/0/49')?.portChannelId).toBe(
      ed.doc.portChannels[0]?.id,
    );
    const sub = ed.doc.devices.find((d) => d.hostname === 'EDGE-R1')?.interfaces.find((i) => i.dot1q === 200);
    expect(sub?.vrfId).toBe(ed.doc.vrfs[0]?.id);
    expect(ed.doc.links).toHaveLength(2);
    expect(Object.keys(ed.doc.pages[0]?.nodePositions ?? {})).toHaveLength(5);
    expect(ed.history.undoLabel).toBe('Import');
    ed.undo();
    expect(ed.doc.devices).toHaveLength(0);
    expect(ed.doc.vlans).toHaveLength(0);
  });

  it('marks existing links and conflicts, and honors deselection', () => {
    const ed = new Editor(createDocument());
    const pageId = ed.doc.pages[0]?.id as string;
    const first = buildImportPlan(ed.doc, [{ source: 'r1', result: parseCdp(R1_CDP) }]);
    ed.execute(applyImportPlan(first, { pageId }));
    const again = buildImportPlan(ed.doc, [{ source: 'sw1', result: parseCdp(SW1_CDP) }]);
    expect(again.links[0]).toMatchObject({ action: 'exists', selected: false });

    // Link the router's Gi0/2 elsewhere, then import a CDP entry that claims it.
    const r1 = ed.doc.devices.find((d) => d.hostname === 'R1');
    const x = addDevice({ role: 'server', pageId, position: { x: 0, y: 0 }, hostname: 'X' });
    ed.execute(x);
    ed.execute(connect({ deviceId: r1?.id as string }, { deviceId: x.deviceId }));
    const used = ed.doc.links.at(-1)?.endpointA.interfaceId;
    const usedName =
      r1 && ed.doc.devices.find((d) => d.id === r1.id)?.interfaces.find((i) => i.id === used)?.shortName;
    const claim = parseCdp(
      `R1#show cdp neighbors detail\n-------------------------\nDevice ID: Y\nInterface: ${usedName},  Port ID (outgoing port): Gi0/0\n`,
    );
    const plan = buildImportPlan(ed.doc, [{ source: 'claim', result: claim }]);
    expect(plan.links[0]).toMatchObject({ action: 'conflict', selected: false });

    const sel = buildImportPlan(ed.doc, [
      { source: 'gns3', result: parseText(read('gns3/01-basic.gns3'), { fileName: 'a.gns3' }) },
    ]);
    expect(sel.devices.find((d) => d.hostname === 'R1')?.action).toBe('update');
    for (const d of sel.devices) d.selected = d.hostname !== 'PC1';
    const before = ed.doc.devices.length;
    ed.execute(applyImportPlan(sel, { pageId }));
    expect(ed.doc.devices.length - before).toBe(1); // Switch1 created; R1 updated; PC1 skipped
    expect(
      ed.doc.devices.find((d) => d.hostname === 'R1')?.interfaces.some((i) => i.name === 'FastEthernet0/0'),
    ).toBe(true);
  });

  it('places draw.io shapes at their positions and keeps annotations', () => {
    const ed = new Editor(createDocument());
    const pageId = ed.doc.pages[0]?.id as string;
    const plan = buildImportPlan(ed.doc, [
      { source: 'd', result: parseText(read('drawio/01-uncompressed.drawio'), { fileName: 'a.drawio' }) },
    ]);
    const cmd = applyImportPlan(plan, { pageId, origin: { x: 10, y: 20 } });
    ed.execute(cmd);
    const r1 = ed.doc.devices.find((d) => d.hostname === 'R1');
    expect(ed.doc.pages[0]?.nodePositions[r1?.id as string]).toEqual({ x: 150, y: 85 });
    expect(ed.doc.pages[0]?.annotations[0]?.text).toBe('Building A');
    expect(ed.doc.links).toHaveLength(1);
    const names =
      ed.doc.links[0] &&
      ed.doc.devices
        .flatMap((d) => d.interfaces)
        .filter((i) =>
          [ed.doc.links[0]?.endpointA.interfaceId, ed.doc.links[0]?.endpointB.interfaceId].includes(i.id),
        )
        .map((i) => i.shortName);
    expect(names).toEqual(['Gi0/1', 'Gi1/0/1']);
  });
});
