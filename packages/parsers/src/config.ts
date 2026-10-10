// SPDX-License-Identifier: Apache-2.0
/**
 * `show running-config` parser for IOS, IOS-XE and NX-OS (FR-IMP-03). Config
 * text is parsed, never executed; lines that may carry secrets are dropped and
 * never reach the result, not even the unparsed list (FR-IMP-25).
 */
import { formatVlanList, normalizeInterfaceName, parseVlanList } from '@linewise/core';
import {
  emptyResult,
  type ParseOptions,
  type ParseResult,
  type ParsedDevice,
  type ParsedInterface,
} from './types.ts';
import { isSecretLine, parsePrefix, redact, speedFromText, splitLines } from './util.ts';

const IGNORED_TOP =
  /^(version|service|boot|logging|aaa|clock|no |ntp|snmp-server|banner|line|end|building configuration|current configuration|license|spanning-tree|errdisable|archive|control-plane|ip (domain|name-server|http|ssh|scp|forward-protocol|cef|route|default-gateway|dhcp|igmp|arp|tftp|ftp|source-route|classless|bootp|finger)|username|enable|crypto|platform|diagnostic|memory|redundancy|transceiver|mac |vtp|lldp|cdp|feature|system|policy-map|class-map|access-list|ip access-list|route-map|ip prefix-list|key chain|alias|cts|device-tracking|call-home|copp|hardware|vdc|rmon|track|event|multilink|login|exec|privilege|port-channel load-balance|power|udld|dot1x|radius|tacacs|file|switch \d|module|monitor|flow|object-group|ipv6 (unicast-routing|route)|interface breakout)/i;

function addAllowed(
  current: string | undefined,
  spec: string,
  mode: 'set' | 'add' | 'remove' | 'except',
): string {
  if (/^all$/i.test(spec)) return '';
  if (/^none$/i.test(spec)) return '';
  let next: number[];
  try {
    next = parseVlanList(spec);
  } catch {
    return current ?? '';
  }
  if (mode === 'set') return formatVlanList(next);
  const cur =
    current && current.trim() ? parseVlanList(current) : Array.from({ length: 4094 }, (_, k) => k + 1);
  if (mode === 'add') return formatVlanList([...cur, ...next]);
  const drop = new Set(next);
  if (mode === 'remove') return formatVlanList(cur.filter((v) => !drop.has(v)));
  return formatVlanList(Array.from({ length: 4094 }, (_, k) => k + 1).filter((v) => !drop.has(v)));
}

