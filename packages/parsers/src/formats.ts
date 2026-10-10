// SPDX-License-Identifier: Apache-2.0
/**
 * File-format importers: CSV with column mapping (FR-IMP-05), draw.io
 * (FR-IMP-06), GNS3 (FR-IMP-07), Containerlab (FR-IMP-08) and Nmap XML
 * (FR-IMP-09). All tolerant: problems become warnings, never exceptions.
 */
import { inflateSync, strFromU8 } from 'fflate';
import { parse as parseYaml } from 'yaml';
import type { DeviceRole } from '@linewise/core';
import { DEVICE_ROLES, normalizeInterfaceName } from '@linewise/core';
import {
  emptyResult,
  type ParseOptions,
  type ParseResult,
  type ParsedDevice,
  type ParsedLink,
} from './types.ts';
import { getOrAddInterface, parsePrefix, splitLines } from './util.ts';

// ------------------------------------------------------------------ CSV

/** RFC 4180-ish CSV tokenizer: quoted fields, doubled quotes, CRLF, BOM. */
export function parseCsvRows(text: string): string[][] {
  const s = text.replace(/^\uFEFF/, '');
  splitLines(s); // size guard
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ',' || c === ';' || c === '\t') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows.map((r) => r.map((f) => f.trim()));
}

export type CsvField =
  | 'hostname'
  | 'role'
  | 'vendor'
  | 'model'
  | 'mgmtIp'
  | 'site'
  | 'serial'
  | 'interface'
  | 'description'
  | 'ip'
  | 'prefix'
  | 'vlan'
  | 'mode'
  | 'deviceA'
  | 'interfaceA'
  | 'deviceB'
  | 'interfaceB'
  | 'medium'
  | 'label'
  | 'ignore';

export const CSV_FIELDS: CsvField[] = [
  'hostname',
  'role',
  'vendor',
  'model',
  'mgmtIp',
  'site',
  'serial',
  'interface',
  'description',
  'ip',
  'prefix',
  'vlan',
  'mode',
  'deviceA',
  'interfaceA',
  'deviceB',
  'interfaceB',
  'medium',
  'label',
  'ignore',
];

const HEADER_ALIASES: Record<Exclude<CsvField, 'ignore'>, RegExp> = {
  hostname: /^(host ?name|device|name|device name|node)$/i,
  role: /^(role|type|device type|kind)$/i,
  vendor: /^(vendor|manufacturer|make)$/i,
  model: /^(model|platform|hardware)$/i,
  mgmtIp: /^(mgmt ?ip|management ?ip|management address|mgmt address|ip address|primary ip)$/i,
  site: /^(site|location)$/i,
  serial: /^(serial|serial number|sn)$/i,
  interface: /^(interface|port|ifname)$/i,
  description: /^(description|desc)$/i,
  ip: /^(ip|address|ipv4|interface ip)$/i,
  prefix: /^(prefix|mask|netmask|subnet mask|cidr)$/i,
  vlan: /^(vlan|access vlan)$/i,
  mode: /^(mode|switchport mode)$/i,
  deviceA: /^(device ?a|a device|from|source|local device|host ?a)$/i,
  interfaceA: /^(interface ?a|port ?a|a interface|from port|local interface|local port)$/i,
  deviceB: /^(device ?b|b device|to|target|remote device|host ?b|neighbor)$/i,
  interfaceB: /^(interface ?b|port ?b|b interface|to port|remote interface|remote port)$/i,
  medium: /^(medium|media|cable|cable type)$/i,
  label: /^(label|circuit|bandwidth)$/i,
};

/** Suggest a column mapping from header names (the import dialog lets the user change it). */
export function guessCsvMapping(header: string[]): CsvField[] {
  const used = new Set<CsvField>();
  return header.map((h) => {
    const hit = (Object.keys(HEADER_ALIASES) as Exclude<CsvField, 'ignore'>[]).find(
      (f) => !used.has(f) && HEADER_ALIASES[f].test(h.trim()),
    );
    if (hit) used.add(hit);
    return hit ?? 'ignore';
  });
}

