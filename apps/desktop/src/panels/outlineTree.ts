// SPDX-License-Identifier: Apache-2.0
/**
 * The topology outline as a tree (NFR-A11Y-02): zones (nested) → devices → interfaces → link
 * peers, mirroring the current page. Pure, so the panel and its tests share it.
 */
import { resolveLinks, type Device, type NetworkDocument, type Page } from '@linewise/core';

export type OutlineKind = 'zone' | 'device' | 'interface' | 'peer';

export interface OutlineNode {
  /** Unique within the tree; also the DOM id suffix. */
  key: string;
  kind: OutlineKind;
  /** Short name read first: zone name, hostname, interface name, or peer "host port". */
  label: string;
  /** Extra facts read after the name: role and address, IPs and VLANs, the link medium. */
  detail: string;
  /** The device to select when this item is activated (the peer's device for a peer). */
  deviceId?: string;
  linkId?: string;
  children: OutlineNode[];
}

export interface OutlineLabels {
  noZone: string;
  role: (d: Device) => string;
  connectedTo: (host: string, port: string) => string;
  access: (vlan: number) => string;
  trunk: (vlans: string) => string;
}

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

export function buildOutline(
  doc: NetworkDocument,
  page: Page,
  query: string,
  labels: OutlineLabels,
): OutlineNode[] {
  const q = query.trim().toLowerCase();
  const onPage = doc.devices.filter((d) => page.nodePositions[d.id]);
  const matches = (d: Device) =>
    !q ||
    [d.hostname, d.mgmtIp, d.model, d.role, ...d.interfaces.flatMap((i) => i.ipv4.map((a) => a.address))]
      .join(' ')
      .toLowerCase()
      .includes(q);

  const peers = new Map<string, { host: string; port: string; deviceId: string; linkId: string }>();
  for (const l of resolveLinks(doc)) {
    peers.set(l.a.iface.id, {
      host: l.b.device.hostname,
      port: l.b.iface.shortName,
      deviceId: l.b.device.id,
      linkId: l.link.id,
    });
    peers.set(l.b.iface.id, {
      host: l.a.device.hostname,
      port: l.a.iface.shortName,
      deviceId: l.a.device.id,
      linkId: l.link.id,
    });
  }

  const deviceNode = (d: Device): OutlineNode => ({
    key: `d-${d.id}`,
    kind: 'device',
    label: d.hostname,
    detail: [labels.role(d), d.mgmtIp].filter(Boolean).join(', '),
    deviceId: d.id,
    children: d.interfaces.map((i) => {
      const peer = peers.get(i.id);
      const mode =
        i.mode === 'access' && i.accessVlan
          ? labels.access(i.accessVlan)
          : i.mode === 'trunk'
            ? labels.trunk(i.allowedVlans || 'all')
            : '';
      return {
        key: `i-${i.id}`,
        kind: 'interface',
        label: i.shortName,
        detail: [...i.ipv4.map((a) => `${a.address}/${a.prefix}`), mode, i.description]
          .filter(Boolean)
          .join(', '),
        deviceId: d.id,
        children: peer
          ? [
              {
                key: `p-${i.id}`,
                kind: 'peer',
                label: labels.connectedTo(peer.host, peer.port),
                detail: '',
                deviceId: peer.deviceId,
                linkId: peer.linkId,
                children: [],
              },
            ]
          : [],
      };
    }),
  });

  const devicesIn = (zoneId: string | undefined) =>
    onPage
      .filter((d) => (d.zoneId ?? undefined) === zoneId && matches(d))
      .sort((a, b) => byName(a.hostname, b.hostname))
      .map(deviceNode);

  const zonesOnPage = doc.zones.filter((z) => page.zoneBoxes[z.id]);
  const ids = new Set(zonesOnPage.map((z) => z.id));
  const zoneNode = (zoneId: string, seen: Set<string>): OutlineNode | null => {
    const z = zonesOnPage.find((x) => x.id === zoneId)!;
    const next = new Set(seen).add(zoneId);
    const sub = zonesOnPage
      .filter((c) => c.parentZoneId === zoneId && !next.has(c.id))
      .sort((a, b) => byName(a.name, b.name))
      .map((c) => zoneNode(c.id, next))
      .filter((x): x is OutlineNode => !!x);
    const children = [...sub, ...devicesIn(zoneId)];
    // While filtering, zones without a match are left out.
    if (q && children.length === 0) return null;
    return { key: `z-${z.id}`, kind: 'zone', label: z.name, detail: '', children };
  };

  const roots = zonesOnPage
    .filter((z) => !z.parentZoneId || !ids.has(z.parentZoneId))
    .sort((a, b) => byName(a.name, b.name))
    .map((z) => zoneNode(z.id, new Set()))
    .filter((x): x is OutlineNode => !!x);
  // Devices whose zone is missing or on another page count as "not in a zone".
  const loose = onPage
    .filter((d) => (!d.zoneId || !ids.has(d.zoneId)) && matches(d))
    .sort((a, b) => byName(a.hostname, b.hostname))
    .map(deviceNode);
  if (loose.length)
    roots.push({ key: 'z-none', kind: 'zone', label: labels.noZone, detail: '', children: loose });
  return roots;
}

/** The items a keyboard user can reach: every node whose ancestors are all expanded. */
export function visibleNodes(
  roots: OutlineNode[],
  expanded: ReadonlySet<string>,
): { node: OutlineNode; level: number; parent: string | null }[] {
  const out: { node: OutlineNode; level: number; parent: string | null }[] = [];
  const walk = (nodes: OutlineNode[], level: number, parent: string | null) => {
    for (const n of nodes) {
      out.push({ node: n, level, parent });
      if (n.children.length && expanded.has(n.key)) walk(n.children, level + 1, n.key);
    }
  };
  walk(roots, 1, null);
  return out;
}