/** Parse one interface sub-command; returns false when not understood. */
function applyInterfaceLine(i: ParsedInterface, l: string): boolean {
  let m: RegExpExecArray | null;
  if ((m = /^description\s+(.+)$/i.exec(l))) i.description = m[1]?.trim();
  else if (/^shutdown$/i.test(l)) i.enabled = false;
  else if (/^no shutdown$/i.test(l)) i.enabled = true;
  else if ((m = /^switchport mode (access|trunk)/i.exec(l)))
    i.mode = m[1]?.toLowerCase() as 'access' | 'trunk';
  else if ((m = /^switchport access vlan (\d+)/i.exec(l))) {
    i.accessVlan = Number(m[1]);
    i.mode ??= 'access';
  } else if ((m = /^switchport trunk native vlan (\d+)/i.exec(l))) i.nativeVlan = Number(m[1]);
  else if ((m = /^switchport trunk allowed vlan (add|remove|except)\s+(\S+)/i.exec(l)))
    i.allowedVlans = addAllowed(i.allowedVlans, m[2] ?? '', m[1]?.toLowerCase() as 'add');
  else if ((m = /^switchport trunk allowed vlan (\S+)/i.exec(l)))
    i.allowedVlans = addAllowed(i.allowedVlans, m[1] ?? '', 'set');
  else if (/^no switchport$/i.test(l)) i.mode = 'routed';
  else if (/^switchport$/i.test(l)) i.mode ??= 'access';
  else if (/^switchport (nonegotiate|port-security|voice vlan|trunk encapsulation|host|block)/i.test(l))
    return true;
  else if ((m = /^ip address (\d+\.\d+\.\d+\.\d+)[ /](\S+)(\s+secondary)?/i.exec(l))) {
    const prefix = parsePrefix(m[2] ?? '');
    if (prefix === undefined) return false;
    (i.ipv4 ??= []).push({ address: m[1] ?? '', prefix, secondary: Boolean(m[3]) });
    if (i.mode !== 'trunk' && i.mode !== 'access') i.mode = 'routed';
  } else if ((m = /^ip address (\d+\.\d+\.\d+\.\d+)\/(\d+)/i.exec(l))) {
    (i.ipv4 ??= []).push({ address: m[1] ?? '', prefix: Number(m[2]) });
  } else if (/^(ip address dhcp|no ip address)$/i.test(l)) return true;
  else if (/^ip address\b/i.test(l)) return false;
  else if ((m = /^ipv6 address ([0-9a-f:]+)\/(\d+)/i.exec(l)))
    (i.ipv6 ??= []).push({ address: m[1] ?? '', prefix: Number(m[2]) });
  else if ((m = /^(?:ip )?vrf (?:forwarding|member)\s+(\S+)/i.exec(l))) i.vrf = m[1];
  else if ((m = /^channel-group (\d+)(?: mode (active|passive|on|desirable|auto))?/i.exec(l))) {
    const mode = (m[2] ?? 'on').toLowerCase();
    i.channelGroup = {
      number: Number(m[1]),
      mode:
        mode === 'active'
          ? 'lacp-active'
          : mode === 'passive'
            ? 'lacp-passive'
            : mode === 'on'
              ? 'on'
              : 'pagp',
    };
  } else if ((m = /^standby (?:(\d+) )?ip (\d+\.\d+\.\d+\.\d+)/i.exec(l)))
    i.fhrp = { protocol: 'hsrp', group: Number(m[1] ?? 0), vip: m[2] ?? '' };
  else if ((m = /^vrrp (\d+) (?:ip|address) (\d+\.\d+\.\d+\.\d+)/i.exec(l)))
    i.fhrp = { protocol: 'vrrp', group: Number(m[1]), vip: m[2] ?? '' };
  else if ((m = /^glbp (\d+) ip (\d+\.\d+\.\d+\.\d+)/i.exec(l)))
    i.fhrp = { protocol: 'glbp', group: Number(m[1]), vip: m[2] ?? '' };
  else if ((m = /^hsrp (\d+)/i.exec(l)))
    i.fhrp = { protocol: 'hsrp', group: Number(m[1]), vip: i.fhrp?.vip ?? '' };
  else if ((m = /^ip (\d+\.\d+\.\d+\.\d+)$/i.exec(l)) && i.fhrp)
    i.fhrp.vip = m[1] ?? ''; // NX-OS hsrp block
  else if ((m = /^speed (\S+)/i.exec(l))) {
    const s = speedFromText(m[1] ?? '');
    if (s) i.speedMbps = s;
  } else if ((m = /^duplex (full|half|auto)/i.exec(l))) i.duplex = m[1]?.toLowerCase() as 'full';
  else if ((m = /^encapsulation dot1q (\d+)/i.exec(l))) i.dot1q = Number(m[1]);
  else if ((m = /^mtu (\d+)/i.exec(l))) i.mtu = Number(m[1]);
  else if (
    /^(ip |ipv6 |no ip |no ipv6 |negotiation|spanning-tree|storm-control|service-policy|power inline|load-interval|carrier-delay|keepalive|bandwidth|delay|cdp|lldp|logging|media-type|authentication|dot1x|mab|snmp|udld|priority|preempt|lacp|ospf|tunnel|nameif|security-level|management-only|channel-protocol|medium|mls|qos|vpc|no |exit)/i.test(
      l,
    )
  )
    return true;
  else return false;
  return true;
}

function guessMgmtIp(d: ParsedDevice): string | undefined {
  const by = (pred: (i: ParsedInterface) => boolean) =>
    d.interfaces.find((i) => pred(i) && i.ipv4?.length)?.ipv4?.[0]?.address;
  return (
    by((i) => /^mgmt|^Management/i.test(i.name) || /mgmt|management/i.test(i.description ?? '')) ??
    by((i) => /^Loopback0$/i.test(i.name)) ??
    by((i) => /^Vlan/i.test(i.name)) ??
    by(() => true)
  );
}

function guessRole(d: ParsedDevice, text: string): ParsedDevice['role'] {
  const hasSwitchports = d.interfaces.some((i) => i.mode === 'access' || i.mode === 'trunk');
  const svis = d.interfaces.filter((i) => /^Vlan/i.test(i.name) && i.ipv4?.length).length;
  const routes =
    /^\s*ip routing\b/m.test(text) ||
    /^\s*router (ospf|eigrp|bgp|isis|rip)/m.test(text) ||
    d.interfaces.some(
      (i) => i.mode === 'routed' && !/^(Vlan|Loopback|mgmt)/i.test(i.name) && i.ipv4?.length,
    ) ||
    (svis > 1 && !/^\s*ip default-gateway\b/m.test(text));
  if (/^\s*(nameif|ASA Version|security-level)/m.test(text)) return 'firewall';
  if (hasSwitchports && routes) return 'l3-switch';
  if (hasSwitchports) return 'l2-switch';
  if (d.interfaces.some((i) => i.ipv4?.length)) return 'router';
  return undefined;
}