function toRole(s: string): DeviceRole | undefined {
  const t = s.trim().toLowerCase().replace(/\s+/g, '-');
  if ((DEVICE_ROLES as readonly string[]).includes(t)) return t as DeviceRole;
  if (/^(sw|switch|l2)/.test(t)) return /l3|multilayer|core|distribution/.test(t) ? 'l3-switch' : 'l2-switch';
  if (/router|^rtr/.test(t)) return 'router';
  if (/firewall|^fw|asa/.test(t)) return 'firewall';
  if (/^ap$|access-point|wap/.test(t)) return 'access-point';
  if (/server|host/.test(t)) return 'server';
  return undefined;
}

export function parseCsv(text: string, opts: ParseOptions & { mapping?: CsvField[] } = {}): ParseResult {
  const r = emptyResult('csv');
  const rows = parseCsvRows(text);
  const [header, ...data] = rows;
  if (!header) {
    r.warnings.push('The CSV file is empty.');
    return r;
  }
  const map = opts.mapping ?? guessCsvMapping(header);
  const col = (f: CsvField) => map.indexOf(f);
  const devices = new Map<string, ParsedDevice>();
  const getDev = (h: string) => {
    let d = devices.get(h.toLowerCase());
    if (!d) {
      d = { hostname: h, interfaces: [] };
      devices.set(h.toLowerCase(), d);
    }
    return d;
  };
  const isLinks = col('deviceA') >= 0 && col('deviceB') >= 0;
  data.forEach((row, n) => {
    const get = (f: CsvField) => {
      const i = col(f);
      return i >= 0 ? (row[i] ?? '').trim() : '';
    };
    if (isLinks) {
      const a = get('deviceA');
      const b = get('deviceB');
      if (!a || !b) {
        r.unparsedLines.push({ line: n + 2, text: row.join(',') });
        return;
      }
      const ia = get('interfaceA');
      const ib = get('interfaceB');
      if (ia) getOrAddInterface(getDev(a), ia);
      else getDev(a);
      if (ib) getOrAddInterface(getDev(b), ib);
      else getDev(b);
      const link: ParsedLink = { a: { hostname: a }, b: { hostname: b } };
      if (ia) link.a.iface = ia;
      if (ib) link.b.iface = ib;
      const medium = get('medium').toLowerCase();
      if (/fiber|fibre|sfp/.test(medium)) link.medium = medium.includes('mm') ? 'fiber-mm' : 'fiber-sm';
      else if (/serial/.test(medium)) link.medium = 'serial';
      else if (/wireless|wifi/.test(medium)) link.medium = 'wireless';
      if (get('label')) link.label = get('label');
      r.links.push(link);
      return;
    }
    const host = get('hostname');
    if (!host) {
      r.unparsedLines.push({ line: n + 2, text: row.join(',') });
      return;
    }
    const d = getDev(host);
    const role = toRole(get('role'));
    if (role) d.role = role;
    if (get('vendor')) d.vendor = get('vendor');
    if (get('model')) d.model = get('model');
    if (get('serial')) d.serial = get('serial');
    if (get('site')) d.site = get('site');
    if (get('mgmtIp') && !get('interface')) d.mgmtIp = get('mgmtIp');
    const ifn = get('interface');
    if (ifn) {
      const i = getOrAddInterface(d, ifn);
      if (get('description')) i.description = get('description');
      const ipRaw = get('ip') || (get('interface') ? get('mgmtIp') : '');
      if (ipRaw) {
        const [addr, pfx] = ipRaw.split('/');
        const prefix = parsePrefix(pfx ?? get('prefix'));
        if (addr && prefix !== undefined) (i.ipv4 ??= []).push({ address: addr, prefix });
        else r.warnings.push(`Row ${n + 2}: address ${ipRaw} has no prefix or mask; skipped.`);
      }
      const vlan = Number(get('vlan'));
      const mode = get('mode').toLowerCase();
      if (mode === 'trunk') i.mode = 'trunk';
      else if (mode === 'routed') i.mode = 'routed';
      if (Number.isInteger(vlan) && vlan > 0 && vlan < 4095) {
        i.accessVlan = vlan;
        i.mode ??= 'access';
      }
    }
  });
  r.devices = [...devices.values()];
  return r;
}

// ------------------------------------------------------------------ minimal XML scanning

function decodeXml(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) out[m[1] ?? ''] = decodeXml(m[2] ?? '');
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*'([^']*)'/g)) out[m[1] ?? ''] ??= decodeXml(m[2] ?? '');
  return out;
}

