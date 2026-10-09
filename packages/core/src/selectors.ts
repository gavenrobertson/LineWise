// SPDX-License-Identifier: Apache-2.0
/**
 * Derived views of the model (FR-NET-30..33): VLAN membership, L3 adjacency,
 * shortest physical path and per-device summaries. Pure functions.
 */
import { linkedInterfaceIds } from './document.ts';
import { parseVlanList } from './naming.ts';
import type { Device, Interface, Link, NetworkDocument } from './schema.ts';

export type ViewLayer = 'l1' | 'l2' | 'l3';

/** VLANs an interface carries; `null` means "all VLANs" (a trunk with no allowed list). */
export function interfaceVlans(i: Interface): Set<number> | null {
  if (i.type === 'vlan') {
    const n = Number(/(\d+)$/.exec(i.name)?.[1]);
    return Number.isInteger(n) ? new Set([n]) : new Set();
  }
  if (i.type === 'subinterface' && i.dot1q) return new Set([i.dot1q]);
  if (i.mode === 'access') return new Set([i.accessVlan ?? 1]);
  if (i.mode === 'trunk') {
    if (!i.allowedVlans.trim()) return null;
    try {
      return new Set(parseVlanList(i.allowedVlans));
    } catch {
      return new Set();
    }
  }
  return new Set();
}

export function interfaceCarriesVlan(i: Interface, vlan: number): boolean {
  const s = interfaceVlans(i);
  return s === null ? true : s.has(vlan);
}

export interface Highlight {
  deviceIds: Set<string>;
  interfaceIds: Set<string>;
  linkIds: Set<string>;
}

function ifaceIndex(doc: NetworkDocument): Map<string, Interface> {
  const m = new Map<string, Interface>();
  for (const d of doc.devices) for (const i of d.interfaces) m.set(i.id, i);
  return m;
}

/** The L2 broadcast domain of a VLAN (FR-NET-32): everything that carries it. */
export function vlanDomain(doc: NetworkDocument, vlan: number): Highlight {
  const out: Highlight = { deviceIds: new Set(), interfaceIds: new Set(), linkIds: new Set() };
  for (const d of doc.devices) {
    for (const i of d.interfaces) {
      if (i.mode === 'unset' && i.type !== 'vlan' && i.type !== 'subinterface') continue;
      if (interfaceCarriesVlan(i, vlan)) {
        out.interfaceIds.add(i.id);
        out.deviceIds.add(d.id);
      }
    }
  }
  const idx = ifaceIndex(doc);
  for (const l of doc.links) {
    const a = idx.get(l.endpointA.interfaceId);
    const b = idx.get(l.endpointB.interfaceId);
    if (a && b && out.interfaceIds.has(a.id) && out.interfaceIds.has(b.id)) out.linkIds.add(l.id);
  }
  return out;
}

/** Shortest physical path between two devices by hop count, BFS over links (FR-NET-33). */
export function shortestPath(
  doc: NetworkDocument,
  fromId: string,
  toId: string,
): { deviceIds: string[]; linkIds: string[] } | null {
  if (fromId === toId) return { deviceIds: [fromId], linkIds: [] };
  const adj = new Map<string, { to: string; link: string }[]>();
  for (const l of doc.links) {
    const a = l.endpointA.deviceId;
    const b = l.endpointB.deviceId;
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)?.push({ to: b, link: l.id });
    adj.get(b)?.push({ to: a, link: l.id });
  }
  const prev = new Map<string, { from: string; link: string }>();
  const queue = [fromId];
  const seen = new Set([fromId]);
  while (queue.length) {
    const cur = queue.shift() as string;
    for (const e of adj.get(cur) ?? []) {
      if (seen.has(e.to)) continue;
      seen.add(e.to);
      prev.set(e.to, { from: cur, link: e.link });
      if (e.to === toId) {
        const deviceIds = [toId];
        const linkIds: string[] = [];
        let n = toId;
        while (n !== fromId) {
          const p = prev.get(n) as { from: string; link: string };
          linkIds.unshift(p.link);
          deviceIds.unshift(p.from);
          n = p.from;
        }
        return { deviceIds, linkIds };
      }
      queue.push(e.to);
    }
  }
  return null;
}

export interface DeviceSummary {
  hostname: string;
  role: string;
  model: string;
  mgmtIp: string;
  interfaceCount: number;
  usedCount: number;
}

/** Hover card data (FR-NET-09). */
export function deviceSummary(doc: NetworkDocument, d: Device): DeviceSummary {
  const used = linkedInterfaceIds(doc);
  return {
    hostname: d.hostname,
    role: d.role,
    model: d.model,
    mgmtIp: d.mgmtIp,
    interfaceCount: d.interfaces.length,
    usedCount: d.interfaces.filter((i) => used.has(i.id)).length,
  };
}

export interface LinkEnds {
  link: Link;
  a: { device: Device; iface: Interface };
  b: { device: Device; iface: Interface };
}

/** Resolve both ends of every link; links with dangling references are skipped. */
export function resolveLinks(doc: NetworkDocument): LinkEnds[] {
  const devs = new Map(doc.devices.map((d) => [d.id, d]));
  const out: LinkEnds[] = [];
  for (const link of doc.links) {
    const da = devs.get(link.endpointA.deviceId);
    const db = devs.get(link.endpointB.deviceId);
    const ia = da?.interfaces.find((i) => i.id === link.endpointA.interfaceId);
    const ib = db?.interfaces.find((i) => i.id === link.endpointB.interfaceId);
    if (da && db && ia && ib) out.push({ link, a: { device: da, iface: ia }, b: { device: db, iface: ib } });
  }
  return out;
}

const L2_ONLY_ROLES = new Set(['l2-switch', 'access-point', 'patch-panel']);

/**
 * L3 view filter (FR-NET-30): devices that route or host addresses stay visible;
 * L2-only devices are collapsed into the subnet they serve.
 */
export function isVisibleInLayer(d: Device, layer: ViewLayer): boolean {
  if (layer !== 'l3') return true;
  if (L2_ONLY_ROLES.has(d.role)) return d.interfaces.some((i) => i.ipv4.length > 0 && i.type !== 'vlan');
  return true;
}

/** Label text for a link end in a given layer. */
export function endLabel(
  i: Interface,
  layer: ViewLayer,
  show: { names: boolean; ips: boolean; vlans: boolean },
): string {
  const parts: string[] = [];
  if (show.names || layer === 'l1') parts.push(i.shortName);
  if ((show.ips || layer === 'l3') && i.ipv4[0]) parts.push(`${i.ipv4[0].address}/${i.ipv4[0].prefix}`);
  if (show.vlans || layer === 'l2') {
    if (i.mode === 'access') parts.push(`VLAN ${i.accessVlan ?? 1}`);
    if (i.mode === 'trunk') parts.push(`trunk ${i.allowedVlans || 'all'}`);
  }
  return [...new Set(parts)].join('\n');
}
