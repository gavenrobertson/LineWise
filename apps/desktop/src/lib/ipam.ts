// SPDX-License-Identifier: Apache-2.0
/** IPAM helpers for the UI (FR-NET-06/08). Pure over the document. */
import {
  assignIp,
  batch,
  cidrsOverlap,
  isValidCidr,
  nextP2pSubnet,
  parseCidr,
  upsertSubnet,
  utilization,
  type Command,
  type NetworkDocument,
} from '@linewise/core';

export function assignedAddresses(doc: NetworkDocument): string[] {
  const out: string[] = [];
  for (const d of doc.devices) {
    if (d.mgmtIp) out.push(d.mgmtIp);
    for (const i of d.interfaces) {
      for (const a of i.ipv4) out.push(a.address);
      for (const a of i.ipv6) out.push(a.address);
      if (i.fhrp?.vip) out.push(i.fhrp.vip);
    }
  }
  return out;
}

export function subnetUtilization(doc: NetworkDocument): Map<string, number> {
  const addrs = assignedAddresses(doc);
  const m = new Map<string, number>();
  for (const s of doc.subnets) {
    try {
      m.set(s.id, utilization(s.cidr, s.gatewayIp ? [...addrs, s.gatewayIp] : addrs));
    } catch {
      m.set(s.id, 0);
    }
  }
  return m;
}

/** Pairs of subnets (same VRF) that overlap. */
export function overlappingSubnets(doc: NetworkDocument): Set<string> {
  const bad = new Set<string>();
  const list = doc.subnets.filter((s) => isValidCidr(s.cidr)).map((s) => ({ s, c: parseCidr(s.cidr) }));
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (!a || !b || (a.s.vrfId ?? '') !== (b.s.vrfId ?? '') || a.c.family !== b.c.family) continue;
      if (cidrsOverlap(a.c, b.c)) {
        bad.add(a.s.id);
        bad.add(b.s.id);
      }
    }
  return bad;
}

/**
 * Point-to-point helper (FR-NET-08): take the next free /30 or /31 from a
 * pool, number both ends of the link and record the subnet. One undo step.
 */
export function p2pCommand(
  doc: NetworkDocument,
  linkId: string,
  pool: string,
  prefix: 30 | 31,
): { cmd: Command; cidr: string } {
  const link = doc.links.find((l) => l.id === linkId);
  if (!link) throw new Error('Link not found');
  if (!isValidCidr(pool) || parseCidr(pool).family !== 4)
    throw new Error('Enter an IPv4 pool such as 10.255.0.0/24');
  const taken = doc.subnets.map((s) => s.cidr);
  // Addresses already used inside the pool also block a candidate block.
  for (const a of assignedAddresses(doc)) if (!a.includes(':')) taken.push(`${a}/32`);
  const next = nextP2pSubnet(pool, taken, prefix);
  if (!next) throw new Error(`No free /${prefix} left in ${pool}`);
  const ha = doc.devices.find((d) => d.id === link.endpointA.deviceId)?.hostname ?? '';
  const hb = doc.devices.find((d) => d.id === link.endpointB.deviceId)?.hostname ?? '';
  const cmd = batch('Assign point-to-point subnet', [
    assignIp(link.endpointA.deviceId, link.endpointA.interfaceId, next.a, prefix),
    assignIp(link.endpointB.deviceId, link.endpointB.interfaceId, next.b, prefix),
    upsertSubnet({ cidr: next.cidr, name: `${ha}-${hb}`, description: 'Point-to-point link' }),
  ]);
  return { cmd, cidr: next.cidr };
}