function stripHtml(s: string): string {
  return decodeXml(s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).trim();
}

// ------------------------------------------------------------------ draw.io

const DRAWIO_ROLE: [RegExp, DeviceRole][] = [
  [/layer_?3_switch|multilayer|l3_switch|routing_switch/i, 'l3-switch'],
  [/firewall|asa/i, 'firewall'],
  [/router/i, 'router'],
  [/wireless_lan_controller|wlc/i, 'wlc'],
  [/access_point|wireless_router|\bap\b/i, 'access-point'],
  [/switch/i, 'l2-switch'],
  [/load_balancer|loadbalancer/i, 'load-balancer'],
  [/server|mainframe/i, 'server'],
  [/storage|nas|database/i, 'storage'],
  [/laptop/i, 'laptop'],
  [/pc|workstation|desktop/i, 'workstation'],
  [/phone/i, 'ip-phone'],
  [/printer/i, 'printer'],
  [/internet|globe/i, 'internet'],
  [/cloud/i, 'cloud'],
  [/modem/i, 'modem'],
];

function inflateDiagram(content: string): string {
  const raw = content.trim();
  if (raw.startsWith('<')) return raw;
  const bin = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  const xml = strFromU8(inflateSync(bin));
  try {
    return decodeURIComponent(xml);
  } catch {
    return xml;
  }
}

export function parseDrawio(text: string): ParseResult {
  const r = emptyResult('drawio');
  splitLines(text);
  let xml = text;
  const diag = /<diagram\b[^>]*>([\s\S]*?)<\/diagram>/i.exec(text);
  if (diag && !/<mxGraphModel/i.test(diag[1] ?? '')) {
    try {
      xml = inflateDiagram(diag[1] ?? '');
    } catch {
      r.warnings.push('Could not decompress the draw.io diagram.');
      return r;
    }
  }
  if (/<diagram\b/i.test(text) && (text.match(/<diagram\b/gi)?.length ?? 0) > 1)
    r.warnings.push('Only the first page of the draw.io file was imported.');
  const cells: { a: Record<string, string>; geo: Record<string, string> }[] = [];
  const re =
    /<(?:object|UserObject)\b([^>]*)>\s*<mxCell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/mxCell>)\s*<\/(?:object|UserObject)>|<mxCell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/mxCell>)/gi;
  for (const m of xml.matchAll(re)) {
    const wrapper = m[1] ? attrs(m[1]) : {};
    const a = {
      ...attrs(m[2] ?? m[4] ?? ''),
      ...(m[1] ? { id: wrapper.id ?? '', value: wrapper.label ?? '' } : {}),
    };
    const inner = m[3] ?? m[5] ?? '';
    const g = /<mxGeometry\b([^>]*)/i.exec(inner);
    cells.push({ a, geo: g ? attrs(g[1] ?? '') : {} });
  }
  const devById = new Map<string, ParsedDevice>();
  const names = new Map<string, number>();
  for (const { a, geo } of cells) {
    if (a.vertex !== '1') continue;
    const style = a.style ?? '';
    const label = stripHtml(a.value ?? '');
    const role = DRAWIO_ROLE.find(([re]) => re.test(style))?.[1];
    const x = Number(geo.x ?? 0);
    const y = Number(geo.y ?? 0);
    const w = Number(geo.width ?? 80);
    const h = Number(geo.height ?? 40);
    if (role) {
      let host = (label.split('\n')[0] ?? '').trim() || role.toUpperCase();
      const n = (names.get(host.toLowerCase()) ?? 0) + 1;
      names.set(host.toLowerCase(), n);
      if (n > 1) host = `${host}-${n}`;
      const d: ParsedDevice = {
        hostname: host,
        role,
        interfaces: [],
        position: { x: x + w / 2, y: y + h / 2 },
      };
      devById.set(a.id ?? '', d);
      r.devices.push(d);
    } else if (label) {
      r.annotations.push({ text: label, x, y, w, h });
    }
  }
  for (const { a } of cells) {
    if (a.edge !== '1') continue;
    const s = devById.get(a.source ?? '');
    const t = devById.get(a.target ?? '');
    if (!s || !t) continue;
    const link: ParsedLink = { a: { hostname: s.hostname }, b: { hostname: t.hostname } };
    const label = stripHtml(a.value ?? '');
    const ends = /^(\S+)\s*[-–—]\s*(\S+)$/.exec(label);
    if (
      ends &&
      normalizeInterfaceName(ends[1] ?? '').type !== 'other' &&
      normalizeInterfaceName(ends[2] ?? '').type !== 'other'
    ) {
      link.a.iface = normalizeInterfaceName(ends[1] ?? '').name;
      link.b.iface = normalizeInterfaceName(ends[2] ?? '').name;
      getOrAddInterface(s, link.a.iface);
      getOrAddInterface(t, link.b.iface);
    } else if (label) link.label = label;
    if (/dashed=1/.test(a.style ?? '')) link.medium = 'wireless';
    r.links.push(link);
  }
  if (!r.devices.length)
    r.warnings.push('No network shapes were recognized; shapes were imported as annotations.');
  return r;
}

