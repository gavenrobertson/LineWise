// SPDX-License-Identifier: Apache-2.0
/**
 * IPv4/IPv6 subnet math (FR-NET-06, FR-NET-07, FR-NET-08). BigInt-based so
 * IPv4 and IPv6 share one implementation.
 */
import ipaddr from 'ipaddr.js';

export type Family = 4 | 6;

export interface Cidr {
  family: Family;
  /** Network address as BigInt. */
  network: bigint;
  prefix: number;
}

const BITS: Record<Family, number> = { 4: 32, 6: 128 };

export function isValidIp(s: string): boolean {
  return ipaddr.isValid(s.trim());
}

export function ipFamily(s: string): Family {
  return ipaddr.parse(s.trim()).kind() === 'ipv4' ? 4 : 6;
}

export function ipToBigInt(s: string): bigint {
  const bytes = ipaddr.parse(s.trim()).toByteArray();
  return bytes.reduce((acc, b) => (acc << 8n) | BigInt(b), 0n);
}

export function bigIntToIp(n: bigint, family: Family): string {
  const len = family === 4 ? 4 : 16;
  const bytes: number[] = [];
  let v = n;
  for (let i = 0; i < len; i++) {
    bytes.unshift(Number(v & 0xffn));
    v >>= 8n;
  }
  return ipaddr.fromByteArray(bytes).toString();
}

function maskOf(prefix: number, family: Family): bigint {
  const bits = BITS[family];
  if (prefix === 0) return 0n;
  return ((1n << BigInt(prefix)) - 1n) << BigInt(bits - prefix);
}

function allOnes(family: Family): bigint {
  return (1n << BigInt(BITS[family])) - 1n;
}

/** Parse "10.0.0.0/24", "10.0.0.5/24" (host bits allowed, normalized) or "2001:db8::/64". */
export function parseCidr(s: string): Cidr {
  const [addr, pfx] = s.trim().split('/');
  if (!addr || pfx === undefined || !/^\d+$/.test(pfx)) throw new Error(`Invalid CIDR "${s}"`);
  if (!isValidIp(addr)) throw new Error(`Invalid address in "${s}"`);
  const family = ipFamily(addr);
  const prefix = Number(pfx);
  if (prefix > BITS[family]) throw new Error(`Prefix /${prefix} too long in "${s}"`);
  return { family, prefix, network: ipToBigInt(addr) & maskOf(prefix, family) };
}

export function isValidCidr(s: string): boolean {
  try {
    parseCidr(s);
    return true;
  } catch {
    return false;
  }
}

export function cidrToString(c: Cidr): string {
  return `${bigIntToIp(c.network, c.family)}/${c.prefix}`;
}

export function broadcastOf(c: Cidr): bigint {
  return c.network | (allOnes(c.family) ^ maskOf(c.prefix, c.family));
}

export function cidrContains(c: Cidr, ip: string): boolean {
  if (!isValidIp(ip) || ipFamily(ip) !== c.family) return false;
  return (ipToBigInt(ip) & maskOf(c.prefix, c.family)) === c.network;
}

export function cidrsOverlap(a: Cidr, b: Cidr): boolean {
  if (a.family !== b.family) return false;
  return a.network <= broadcastOf(b) && b.network <= broadcastOf(a);
}

export function sameSubnet(ipA: string, prefixA: number, ipB: string, prefixB: number): boolean {
  if (prefixA !== prefixB) return false;
  try {
    const a = parseCidr(`${ipA}/${prefixA}`);
    return cidrContains(a, ipB);
  } catch {
    return false;
  }
}

export interface SubnetInfo {
  cidr: string;
  family: Family;
  network: string;
  broadcast: string | null;
  firstUsable: string | null;
  lastUsable: string | null;
  /** Total addresses in the block. */
  size: bigint;
  /** Assignable host addresses (IPv4 /31 and /32 per RFC 3021; IPv6 all but the subnet-router anycast). */
  hosts: bigint;
  mask: string | null;
  wildcard: string | null;
  prefix: number;
}

