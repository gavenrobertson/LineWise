// SPDX-License-Identifier: Apache-2.0
/**
 * CDP and LLDP neighbor parsers (FR-IMP-01, FR-IMP-02). Supports IOS/IOS-XE
 * and NX-OS "detail" output, plus Linux lldpd `lldpctl` output.
 */
import {
  cleanHostname,
  getOrAddInterface,
  hostnameFromPrompt,
  iface,
  roleFromCapabilities,
  splitLines,
} from './util.ts';
import { emptyResult, type ParseOptions, type ParseResult, type ParsedDevice } from './types.ts';

interface Neighbor {
  hostname: string;
  localIface?: string;
  remoteIface?: string;
  ip?: string;
  platform?: string;
  caps?: string;
  version?: string;
  start: number;
}

function finish(
  kind: 'cdp' | 'lldp',
  neighbors: Neighbor[],
  lines: string[],
  opts: ParseOptions,
  consumed: Set<number>,
): ParseResult {
  const local = opts.localHostname ?? hostnameFromPrompt(lines);
  const r = emptyResult(kind, local);
  const devices = new Map<string, ParsedDevice>();
  const getDev = (h: string): ParsedDevice => {
    let d = devices.get(h.toLowerCase());
    if (!d) {
      d = { hostname: h, interfaces: [] };
      devices.set(h.toLowerCase(), d);
    }
    return d;
  };
  if (local) getDev(local);
  for (const n of neighbors) {
    if (!n.hostname) {
      r.warnings.push(`Skipped a neighbor entry near line ${n.start + 1}: no device name.`);
      continue;
    }
    const d = getDev(n.hostname);
    if (n.ip) d.mgmtIp ??= n.ip;
    if (n.platform) {
      d.platform ??= n.platform;
      const model = n.platform.replace(/^cisco\s+/i, '').trim();
      if (kind === 'cdp' && model) d.model ??= model;
      if (/cisco/i.test(n.platform) || /^(WS-|C9|N\dK|ISR|ASR|AIR-|C8)/i.test(model)) d.vendor ??= 'Cisco';
    }
    if (n.version) d.osVersion ??= n.version;
    const role = roleFromCapabilities(n.caps ?? '', n.platform ?? '');
    if (role) d.role ??= role;
    if (n.remoteIface) getOrAddInterface(d, n.remoteIface);
    if (local && n.localIface) {
      getOrAddInterface(getDev(local), n.localIface);
      const link = {
        a: { hostname: local, iface: iface(n.localIface) },
        b: { hostname: n.hostname },
      } as ParseResult['links'][number];
      if (n.remoteIface) link.b.iface = iface(n.remoteIface);
      r.links.push(link);
    }
  }
  if (!local && neighbors.length) {
    r.warnings.push(
      'The output has no prompt, so the local device is unknown. Choose the device it came from to create links.',
    );
  }
  r.devices = [...devices.values()];
  lines.forEach((text, i) => {
    if (text.trim() && !consumed.has(i)) r.unparsedLines.push({ line: i + 1, text: text.trim() });
  });
  return r;
}

const CDP_SEP = /^-{5,}\s*$/;

