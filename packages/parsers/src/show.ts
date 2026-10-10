// SPDX-License-Identifier: Apache-2.0
/**
 * Tabular "show" command parsers (FR-IMP-04): `show ip interface brief`,
 * `show interfaces status`, `show vlan brief`, `show etherchannel summary`
 * (IOS and NX-OS `show port-channel summary`).
 */
import { formatVlanList, normalizeInterfaceName } from '@linewise/core';
import {
  emptyResult,
  type ParseOptions,
  type ParseResult,
  type ParsedDevice,
  type SourceKind,
} from './types.ts';
import { getOrAddInterface, hostnameFromPrompt, speedFromText, splitLines } from './util.ts';

function start(kind: SourceKind, lines: string[], opts: ParseOptions): { r: ParseResult; dev: ParsedDevice } {
  const host = opts.localHostname ?? hostnameFromPrompt(lines) ?? '';
  const r = emptyResult(kind, host || undefined);
  const dev: ParsedDevice = { hostname: host, interfaces: [] };
  if (!host) r.warnings.push('The output has no prompt; choose the device it came from.');
  return { r, dev };
}

const looksLikeInterface = (s: string) => normalizeInterfaceName(s).type !== 'other';

export function parseIpInterfaceBrief(text: string, opts: ParseOptions = {}): ParseResult {
  const lines = splitLines(text);
  const { r, dev } = start('ip-interface-brief', lines, opts);
  lines.forEach((raw, idx) => {
    const l = raw.trim();
    if (!l || /^Interface\s+IP-Address/i.test(l) || /^[\w.-]+[#>]/.test(l)) return;
    const m =
      /^(\S+)\s+(\S+)\s+(?:YES|NO)\s+\S+\s+(administratively down|up|down|deleted)\s+(up|down)/i.exec(l) ??
      /^(\S+)\s+(\S+)\s+protocol-(up|down)\/link-(up|down)\/admin-(up|down)/i.exec(l);
    if (!m || !looksLikeInterface(m[1] ?? '')) {
      r.unparsedLines.push({ line: idx + 1, text: l });
      return;
    }
    const i = getOrAddInterface(dev, m[1] ?? '');
    const status = (m[3] ?? '').toLowerCase();
    i.enabled = !(status === 'administratively down' || m[5]?.toLowerCase() === 'down');
  });
  if (dev.interfaces.length)
    r.warnings.push(
      'Interface brief output has no subnet masks; IP addresses were not imported. Import the running-config for addresses.',
    );
  r.devices = dev.hostname ? [dev] : [];
  if (!dev.hostname && dev.interfaces.length) r.devices = [dev];
  return r;
}

/** Column slicing by header positions (the "Name" column may contain spaces). */
function columns(header: string, names: string[]): number[] {
  return names.map((n) => header.search(new RegExp(`\\b${n}\\b`, 'i')));
}

export function parseInterfacesStatus(text: string, opts: ParseOptions = {}): ParseResult {
  const lines = splitLines(text);
  const { r, dev } = start('interfaces-status', lines, opts);
  const hIdx = lines.findIndex((l) => /^\s*Port\s+Name\s+Status\s+Vlan\s+Duplex\s+Speed/i.test(l));
  if (hIdx < 0) {
    r.warnings.push('Could not find the "Port Name Status Vlan Duplex Speed Type" header.');
    return r;
  }
  const header = lines[hIdx] ?? '';
  const [cPort = 0, cName = 0, cStatus = 0, cVlan = 0, cDuplex = 0, cSpeed = 0, cType = -1] = columns(
    header,
    ['Port', 'Name', 'Status', 'Vlan', 'Duplex', 'Speed', 'Type'],
  );
  for (let idx = hIdx + 1; idx < lines.length; idx++) {
    const raw = lines[idx] ?? '';
    if (!raw.trim() || /^-+/.test(raw.trim()) || /^[\w.-]+[#>]/.test(raw.trim())) continue;
    const port = raw.slice(cPort, cName).trim();
    if (!looksLikeInterface(port)) {
      r.unparsedLines.push({ line: idx + 1, text: raw.trim() });
      continue;
    }
    const i = getOrAddInterface(dev, port);
    const name = raw.slice(cName, cStatus).trim();
    if (name) i.description = name;
    const status = raw.slice(cStatus, cVlan).trim().toLowerCase();
    i.enabled = status !== 'disabled' && status !== 'err-disabled' && status !== 'sfpabsent';
    const vlan = raw.slice(cVlan, cDuplex).trim().toLowerCase();
    if (/^\d+$/.test(vlan)) {
      i.mode = 'access';
      i.accessVlan = Number(vlan);
    } else if (vlan === 'trunk') i.mode = 'trunk';
    else if (vlan === 'routed') i.mode = 'routed';
    const duplex = raw.slice(cDuplex, cSpeed).trim().toLowerCase().replace(/^a-/, '');
    if (duplex === 'full' || duplex === 'half') i.duplex = duplex;
    const speed = speedFromText(raw.slice(cSpeed, cType > 0 ? cType : undefined).trim());
    if (speed) i.speedMbps = speed;
    if (cType > 0) {
      const type = raw.slice(cType).trim();
      if (/sfp|base-?[slez]x|lr|sr|fiber|lx|sx/i.test(type) && !/basetx|base-t|rj45/i.test(type))
        i.media = 'fiber';
      else if (/base-?t|basetx|rj45|10\/100/i.test(type)) i.media = 'copper';
    }
  }
  r.devices = [dev];
  return r;
}

export function parseVlanBrief(text: string, opts: ParseOptions = {}): ParseResult {
  const lines = splitLines(text);
  const { r, dev } = start('vlan-brief', lines, opts);
  let lastVlan: number | undefined;
  const membership = new Map<string, number[]>();
  const assign = (ports: string, vlan: number) => {
    for (const p of ports.split(/[,\s]+/).filter(Boolean)) {
      if (!looksLikeInterface(p)) continue;
      const name = getOrAddInterface(dev, p).name;
      membership.set(name, [...(membership.get(name) ?? []), vlan]);
    }
  };
  lines.forEach((raw, idx) => {
    const l = raw.trimEnd();
    if (
      !l.trim() ||
      /^VLAN\s+Name/i.test(l.trim()) ||
      /^-{3,}/.test(l.trim()) ||
      /^[\w.-]+[#>]/.test(l.trim())
    )
      return;
    const m =
      /^(\d{1,4})\s+(\S+)\s+(active|act\/lshut|sus\/lshut|suspended|act\/unsup|act\/ishut)\s*(.*)$/i.exec(l);
    if (m && (Number(m[1]) < 1 || Number(m[1]) > 4094)) {
      r.unparsedLines.push({ line: idx + 1, text: l.trim() });
      lastVlan = undefined;
      return;
    }
    if (m) {
      const n = Number(m[1]);
      lastVlan = n;
      if (n >= 1002 && n <= 1005) return; // legacy FDDI/Token Ring defaults
      r.vlans.push({ number: n, name: m[2] ?? '' });
      if (m[4]) assign(m[4], n);
      return;
    }
    if (/^\s+\S/.test(l) && lastVlan !== undefined) {
      if (lastVlan < 1002 || lastVlan > 1005) assign(l, lastVlan);
      return;
    }
    r.unparsedLines.push({ line: idx + 1, text: l.trim() });
  });
  // A port listed under several VLANs is a trunk (NX-OS lists trunk members per VLAN).
  for (const [name, vlans] of membership) {
    const i = getOrAddInterface(dev, name);
    if (vlans.length > 1) {
      i.mode = 'trunk';
      i.allowedVlans = formatVlanList(vlans);
    } else {
      i.mode = 'access';
      i.accessVlan = vlans[0] as number;
    }
  }
  r.devices = dev.interfaces.length || dev.hostname ? [dev] : [];
  return r;
}

export function parseEtherchannelSummary(text: string, opts: ParseOptions = {}): ParseResult {
  const lines = splitLines(text);
  const { r, dev } = start('etherchannel-summary', lines, opts);
  lines.forEach((raw, idx) => {
    const l = raw.trim();
    const m = /^(\d+)\s+(Po\d+)\(\w+\)\s+(?:Eth\s+)?(LACP|PAgP|NONE|-)\s+(.*)$/i.exec(l);
    if (!m) {
      if (
        l &&
        !/^(Flags|Group|Number|-|\+|[A-Z] - |\w+ - |[\w.-]+[#>])/i.test(l) &&
        !/^[A-Za-z]\s+-\s/.test(l)
      )
        r.unparsedLines.push({ line: idx + 1, text: l });
      return;
    }
    const number = Number(m[1]);
    const proto = (m[3] ?? '').toUpperCase();
    getOrAddInterface(dev, m[2] ?? `Po${number}`);
    for (const tok of (m[4] ?? '').split(/\s+/).filter(Boolean)) {
      const pm = /^([A-Za-z][\w/.-]*\d)\(\w+\)$/.exec(tok);
      if (!pm) continue;
      const i = getOrAddInterface(dev, pm[1] ?? '');
      i.channelGroup = { number, mode: proto === 'LACP' ? 'lacp-active' : proto === 'PAGP' ? 'pagp' : 'on' };
    }
  });
  r.devices = [dev];
  return r;
}