export function parseRunningConfig(text: string, opts: ParseOptions = {}): ParseResult {
  const lines = splitLines(text);
  const r = emptyResult('running-config', opts.localHostname);
  const dev: ParsedDevice = { hostname: opts.localHostname ?? '', interfaces: [] };
  const vlans = new Map<number, string>();
  let cur: ParsedInterface | undefined;
  let section: 'interface' | 'vlan' | 'vrf' | 'router' | 'other' | 'none' = 'none';
  let vlanIds: number[] = [];
  let vrfName = '';
  let secretsDropped = 0;

  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx] ?? '';
    if (!raw.trim() || /^\s*!/.test(raw)) {
      if (/^!\s*$/.test(raw.trim()) && !/^\s/.test(raw)) section = 'none';
      continue;
    }
    if (isSecretLine(raw)) {
      secretsDropped++;
      continue;
    }
    const indented = /^\s/.test(raw);
    const l = raw.trim();
    let m: RegExpExecArray | null;

    if (!indented) {
      cur = undefined;
      if ((m = /^(?:hostname|switchname)\s+(\S+)/i.exec(l))) {
        dev.hostname = m[1]?.replace(/^"|"$/g, '') ?? '';
        section = 'none';
      } else if ((m = /^interface\s+(\S+(?:\s+\S+)?)$/i.exec(l))) {
        const nameRaw = (m[1] ?? '').replace(/\s+/g, '');
        const n = normalizeInterfaceName(nameRaw).name;
        cur = dev.interfaces.find((i) => i.name === n);
        if (!cur) {
          cur = { name: n };
          dev.interfaces.push(cur);
        }
        section = 'interface';
      } else if ((m = /^vlan\s+([\d,\-\s]+)$/i.exec(l))) {
        try {
          vlanIds = parseVlanList(m[1] ?? '');
          for (const v of vlanIds) if (!vlans.has(v)) vlans.set(v, '');
          section = 'vlan';
        } catch {
          r.unparsedLines.push({ line: idx + 1, text: l });
        }
      } else if ((m = /^(?:ip vrf|vrf definition|vrf context)\s+(\S+)/i.exec(l))) {
        vrfName = m[1] ?? '';
        r.vrfs.push({ name: vrfName });
        section = 'vrf';
      } else if ((m = /^router (ospf|eigrp|bgp|isis|rip)\s*(\S*)/i.exec(l))) {
        (dev.routing ??= []).push({ protocol: m[1]?.toLowerCase() as 'ospf', value: m[2] ?? '' });
        section = 'router';
      } else if (/^ip route\s/i.test(l)) {
        if (!dev.routing?.some((x) => x.protocol === 'static'))
          (dev.routing ??= []).push({ protocol: 'static', value: '' });
      } else if (IGNORED_TOP.test(l)) {
        section = 'other';
      } else {
        section = 'other';
        r.unparsedLines.push({ line: idx + 1, text: redact(l) });
      }
      continue;
    }

    if (section === 'interface' && cur) {
      if (!applyInterfaceLine(cur, l)) r.unparsedLines.push({ line: idx + 1, text: redact(l) });
    } else if (section === 'vlan' && (m = /^name\s+(.+)$/i.exec(l))) {
      for (const v of vlanIds) vlans.set(v, m[1]?.trim() ?? '');
    } else if (section === 'vrf' && (m = /^rd\s+(\S+)/i.exec(l))) {
      const v = r.vrfs.find((x) => x.name === vrfName);
      if (v) v.rd = m[1];
    }
  }

  if (!dev.hostname) {
    r.warnings.push('No hostname line found; choose the device this configuration belongs to.');
  } else {
    r.localHostname = dev.hostname;
  }
  if (secretsDropped)
    r.warnings.push(`${secretsDropped} line(s) containing secrets were removed and not imported.`);
  const mgmt = guessMgmtIp(dev);
  if (mgmt) dev.mgmtIp = mgmt;
  const role = guessRole(dev, text);
  if (role) dev.role = role;
  const ver = /^version\s+(\S+)/m.exec(text);
  if (ver?.[1]) dev.osVersion = ver[1];
  if (/^(version \d|Current configuration)/m.test(text) || /^boot system/m.test(text)) dev.vendor = 'Cisco';
  r.vlans = [...vlans.entries()].sort((a, b) => a[0] - b[0]).map(([number, name]) => ({ number, name }));
  r.devices = dev.hostname || dev.interfaces.length ? [dev] : [];
  return r;
}
