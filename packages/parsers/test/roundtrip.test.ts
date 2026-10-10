// SPDX-License-Identifier: Apache-2.0
import {
  addDevice,
  connect,
  createDocument,
  Editor,
  exportContainerlab,
  exportDrawio,
  exportLinksCsv,
  validateTemplate,
} from '@linewise/core';
import { describe, expect, it } from 'vitest';
import { parseContainerlab, parseCsv, parseDrawio } from '../src/index.ts';

const router = validateTemplate({
  id: 'generic/r',
  name: 'R',
  vendor: 'Generic',
  model: 'R',
  role: 'router',
  generic: true,
  interfaces: [{ range: 'Gi0/0-3' }],
});

function doc() {
  const ed = new Editor(createDocument('Round trip'));
  const pageId = ed.doc.pages[0]?.id as string;
  const a = addDevice({ role: 'router', pageId, position: { x: 0, y: 0 }, template: router });
  const b = addDevice({ role: 'firewall', pageId, position: { x: 200, y: 0 }, template: router });
  ed.execute(a);
  ed.execute(b);
  ed.execute(connect({ deviceId: a.deviceId }, { deviceId: b.deviceId }));
  return { d: ed.doc, pageId };
}

describe('export → import round trips', () => {
  it('draw.io keeps devices, roles, positions and links [FR-EXP-06]', () => {
    const { d, pageId } = doc();
    const r = parseDrawio(exportDrawio(d, pageId));
    expect(r.devices.map((x) => [x.hostname, x.role])).toEqual([
      ['R1', 'router'],
      ['FW1', 'firewall'],
    ]);
    expect(r.devices[1]?.position).toEqual({ x: 200, y: 0 });
    expect(r.links).toEqual([
      {
        a: { hostname: 'R1', iface: 'GigabitEthernet0/0' },
        b: { hostname: 'FW1', iface: 'GigabitEthernet0/0' },
      },
    ]);
  });

  it('Containerlab keeps nodes and links [FR-EXP-07]', () => {
    const r = parseContainerlab(exportContainerlab(doc().d));
    expect(r.devices.map((x) => x.hostname)).toEqual(['R1', 'FW1']);
    expect(r.links).toHaveLength(1);
  });

  it('links CSV re-imports [FR-EXP-04, FR-IMP-05]', () => {
    const r = parseCsv(exportLinksCsv(doc().d));
    expect(r.links).toEqual([
      {
        a: { hostname: 'R1', iface: 'GigabitEthernet0/0' },
        b: { hostname: 'FW1', iface: 'GigabitEthernet0/0' },
      },
    ]);
  });
});
