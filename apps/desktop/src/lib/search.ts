// SPDX-License-Identifier: Apache-2.0
/** Find (FR-CAN-15) and palette device search (FR-APP-08): hostname, IP, interface, VLAN, label. Pure. */
import type { NetworkDocument } from '@linewise/core';

export type HitKind = 'device' | 'interface' | 'link' | 'vlan' | 'annotation' | 'zone';

export interface Hit {
  kind: HitKind;
  id: string;
  /** Device to select and reveal (device and interface hits). */
  deviceId?: string;
  pageId?: string;
  title: string;
  detail: string;
  vlan?: number;
}

export function searchDocument(doc: NetworkDocument, query: string, limit = 200): Hit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: Hit[] = [];
  const pageOf = (deviceId: string) => doc.pages.find((p) => p.nodePositions[deviceId])?.id;
  const has = (...xs: (string | undefined)[]) => xs.some((x) => x && x.toLowerCase().includes(q));
  const vlanQuery = /^(?:vlan\s*)?(\d{1,4})$/i.exec(query.trim());
  if (vlanQuery) {
    const n = Number(vlanQuery[1]);
    const v = doc.vlans.find((x) => x.number === n);
    if (v || /^vlan/i.test(query.trim()))
      hits.push({
        kind: 'vlan',
        id: v?.id ?? `vlan-${n}`,
        title: `VLAN ${n}`,
        detail: v?.name ?? '',
        vlan: n,
      });
  }
  for (const d of doc.devices) {
    if (has(d.hostname, d.mgmtIp, d.model, d.serial, d.assetTag, d.site, ...d.tags)) {
      hits.push({
        kind: 'device',
        id: d.id,
        deviceId: d.id,
        pageId: pageOf(d.id),
        title: d.hostname,
        detail: [d.mgmtIp, d.model, d.site].filter(Boolean).join(' · '),
      });
    }
    for (const i of d.interfaces) {
      const ips = [...i.ipv4, ...i.ipv6].map((a) => `${a.address}/${a.prefix}`);
      if (has(i.name, i.shortName, i.description, ...ips, i.fhrp?.vip)) {
        hits.push({
          kind: 'interface',
          id: i.id,
          deviceId: d.id,
          pageId: pageOf(d.id),
          title: `${d.hostname} ${i.shortName}`,
          detail: [ips[0], i.description].filter(Boolean).join(' · '),
        });
      }
    }
    if (hits.length >= limit) break;
  }
  for (const l of doc.links) {
    if (has(l.label, l.cableId, l.circuitId, l.provider)) {
      const a = doc.devices.find((d) => d.id === l.endpointA.deviceId);
      const b = doc.devices.find((d) => d.id === l.endpointB.deviceId);
      hits.push({
        kind: 'link',
        id: l.id,
        deviceId: a?.id,
        pageId: a ? pageOf(a.id) : undefined,
        title: `${a?.hostname ?? '?'} ↔ ${b?.hostname ?? '?'}`,
        detail: [l.label, l.cableId, l.circuitId].filter(Boolean).join(' · '),
      });
    }
  }
  for (const z of doc.zones)
    if (has(z.name, z.description))
      hits.push({
        kind: 'zone',
        id: z.id,
        pageId: doc.pages.find((p) => p.zoneBoxes[z.id])?.id,
        title: z.name,
        detail: z.kind,
      });
  for (const p of doc.pages)
    for (const a of p.annotations)
      if (has(a.text) && a.kind !== 'image')
        hits.push({
          kind: 'annotation',
          id: a.id,
          pageId: p.id,
          title: a.text.split('\n')[0] ?? '',
          detail: p.name,
        });
  return hits.slice(0, limit);
}