// ------------------------------------------------------------------ GNS3

interface Gns3Node {
  node_id: string;
  name: string;
  node_type?: string;
  symbol?: string;
  x?: number;
  y?: number;
  ports?: { name: string; adapter_number: number; port_number: number }[];
}

function gns3Role(n: Gns3Node): DeviceRole {
  const t = `${n.node_type ?? ''} ${n.symbol ?? ''} ${n.name}`.toLowerCase();
  if (/ethernet_switch|ethernet_hub|switch/.test(t))
    return /multilayer|l3/.test(t) ? 'l3-switch' : 'l2-switch';
  if (/firewall|asa/.test(t)) return 'firewall';
  if (/\bnat\b/.test(t)) return 'internet';
  if (/cloud/.test(t)) return 'cloud';
  if (/vpcs|computer|pc|workstation/.test(t)) return 'workstation';
  if (/server|docker/.test(t)) return 'server';
  return 'router';
}

export function parseGns3(text: string): ParseResult {
  const r = emptyResult('gns3');
  splitLines(text);
  let j: {
    topology?: {
      nodes?: Gns3Node[];
      links?: {
        nodes?: { node_id: string; adapter_number: number; port_number: number; label?: { text?: string } }[];
      }[];
    };
  };
  try {
    j = JSON.parse(text);
  } catch {
    r.warnings.push('The GNS3 project is not valid JSON.');
    return r;
  }
  const nodes = j.topology?.nodes ?? [];
  const byId = new Map<string, { node: Gns3Node; dev: ParsedDevice }>();
  for (const n of nodes) {
    const dev: ParsedDevice = {
      hostname: n.name,
      role: gns3Role(n),
      interfaces: [],
      position: { x: n.x ?? 0, y: n.y ?? 0 },
    };
    for (const p of n.ports ?? []) getOrAddInterface(dev, p.name);
    byId.set(n.node_id, { node: n, dev });
    r.devices.push(dev);
  }
  for (const l of j.topology?.links ?? []) {
    const [a, b] = l.nodes ?? [];
    const na = a && byId.get(a.node_id);
    const nb = b && byId.get(b.node_id);
    if (!a || !b || !na || !nb) continue;
    const portName = (end: typeof a, info: { node: Gns3Node; dev: ParsedDevice }) =>
      info.node.ports?.find(
        (p) => p.adapter_number === end.adapter_number && p.port_number === end.port_number,
      )?.name ??
      end.label?.text ??
      `Ethernet${end.adapter_number}/${end.port_number}`;
    const ia = portName(a, na);
    const ib = portName(b, nb);
    getOrAddInterface(na.dev, ia);
    getOrAddInterface(nb.dev, ib);
    r.links.push({
      a: { hostname: na.dev.hostname, iface: ia },
      b: { hostname: nb.dev.hostname, iface: ib },
    });
  }
  return r;
}

// ------------------------------------------------------------------ Containerlab

function clabRole(kind: string, image = ''): DeviceRole {
  const k = `${kind} ${image}`.toLowerCase();
  if (/bridge|ovs/.test(k)) return 'l2-switch';
  if (/srl|ceos|nxos|cvx|sonic|cumulus|eos|n9kv|vr-n9kv/.test(k)) return 'l3-switch';
  if (/linux|alpine|host|ubuntu|debian/.test(k)) return 'server';
  if (/fortinet|paloalto|pan|asav|ftdv|srx/.test(k)) return 'firewall';
  return 'router';
}

