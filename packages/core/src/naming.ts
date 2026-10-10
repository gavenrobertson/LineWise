// SPDX-License-Identifier: Apache-2.0
/**
 * Interface name normalization and abbreviation (FR-NET-03), interface range
 * syntax (FR-NET-02) and VLAN list parsing. Vendor-pluggable: register extra
 * naming schemes with `registerNamingScheme`.
 */
import type { InterfaceType } from './schema.ts';

export interface InterfaceKind {
  full: string;
  short: string;
  type: InterfaceType;
  /** Lower-case aliases accepted on input (the full and short names are always accepted). */
  aliases: string[];
  speedMbps?: number;
  media?: 'copper' | 'fiber' | 'any';
}

const CISCO: InterfaceKind[] = [
  {
    full: 'HundredGigE',
    short: 'Hu',
    type: 'hundredgige',
    aliases: ['hundredgigabitethernet', 'hundredgig', 'hu'],
    speedMbps: 100000,
    media: 'fiber',
  },
  {
    full: 'FortyGigabitEthernet',
    short: 'Fo',
    type: 'fortygigabitethernet',
    aliases: ['fortygige', 'fortygig', 'fo'],
    speedMbps: 40000,
    media: 'fiber',
  },
  {
    full: 'TwentyFiveGigE',
    short: 'Twe',
    type: 'twentyfivegige',
    aliases: ['twentyfivegigabitethernet', 'twe'],
    speedMbps: 25000,
    media: 'fiber',
  },
  {
    full: 'TenGigabitEthernet',
    short: 'Te',
    type: 'tengigabitethernet',
    aliases: ['tengige', 'tengig', 'ten', 'te', 't'],
    speedMbps: 10000,
  },
  {
    full: 'GigabitEthernet',
    short: 'Gi',
    type: 'gigabitethernet',
    aliases: ['gige', 'gig', 'gigabit', 'gi', 'g'],
    speedMbps: 1000,
  },
  {
    full: 'FastEthernet',
    short: 'Fa',
    type: 'fastethernet',
    aliases: ['fastether', 'fast', 'fa', 'f'],
    speedMbps: 100,
    media: 'copper',
  },
  { full: 'Ethernet', short: 'Eth', type: 'ethernet', aliases: ['eth', 'et', 'e'] },
  { full: 'Port-channel', short: 'Po', type: 'port-channel', aliases: ['port-channel', 'portchannel', 'po'] },
  { full: 'Loopback', short: 'Lo', type: 'loopback', aliases: ['loopback', 'lo', 'l'] },
  { full: 'Vlan', short: 'Vl', type: 'vlan', aliases: ['vlan', 'vl', 'v'] },
  { full: 'Tunnel', short: 'Tu', type: 'tunnel', aliases: ['tunnel', 'tu'] },
  { full: 'Serial', short: 'Se', type: 'serial', aliases: ['serial', 'se', 's'], media: 'copper' },
  { full: 'mgmt', short: 'mgmt', type: 'management', aliases: ['mgmt', 'management', 'ma'] },
  { full: 'Dot11Radio', short: 'Do', type: 'wireless', aliases: ['dot11radio', 'do'] },
];

const schemes = new Map<string, InterfaceKind[]>([['cisco', CISCO]]);

export function registerNamingScheme(vendor: string, kinds: InterfaceKind[]): void {
  schemes.set(vendor.toLowerCase(), kinds);
}

export interface NormalizedName {
  name: string;
  shortName: string;
  type: InterfaceType;
  /** Numbering part, e.g. "1/0/24". */
  id: string;
  dot1q?: number;
  speedMbps?: number;
  media: 'copper' | 'fiber' | 'any';
}

const NAME_RE = /^\s*([A-Za-z][A-Za-z-]*?)\s*([0-9][0-9/:.]*)\s*$/;

function lookupKind(prefix: string, vendor: string): InterfaceKind | undefined {
  const kinds = schemes.get(vendor.toLowerCase()) ?? CISCO;
  const p = prefix.toLowerCase();
  // Only exact names and known aliases: guessing from prefixes turns "port1" into Port-channel1.
  return (
    kinds.find((k) => k.full.toLowerCase() === p || k.short.toLowerCase() === p) ??
    kinds.find((k) => k.aliases.includes(p))
  );
}

