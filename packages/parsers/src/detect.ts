// SPDX-License-Identifier: Apache-2.0
/** Auto-detect the kind of pasted text or file (FR-IMP-20) and dispatch to a parser. */
import { parseRunningConfig } from './config.ts';
import { parseContainerlab, parseCsv, parseDrawio, parseGns3, parseNmapXml } from './formats.ts';
import { parseCdp, parseLldp } from './neighbors.ts';
import {
  parseEtherchannelSummary,
  parseInterfacesStatus,
  parseIpInterfaceBrief,
  parseVlanBrief,
} from './show.ts';
import { emptyResult, type ParseOptions, type ParseResult, type SourceKind } from './types.ts';

export function detectKind(text: string, fileName = ''): SourceKind | null {
  const f = fileName.toLowerCase();
  const head = text.slice(0, 20000);
  if (f.endsWith('.drawio') || /<mxfile|<mxGraphModel/i.test(head)) return 'drawio';
  if (f.endsWith('.gns3') || (/"topology"\s*:/.test(head) && /"node_id"/.test(head))) return 'gns3';
  if (
    f.endsWith('.clab.yml') ||
    f.endsWith('.clab.yaml') ||
    (/^topology:\s*$/m.test(head) && /^\s+nodes:\s*$/m.test(head))
  )
    return 'containerlab';
  if (/<nmaprun\b/i.test(head)) return 'nmap';
  if (/^\s*Device ID\s*:/im.test(head) && /Port ID|Interface\s*:/i.test(head)) return 'cdp';
  if (
    /^\s*(Local Intf|Local Port id|Chassis id)\s*:/im.test(head) ||
    /^Interface:\s+\S+,\s*via:\s*LLDP/im.test(head)
  )
    return 'lldp';
  if (/^\s*Interface\s+IP-Address\s+OK\?/im.test(head) || /^IP Interface Status for VRF/im.test(head))
    return 'ip-interface-brief';
  if (/^\s*Port\s+Name\s+Status\s+Vlan\s+Duplex\s+Speed/im.test(head)) return 'interfaces-status';
  if (/^\s*VLAN\s+Name\s+Status\s+Ports/im.test(head)) return 'vlan-brief';
  if (
    /^\s*Group\s+Port-\s*(channel|Channel)?\s+(Type\s+)?Protocol/im.test(head) ||
    /Po\d+\(\w+\)\s+(Eth\s+)?(LACP|PAgP|NONE)/.test(head)
  )
    return 'etherchannel-summary';
  if (/^(hostname|switchname)\s+\S+/im.test(head) || (/^interface\s+\S+/im.test(head) && /^!/m.test(head)))
    return 'running-config';
  if (f.endsWith('.csv') || f.endsWith('.tsv')) return 'csv';
  const first = head.split(/\r?\n/)[0] ?? '';
  if (/,/.test(first) && /host|device|name|interface|port/i.test(first)) return 'csv';
  return null;
}

export function parseText(text: string, opts: ParseOptions = {}, forced?: SourceKind): ParseResult {
  const kind = forced ?? detectKind(text, opts.fileName);
  try {
    switch (kind) {
      case 'cdp':
        return parseCdp(text, opts);
      case 'lldp':
        return parseLldp(text, opts);
      case 'running-config':
        return parseRunningConfig(text, opts);
      case 'ip-interface-brief':
        return parseIpInterfaceBrief(text, opts);
      case 'interfaces-status':
        return parseInterfacesStatus(text, opts);
      case 'vlan-brief':
        return parseVlanBrief(text, opts);
      case 'etherchannel-summary':
        return parseEtherchannelSummary(text, opts);
      case 'csv':
        return parseCsv(text, opts);
      case 'drawio':
        return parseDrawio(text);
      case 'gns3':
        return parseGns3(text);
      case 'containerlab':
        return parseContainerlab(text);
      case 'nmap':
        return parseNmapXml(text);
      default: {
        const r = emptyResult('running-config');
        r.warnings.push(
          'Could not recognize this text. Supported: show cdp/lldp neighbors detail, show running-config, show ip interface brief, show interfaces status, show vlan brief, show etherchannel summary, CSV, draw.io, GNS3, Containerlab and Nmap XML.',
        );
        return r;
      }
    }
  } catch (e) {
    const r = emptyResult(kind ?? 'running-config');
    r.warnings.push(`Import failed: ${(e as Error).message}`);
    return r;
  }
}

export const KIND_LABELS: Record<SourceKind, string> = {
  cdp: 'CDP neighbors',
  lldp: 'LLDP neighbors',
  'running-config': 'Running configuration',
  'ip-interface-brief': 'IP interface brief',
  'interfaces-status': 'Interfaces status',
  'vlan-brief': 'VLAN brief',
  'etherchannel-summary': 'EtherChannel summary',
  csv: 'CSV',
  drawio: 'draw.io diagram',
  gns3: 'GNS3 project',
  containerlab: 'Containerlab topology',
  nmap: 'Nmap scan',
};
