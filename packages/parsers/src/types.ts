// SPDX-License-Identifier: Apache-2.0
import type { DeviceRole, InterfaceMode } from '@linewise/core';

export type SourceKind =
  | 'cdp'
  | 'lldp'
  | 'running-config'
  | 'ip-interface-brief'
  | 'interfaces-status'
  | 'vlan-brief'
  | 'etherchannel-summary'
  | 'csv'
  | 'drawio'
  | 'gns3'
  | 'containerlab'
  | 'nmap';

export interface ParsedIp {
  address: string;
  prefix: number;
  secondary?: boolean;
}

export interface ParsedInterface {
  name: string;
  description?: string;
  enabled?: boolean;
  mode?: InterfaceMode;
  accessVlan?: number;
  nativeVlan?: number;
  allowedVlans?: string;
  ipv4?: ParsedIp[];
  ipv6?: ParsedIp[];
  vrf?: string;
  channelGroup?: { number: number; mode: 'lacp-active' | 'lacp-passive' | 'on' | 'pagp' };
  speedMbps?: number;
  duplex?: 'auto' | 'full' | 'half';
  media?: 'copper' | 'fiber';
  dot1q?: number;
  mtu?: number;
  fhrp?: { protocol: 'hsrp' | 'vrrp' | 'glbp'; group: number; vip: string };
}

export interface ParsedDevice {
  hostname: string;
  role?: DeviceRole;
  platform?: string;
  vendor?: string;
  model?: string;
  osVersion?: string;
  serial?: string;
  site?: string;
  mgmtIp?: string;
  interfaces: ParsedInterface[];
  routing?: { protocol: 'ospf' | 'eigrp' | 'bgp' | 'isis' | 'rip' | 'static'; value: string }[];
  /** Where in the diagram the source placed it (draw.io, GNS3). */
  position?: { x: number; y: number };
}

export interface ParsedLink {
  a: { hostname: string; iface?: string };
  b: { hostname: string; iface?: string };
  medium?: 'copper' | 'fiber-sm' | 'fiber-mm' | 'serial' | 'wireless' | 'virtual' | 'console';
  label?: string;
}

export interface UnparsedLine {
  line: number;
  text: string;
}

export interface ParseResult {
  kind: SourceKind;
  /** Device the output came from (prompt, hostname line, or the user's choice). */
  localHostname?: string;
  devices: ParsedDevice[];
  links: ParsedLink[];
  vlans: { number: number; name: string }[];
  vrfs: { name: string; rd?: string }[];
  /** Positioned shapes that are not network devices (draw.io). */
  annotations: { text: string; x: number; y: number; w: number; h: number }[];
  warnings: string[];
  unparsedLines: UnparsedLine[];
}

export interface ParseOptions {
  /** Hostname of the device the output was captured on, when the text has no prompt. */
  localHostname?: string;
  /** File name, used for format detection (CSV, YAML, XML). */
  fileName?: string;
}

export function emptyResult(kind: SourceKind, localHostname?: string): ParseResult {
  const r: ParseResult = {
    kind,
    devices: [],
    links: [],
    vlans: [],
    vrfs: [],
    annotations: [],
    warnings: [],
    unparsedLines: [],
  };
  if (localHostname) r.localHostname = localHostname;
  return r;
}

/** Hard cap on input size (NFR-SEC-05). */
export const MAX_INPUT_BYTES = 20 * 1024 * 1024;