/** Subnet calculator (FR-NET-07). */
export function subnetInfo(input: string): SubnetInfo {
  const c = parseCidr(input);
  const bits = BITS[c.family];
  const size = 1n << BigInt(bits - c.prefix);
  const bcast = broadcastOf(c);
  const v4 = c.family === 4;
  let first: bigint | null;
  let last: bigint | null;
  let hosts: bigint;
  if (v4) {
    if (c.prefix >= 31) {
      first = c.network;
      last = bcast;
      hosts = size;
    } else {
      first = c.network + 1n;
      last = bcast - 1n;
      hosts = size - 2n;
    }
  } else {
    first = c.prefix === 128 ? c.network : c.network + 1n;
    last = bcast;
    hosts = c.prefix === 128 ? 1n : size - 1n;
  }
  return {
    cidr: cidrToString(c),
    family: c.family,
    network: bigIntToIp(c.network, c.family),
    broadcast: v4 ? bigIntToIp(bcast, 4) : null,
    firstUsable: first === null ? null : bigIntToIp(first, c.family),
    lastUsable: last === null ? null : bigIntToIp(last, c.family),
    size,
    hosts,
    mask: v4 ? bigIntToIp(maskOf(c.prefix, 4), 4) : null,
    wildcard: v4 ? bigIntToIp(allOnes(4) ^ maskOf(c.prefix, 4), 4) : null,
    prefix: c.prefix,
  };
}

export function prefixToMask(prefix: number): string {
  if (prefix < 0 || prefix > 32) throw new Error(`Invalid IPv4 prefix ${prefix}`);
  return bigIntToIp(maskOf(prefix, 4), 4);
}

/** Dotted mask → prefix length. Throws on non-contiguous masks. */
export function maskToPrefix(mask: string): number {
  if (!isValidIp(mask) || ipFamily(mask) !== 4) throw new Error(`Invalid mask "${mask}"`);
  const n = ipToBigInt(mask);
  let prefix = 0;
  while (prefix < 32 && (n & (1n << BigInt(31 - prefix))) !== 0n) prefix++;
  if (maskOf(prefix, 4) !== n) throw new Error(`Non-contiguous mask "${mask}"`);
  return prefix;
}

/** Split a block into `count` equal subnets (count rounded up to a power of two). */
export function splitEqual(block: string, count: number): string[] {
  const c = parseCidr(block);
  if (count < 1) throw new Error('count must be >= 1');
  const extra = Math.ceil(Math.log2(count));
  const prefix = c.prefix + extra;
  if (prefix > BITS[c.family]) throw new Error(`Cannot split /${c.prefix} into ${count} subnets`);
  const step = 1n << BigInt(BITS[c.family] - prefix);
  const out: string[] = [];
  for (let i = 0; i < count; i++)
    out.push(cidrToString({ family: c.family, prefix, network: c.network + step * BigInt(i) }));
  return out;
}

export interface VlsmRequest {
  name: string;
  hosts: number;
}

/**
 * VLSM: allocate subnets for host counts from a block, largest first.
 * Returns allocations in request order. Throws when the block is too small.
 */
export function vlsm(
  block: string,
  requests: VlsmRequest[],
): { name: string; cidr: string; hosts: number }[] {
  const c = parseCidr(block);
  if (c.family !== 4) throw new Error('VLSM supports IPv4 blocks');
  const order = requests.map((r, i) => ({ ...r, i })).sort((a, b) => b.hosts - a.hosts);
  let cursor = c.network;
  const end = broadcastOf(c);
  const result: { name: string; cidr: string; hosts: number; i: number }[] = [];
  for (const r of order) {
    // Classic VLSM: /30 is the smallest block (2 hosts); use nextP2pSubnet for /31 links.
    let prefix = 30;
    while (prefix > 0 && subnetHostCount(prefix) < r.hosts) prefix--;
    const size = 1n << BigInt(32 - prefix);
    if (cursor % size !== 0n) cursor = (cursor / size + 1n) * size;
    if (cursor + size - 1n > end) throw new Error(`Block ${block} is too small for the requested subnets`);
    result.push({
      name: r.name,
      cidr: cidrToString({ family: 4, prefix, network: cursor }),
      hosts: r.hosts,
      i: r.i,
    });
    cursor += size;
  }
  return result.sort((a, b) => a.i - b.i).map(({ i: _i, ...rest }) => rest);
}

