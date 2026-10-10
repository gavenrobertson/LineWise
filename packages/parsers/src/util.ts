// SPDX-License-Identifier: Apache-2.0
import { isValidIp, maskToPrefix, normalizeInterfaceName, type DeviceRole } from '@linewise/core';
import { MAX_INPUT_BYTES, type ParsedDevice, type ParsedInterface } from './types.ts';

export function splitLines(text: string): string[] {
  if (text.length > MAX_INPUT_BYTES) throw new Error('Input is too large to import (limit 20 MB).');
  return text.replace(/\r\n?/g, '\n').split('\n');
}

/** Device name as seen in CDP/LLDP: drop serial suffixes "(FOC123)" and the DNS domain. */
export function cleanHostname(raw: string): string {
  let h = raw.trim().replace(/\s*\(.*\)\s*$/, '');
  if (!isValidIp(h) && h.includes('.')) h = h.split('.')[0] ?? h;
  return h;
}

/** Hostname from a CLI prompt line, e.g. "R1#show cdp neighbors detail" or "sw1(config)#". */
export function hostnameFromPrompt(lines: string[]): string | undefined {
  for (const l of lines.slice(0, 50)) {
    const m = /^([A-Za-z0-9][A-Za-z0-9._-]{0,62})(?:\([^)]*\))?[#>]\s*(?:sh|show|term|$)/.exec(l.trim());
    if (m?.[1]) return m[1];
  }
  return undefined;
}

export function iface(name: string): string {
  return normalizeInterfaceName(name).name;
}

export function getOrAddInterface(dev: ParsedDevice, name: string): ParsedInterface {
  const n = iface(name);
  let i = dev.interfaces.find((x) => x.name.toLowerCase() === n.toLowerCase());
  if (!i) {
    i = { name: n };
    dev.interfaces.push(i);
  }
  return i;
}

/** Role guess from CDP capability words or LLDP capability codes. */
export function roleFromCapabilities(caps: string, platform = ''): DeviceRole | undefined {
  const c = caps.toLowerCase().replace(/source-route-bridge/g, '');
  const p = platform.toLowerCase();
  const router = /\brouter\b|\br\b/.test(c);
  const sw = /\bswitch\b|(^|[\s,])bridge\b|\bb\b/.test(c.replace(/trans-bridge/g, ''));
  if (/phone|\bt\b/.test(c)) return 'ip-phone';
  if (/trans-bridge|wlan|\bw\b/.test(c) || /\bair-|\bap\b|c91\d\dax/.test(p)) return 'access-point';
  if (router && sw) return 'l3-switch';
  if (router) return /asa|firepower|ftd|fortigate|palo|srx/.test(p) ? 'firewall' : 'router';
  if (sw) return 'l2-switch';
  if (/\bhost\b|station|\bs\b/.test(c)) return 'server';
  return undefined;
}

export function parsePrefix(maskOrPrefix: string): number | undefined {
  const s = maskOrPrefix.trim().replace(/^\//, '');
  if (/^\d{1,3}$/.test(s)) {
    const n = Number(s);
    return n <= 128 ? n : undefined;
  }
  try {
    return maskToPrefix(s);
  } catch {
    return undefined;
  }
}

const SECRET_RE =
  /\b(secret|password|passwd|key-string|key\s+\d|community|authentication-key|pre-shared-key|psk|md5|encrypted|crypto\s+isakmp\s+key|tacacs-server\s+key|radius-server\s+key|key\s+7|snmp-server\s+user)\b/i;

/** Lines that may carry secrets are never kept, not even in the unparsed list (FR-IMP-25). */
export function isSecretLine(line: string): boolean {
  return SECRET_RE.test(line);
}

export function redact(line: string): string {
  return isSecretLine(line) ? line.replace(/(\S+\s+\S+).*/, '$1 [redacted]') : line;
}

export function speedFromText(s: string): number | undefined {
  const t = s.toLowerCase().replace(/^a-/, '');
  if (/^\d+$/.test(t)) return Number(t);
  const m = /^(\d+(?:\.\d+)?)\s*(g|m)/.exec(t);
  if (!m) return undefined;
  return Math.round(Number(m[1]) * (m[2] === 'g' ? 1000 : 1));
}