/** Normalize any common spelling ("gi0/1", "G0/1", "GigabitEthernet0/1.10") to canonical form. */
export function normalizeInterfaceName(input: string, vendor = 'cisco'): NormalizedName {
  // Linux/host names ("eth0", "eth1.10") are real names, not Cisco abbreviations.
  const linux = /^\s*(eth\d+)(?:\.(\d+))?\s*$/.exec(input);
  if (linux) {
    const name = input.trim();
    const out: NormalizedName = {
      name,
      shortName: name,
      type: linux[2] ? 'subinterface' : 'ethernet',
      id: linux[1]?.slice(3) ?? '',
      media: 'any',
    };
    if (linux[2]) out.dot1q = Number(linux[2]);
    return out;
  }
  const m = NAME_RE.exec(input);
  if (!m) {
    const name = input.trim();
    return { name, shortName: name, type: 'other', id: '', media: 'any' };
  }
  const [, prefix = '', rest = ''] = m;
  let id = rest;
  let dot1q: number | undefined;
  const dot = rest.indexOf('.');
  if (dot >= 0) {
    id = rest.slice(0, dot);
    const tag = Number(rest.slice(dot + 1));
    if (Number.isInteger(tag) && tag > 0) dot1q = tag;
  }
  const kind = lookupKind(prefix, vendor);
  if (!kind) {
    const name = input.trim();
    return { name, shortName: name, type: 'other', id, media: 'any' };
  }
  const suffix = dot1q !== undefined ? `${id}.${dot1q}` : id;
  const out: NormalizedName = {
    name: `${kind.full}${suffix}`,
    shortName: `${kind.short}${suffix}`,
    type: dot1q !== undefined ? 'subinterface' : kind.type,
    id,
    media: kind.media ?? 'any',
  };
  if (dot1q !== undefined) out.dot1q = dot1q;
  if (kind.speedMbps !== undefined) out.speedMbps = kind.speedMbps;
  return out;
}

export function abbreviateInterfaceName(input: string, vendor = 'cisco'): string {
  return normalizeInterfaceName(input, vendor).shortName;
}

/** True when two spellings refer to the same interface ("Gi0/1" ≡ "GigabitEthernet0/1"). */
export function sameInterfaceName(a: string, b: string, vendor = 'cisco'): boolean {
  return (
    normalizeInterfaceName(a, vendor).name.toLowerCase() ===
    normalizeInterfaceName(b, vendor).name.toLowerCase()
  );
}

const MAX_RANGE = 4096;

/**
 * Expand interface range syntax: "Gi1/0/1-24", "Gi1/0/1 - 4, Te1/1/1-2".
 * The range applies to the last number. Returns canonical full names.
 */
export function expandInterfaceRange(spec: string, vendor = 'cisco'): string[] {
  const out: string[] = [];
  for (const raw of spec.split(',')) {
    const part = raw.trim();
    if (!part) continue;
    const m = /^(.*?)(\d+)\s*-\s*(\d+)$/.exec(part);
    if (!m) {
      out.push(normalizeInterfaceName(part, vendor).name);
      continue;
    }
    const [, head = '', fromS = '', toS = ''] = m;
    const from = Number(fromS);
    const to = Number(toS);
    if (to < from) throw new Error(`Invalid range "${part}": end is before start`);
    if (to - from + 1 + out.length > MAX_RANGE) throw new Error(`Range "${part}" is too large`);
    for (let i = from; i <= to; i++) out.push(normalizeInterfaceName(`${head.trim()}${i}`, vendor).name);
  }
  return out;
}

/** Natural sort key for interface names so Gi1/0/2 sorts before Gi1/0/10. */
export function compareInterfaceNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/** Parse a VLAN list ("1-10,20, 30-32") into a sorted array of unique VLAN IDs. Throws on invalid input. */
export function parseVlanList(spec: string): number[] {
  const set = new Set<number>();
  const s = spec.trim();
  if (!s) return [];
  if (/^all$/i.test(s)) {
    for (let i = 1; i <= 4094; i++) set.add(i);
    return [...set];
  }
  for (const raw of s.split(',')) {
    const part = raw.trim();
    if (!part) continue;
    const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);
    if (!m) throw new Error(`Invalid VLAN list item "${part}"`);
    const from = Number(m[1]);
    const to = m[2] !== undefined ? Number(m[2]) : from;
    if (from < 1 || to > 4094 || to < from) throw new Error(`Invalid VLAN range "${part}"`);
    for (let i = from; i <= to; i++) set.add(i);
  }
  return [...set].sort((x, y) => x - y);
}

/** Format VLAN IDs as a compact Cisco-style list: [1,2,3,5] → "1-3,5". */
export function formatVlanList(vlans: Iterable<number>): string {
  const sorted = [...new Set(vlans)].sort((x, y) => x - y);
  const parts: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    const start = sorted[i] as number;
    let end = start;
    while (i + 1 < sorted.length && sorted[i + 1] === end + 1) end = sorted[++i] as number;
    parts.push(start === end ? `${start}` : `${start}-${end}`);
    i++;
  }
  return parts.join(',');
}