function subnetHostCount(prefix: number): number {
  return 2 ** (32 - prefix) - 2;
}

/**
 * Next free usable address in a subnet, skipping `used` addresses and reserved ranges.
 * Returns null when the subnet is full.
 */
export function nextFreeIp(
  subnet: string,
  used: Iterable<string>,
  reserved: { start: string; end: string }[] = [],
): string | null {
  const info = subnetInfo(subnet);
  if (!info.firstUsable || !info.lastUsable) return null;
  const usedSet = new Set<bigint>();
  for (const u of used) if (isValidIp(u)) usedSet.add(ipToBigInt(u));
  const ranges = reserved
    .filter((r) => isValidIp(r.start) && isValidIp(r.end))
    .map((r) => [ipToBigInt(r.start), ipToBigInt(r.end)] as const);
  const lo = ipToBigInt(info.firstUsable);
  const hi = ipToBigInt(info.lastUsable);
  const limit = 1n << 20n; // scan cap for huge IPv6 subnets
  for (let n = lo, i = 0n; n <= hi && i < limit; n++, i++) {
    if (usedSet.has(n)) continue;
    if (ranges.some(([a, b]) => n >= a && n <= b)) continue;
    return bigIntToIp(n, info.family);
  }
  return null;
}

/** Point-to-point pair from a pool (FR-NET-08): next free /30 (or /31) inside `pool` not overlapping `taken`. */
export function nextP2pSubnet(
  pool: string,
  taken: string[],
  prefix: 30 | 31 = 30,
): { cidr: string; a: string; b: string } | null {
  const p = parseCidr(pool);
  if (p.family !== 4) throw new Error('Point-to-point helper supports IPv4 pools');
  const step = 1n << BigInt(32 - prefix);
  const used = taken.filter(isValidCidr).map(parseCidr);
  for (let n = p.network; n + step - 1n <= broadcastOf(p); n += step) {
    const cand: Cidr = { family: 4, prefix, network: n };
    if (used.some((u) => cidrsOverlap(u, cand))) continue;
    const a = prefix === 31 ? n : n + 1n;
    return { cidr: cidrToString(cand), a: bigIntToIp(a, 4), b: bigIntToIp(a + 1n, 4) };
  }
  return null;
}

/** Utilization of a subnet given assigned addresses: 0..1. */
export function utilization(subnet: string, assigned: Iterable<string>): number {
  const c = parseCidr(subnet);
  const info = subnetInfo(subnet);
  if (info.hosts === 0n) return 0;
  let count = 0n;
  const seen = new Set<string>();
  for (const a of assigned) {
    if (seen.has(a)) continue;
    seen.add(a);
    if (cidrContains(c, a)) count++;
  }
  const ratio = Number((count * 10000n) / info.hosts) / 10000;
  return Math.min(1, ratio);
}

/** Is `ip` the network or broadcast address of the subnet it lives in (IPv4, prefix < 31)? */
export function isNetworkOrBroadcast(ip: string, prefix: number): boolean {
  if (!isValidIp(ip) || ipFamily(ip) !== 4 || prefix >= 31) return false;
  const c = parseCidr(`${ip}/${prefix}`);
  const n = ipToBigInt(ip);
  return n === c.network || n === broadcastOf(c);
}