export function parseContainerlab(text: string): ParseResult {
  const r = emptyResult('containerlab');
  splitLines(text);
  let y: {
    name?: string;
    topology?: {
      nodes?: Record<string, { kind?: string; image?: string; 'mgmt-ipv4'?: string }>;
      links?: { endpoints?: string[] }[];
    };
  };
  try {
    y = parseYaml(text, { maxAliasCount: 50 }) as typeof y;
  } catch (e) {
    r.warnings.push(`The Containerlab file is not valid YAML: ${(e as Error).message}`);
    return r;
  }
  const nodes = y?.topology?.nodes ?? {};
  const devs = new Map<string, ParsedDevice>();
  for (const [name, n] of Object.entries(nodes)) {
    const d: ParsedDevice = { hostname: name, role: clabRole(n?.kind ?? '', n?.image ?? ''), interfaces: [] };
    if (n?.image) d.platform = n.image;
    if (n?.['mgmt-ipv4']) d.mgmtIp = n['mgmt-ipv4'];
    devs.set(name, d);
    r.devices.push(d);
  }
  for (const l of y?.topology?.links ?? []) {
    const [a, b] = l.endpoints ?? [];
    const [ha, ia] = (a ?? '').split(':');
    const [hb, ib] = (b ?? '').split(':');
    if (!ha || !hb || !ia || !ib) {
      r.warnings.push(`Skipped link with endpoints ${JSON.stringify(l.endpoints)}.`);
      continue;
    }
    for (const [h, i] of [
      [ha, ia],
      [hb, ib],
    ] as const) {
      let d = devs.get(h);
      if (!d) {
        d = { hostname: h, role: h === 'host' ? 'server' : 'generic', interfaces: [] };
        devs.set(h, d);
        r.devices.push(d);
      }
      if (!d.interfaces.some((x) => x.name === i)) d.interfaces.push({ name: i });
    }
    r.links.push({ a: { hostname: ha, iface: ia }, b: { hostname: hb, iface: ib }, medium: 'virtual' });
  }
  return r;
}

// ------------------------------------------------------------------ Nmap

export function parseNmapXml(text: string): ParseResult {
  const r = emptyResult('nmap');
  splitLines(text);
  for (const m of text.matchAll(/<host\b[\s\S]*?<\/host>/gi)) {
    const h = m[0];
    if (/<status\b[^>]*state="down"/i.test(h)) continue;
    const ip =
      /<address\b[^>]*addr="([^"]+)"[^>]*addrtype="ipv4"/i.exec(h)?.[1] ??
      /<address\b[^>]*addrtype="ipv4"[^>]*addr="([^"]+)"/i.exec(h)?.[1];
    if (!ip) continue;
    const name = /<hostname\b[^>]*name="([^"]+)"/i.exec(h)?.[1];
    const os = decodeXml(/<osmatch\b[^>]*name="([^"]+)"/i.exec(h)?.[1] ?? '');
    const vendor = /<address\b[^>]*addrtype="mac"[^>]*vendor="([^"]+)"/i.exec(h)?.[1];
    const o = os.toLowerCase();
    const role: DeviceRole = /router|ios(?! x)|routeros/.test(o)
      ? 'router'
      : /switch/.test(o)
        ? 'l2-switch'
        : /printer|jetdirect/.test(o)
          ? 'printer'
          : /firewall|fortios|pan-os|asa/.test(o)
            ? 'firewall'
            : /phone|voip/.test(o)
              ? 'ip-phone'
              : /windows (10|11|7|xp)|mac os/.test(o)
                ? 'workstation'
                : /linux|windows server|bsd/.test(o)
                  ? 'server'
                  : 'generic';
    const d: ParsedDevice = {
      hostname: name ? (name.split('.')[0] ?? name) : ip,
      role,
      mgmtIp: ip,
      interfaces: [],
    };
    if (os) d.platform = os;
    if (vendor) d.vendor = vendor;
    r.devices.push(d);
  }
  if (!r.devices.length) r.warnings.push('No hosts that were up were found in the Nmap XML.');
  return r;
}