export function parseCdp(text: string, opts: ParseOptions = {}): ParseResult {
  const lines = splitLines(text);
  const neighbors: Neighbor[] = [];
  const consumed = new Set<number>();
  let cur: Neighbor | undefined;
  let inVersion = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? '';
    const l = raw.trim();
    let m: RegExpExecArray | null;
    if (CDP_SEP.test(l)) {
      consumed.add(i);
      inVersion = false;
      continue;
    }
    if ((m = /^Device ID\s*:\s*(.+)$/i.exec(l))) {
      cur = { hostname: cleanHostname(m[1] ?? ''), start: i };
      neighbors.push(cur);
      inVersion = false;
      consumed.add(i);
      continue;
    }
    if (!cur) {
      if (/^[\w.-]+[#>]/.test(l)) consumed.add(i);
      continue;
    }
    consumed.add(i);
    if ((m = /^System Name\s*:\s*(.+)$/i.exec(l))) cur.hostname = cleanHostname(m[1] ?? '');
    else if ((m = /^(?:IP address|IPv4 Address)\s*:\s*([\d.]+)/i.exec(l))) cur.ip ??= m[1];
    else if ((m = /^Platform\s*:\s*([^,]+?)\s*,\s*Capabilities\s*:\s*(.*)$/i.exec(l))) {
      cur.platform = m[1]?.trim();
      cur.caps = m[2]?.trim();
    } else if ((m = /^Interface\s*:\s*([^,]+?)\s*,\s*Port ID \(outgoing port\)\s*:\s*(.+?)\s*$/i.exec(l))) {
      cur.localIface = m[1]?.trim();
      cur.remoteIface = m[2]?.trim();
    } else if (/^Version\s*:?\s*$/i.test(l)) inVersion = true;
    else if (inVersion && l && !cur.version) {
      const v = /Version\s+([^\s,]+)/i.exec(l);
      if (v) cur.version = v[1];
    } else if (/^$/.test(l)) inVersion = false;
  }
  return finish('cdp', neighbors, lines, opts, consumed);
}

export function parseLldp(text: string, opts: ParseOptions = {}): ParseResult {
  const lines = splitLines(text);
  const neighbors: Neighbor[] = [];
  const consumed = new Set<number>();
  let cur: Neighbor | undefined;
  let pendingLocal: string | undefined;
  let inDesc = false;
  let inMgmt = false;
  const isLldpctl = lines.some((l) => /^Interface:\s+\S+,\s*via:\s*LLDP/i.test(l.trim()));

  for (let i = 0; i < lines.length; i++) {
    const l = (lines[i] ?? '').trim();
    let m: RegExpExecArray | null;
    if (isLldpctl) {
      if ((m = /^Interface:\s+([^,]+),\s*via:\s*LLDP/i.exec(l))) {
        cur = { hostname: '', localIface: m[1]?.trim(), start: i };
        neighbors.push(cur);
        consumed.add(i);
      } else if (cur) {
        consumed.add(i);
        if ((m = /^SysName:\s+(.+)$/i.exec(l))) cur.hostname = cleanHostname(m[1] ?? '');
        else if ((m = /^PortID:\s+(?:ifname|local|mac)?\s*(.+)$/i.exec(l))) cur.remoteIface = m[1]?.trim();
        else if ((m = /^MgmtIP:\s+([\d.]+)/i.exec(l))) cur.ip ??= m[1];
        else if ((m = /^SysDescr:\s+(.+)$/i.exec(l))) cur.platform ??= m[1]?.trim();
        else if ((m = /^Capability:\s+(\w[\w-]*),\s*on/i.exec(l))) cur.caps = `${cur.caps ?? ''} ${m[1]}`;
      } else if (/^-+$/.test(l) || /^LLDP neighbors:/i.test(l)) consumed.add(i);
      continue;
    }

    if (/^-{5,}\s*$/.test(l)) {
      consumed.add(i);
      continue;
    }
    if ((m = /^(?:Local Intf|Local Port id)\s*:\s*(\S+)/i.exec(l))) {
      consumed.add(i);
      if (cur && !cur.localIface) cur.localIface = m[1];
      else {
        pendingLocal = m[1];
        cur = undefined;
      }
      continue;
    }
    if (/^Chassis id\s*:\s*(\S+)/i.test(l)) {
      consumed.add(i);
      cur = { hostname: '', start: i };
      if (pendingLocal) cur.localIface = pendingLocal;
      pendingLocal = undefined;
      neighbors.push(cur);
      inDesc = inMgmt = false;
      continue;
    }
    if (!cur) {
      if (/^[\w.-]+[#>]/.test(l) || /^Capability codes/i.test(l)) consumed.add(i);
      continue;
    }
    consumed.add(i);
    if ((m = /^Port id\s*:\s*(\S+)/i.exec(l))) cur.remoteIface = m[1];
    else if ((m = /^System Name\s*:\s*(.+)$/i.exec(l))) cur.hostname = cleanHostname(m[1] ?? '');
    else if (/^System Description\s*:?\s*$/i.test(l)) inDesc = true;
    else if ((m = /^System Description\s*:\s*(.+)$/i.exec(l))) cur.platform ??= m[1]?.trim();
    else if ((m = /^(?:System|Enabled) Capabilities\s*:\s*(.+)$/i.exec(l))) cur.caps = m[1];
    else if (/^Management Addresses\s*:?\s*$/i.test(l)) inMgmt = true;
    else if ((m = /^(?:IP|IPv4|Management Address)\s*:\s*([\d.]+)/i.exec(l))) {
      if (inMgmt || /^Management Address/i.test(l)) cur.ip ??= m[1];
    } else if (inDesc && l) {
      cur.platform ??= l;
      const v = /Version\s+([^\s,]+)/i.exec(l);
      if (v) cur.version ??= v[1];
      inDesc = false;
    } else if (!l) inDesc = inMgmt = false;
  }
  return finish('lldp', neighbors, lines, opts, consumed);
}
