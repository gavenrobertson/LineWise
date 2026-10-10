// SPDX-License-Identifier: Apache-2.0
/**
 * Text exporters (FR-EXP-04..08): CSV inventories, IP plan, port map,
 * Markdown/HTML report, draw.io XML, Containerlab YAML, Mermaid and DOT.
 * Image exports (PNG/SVG/PDF) live in the desktop app's renderer.
 */
import { cidrContains, cidrToString, isValidCidr, isValidIp, parseCidr, utilization } from './ip.ts';
import { resolveLinks } from './selectors.ts';
import type { Device, Interface, NetworkDocument } from './schema.ts';
import type { Issue } from './validation.ts';

// ------------------------------------------------------------------ CSV

export function csvEscape(v: unknown): string {
  const s = v === undefined || v === null ? '' : String(v);
  // Neutralize spreadsheet formula injection; quote when needed.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function csv(header: string[], rows: unknown[][]): string {
  return `${[header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\r\n')}\r\n`;
}

const ip4 = (i: Interface) => i.ipv4.map((a) => `${a.address}/${a.prefix}`).join(' ');
const ip6 = (i: Interface) => i.ipv6.map((a) => `${a.address}/${a.prefix}`).join(' ');

export function exportDevicesCsv(doc: NetworkDocument): string {
  const zones = new Map(doc.zones.map((z) => [z.id, z.name]));
  return csv(
    [
      'hostname',
      'role',
      'vendor',
      'model',
      'platform',
      'os_version',
      'serial',
      'asset_tag',
      'mgmt_ip',
      'site',
      'zone',
      'rack',
      'rack_unit',
      'interfaces',
      'tags',
      'notes',
    ],
    [...doc.devices]
      .sort((a, b) => a.hostname.localeCompare(b.hostname, undefined, { numeric: true }))
      .map((d) => [
        d.hostname,
        d.role,
        d.vendor,
        d.model,
        d.platform,
        d.osVersion,
        d.serial,
        d.assetTag,
        d.mgmtIp,
        d.site,
        d.zoneId ? zones.get(d.zoneId) : '',
        d.rack,
        d.rackUnit ?? '',
        d.interfaces.length,
        d.tags.join(' '),
        d.notes,
      ]),
  );
}

export function exportInterfacesCsv(doc: NetworkDocument): string {
  const vrfs = new Map(doc.vrfs.map((v) => [v.id, v.name]));
  const rows: unknown[][] = [];
  for (const d of doc.devices) {
    for (const i of d.interfaces) {
      rows.push([
        d.hostname,
        i.name,
        i.shortName,
        i.type,
        i.enabled ? 'up' : 'shutdown',
        i.description,
        i.mode,
        i.accessVlan ?? '',
        i.nativeVlan ?? '',
        i.allowedVlans,
        ip4(i),
        ip6(i),
        i.vrfId ? vrfs.get(i.vrfId) : '',
        i.speedMbps ?? '',
        i.duplex,
        i.media,
        i.mtu ?? '',
        i.mac ?? '',
      ]);
    }
  }
  return csv(
    [
      'hostname',
      'interface',
      'short_name',
      'type',
      'admin_status',
      'description',
      'mode',
      'access_vlan',
      'native_vlan',
      'allowed_vlans',
      'ipv4',
      'ipv6',
      'vrf',
      'speed_mbps',
      'duplex',
      'media',
      'mtu',
      'mac',
    ],
    rows,
  );
}

export function exportLinksCsv(doc: NetworkDocument): string {
  return csv(
    [
      'device_a',
      'interface_a',
      'device_b',
      'interface_b',
      'medium',
      'bandwidth_mbps',
      'label',
      'circuit_id',
      'provider',
      'cable_id',
    ],
    resolveLinks(doc).map((e) => [
      e.a.device.hostname,
      e.a.iface.name,
      e.b.device.hostname,
      e.b.iface.name,
      e.link.medium,
      e.link.bandwidthMbps ?? '',
      e.link.label,
      e.link.circuitId,
      e.link.provider,
      e.link.cableId,
    ]),
  );
}

/** IP plan: one row per assigned address, grouped by subnet (declared or derived). */
export function exportIpPlanCsv(doc: NetworkDocument): string {
  const vlans = new Map(doc.vlans.map((v) => [v.id, v]));
  const declared = doc.subnets.filter((s) => isValidCidr(s.cidr));
  const rows: unknown[][] = [];
  const assigned: { device: Device; iface: Interface; address: string; prefix: number }[] = [];
  for (const d of doc.devices)
    for (const i of d.interfaces)
      for (const a of [...i.ipv4, ...i.ipv6])
        if (isValidIp(a.address))
          assigned.push({ device: d, iface: i, address: a.address, prefix: a.prefix });
  const covered = new Set<string>();
  for (const s of declared) {
    const c = parseCidr(s.cidr);
    const members = assigned.filter((a) => cidrContains(c, a.address));
    const vlan = s.vlanId ? vlans.get(s.vlanId) : undefined;
    const u =
      c.family === 4
        ? utilization(
            s.cidr,
            members.map((m) => m.address),
          )
        : 0;
    const util = c.family !== 4 ? '' : u === 0 ? '0%' : u < 0.01 ? '<1%' : `${Math.round(u * 100)}%`;
    if (!members.length)
      rows.push([cidrToString(c), s.name, vlan?.number ?? '', s.gatewayIp, util, '', '', '', '']);
    for (const m of members) {
      covered.add(`${m.iface.id}|${m.address}`);
      rows.push([
        cidrToString(c),
        s.name,
        vlan?.number ?? '',
        s.gatewayIp,
        util,
        m.address,
        m.device.hostname,
        m.iface.name,
        m.address === s.gatewayIp ? 'gateway' : '',
      ]);
    }
  }
  for (const m of assigned) {
    if (covered.has(`${m.iface.id}|${m.address}`)) continue;
    const net = isValidCidr(`${m.address}/${m.prefix}`)
      ? cidrToString(parseCidr(`${m.address}/${m.prefix}`))
      : `${m.address}/${m.prefix}`;
    rows.push([net, '(undeclared)', '', '', '', m.address, m.device.hostname, m.iface.name, '']);
  }
  rows.sort(
    (a, b) =>
      String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true }) ||
      String(a[5]).localeCompare(String(b[5]), undefined, { numeric: true }),
  );
  return csv(
    ['subnet', 'name', 'vlan', 'gateway', 'utilization', 'address', 'device', 'interface', 'note'],
    rows,
  );
}

/** Port map: every interface with what it connects to. */
export function exportPortMapCsv(doc: NetworkDocument): string {
  const peer = new Map<string, { device: Device; iface: Interface }>();
  for (const e of resolveLinks(doc)) {
    peer.set(e.a.iface.id, e.b);
    peer.set(e.b.iface.id, e.a);
  }
  const rows: unknown[][] = [];
  for (const d of [...doc.devices].sort((a, b) =>
    a.hostname.localeCompare(b.hostname, undefined, { numeric: true }),
  )) {
    for (const i of d.interfaces) {
      const p = peer.get(i.id);
      const vlan =
        i.mode === 'access'
          ? `access ${i.accessVlan ?? 1}`
          : i.mode === 'trunk'
            ? `trunk ${i.allowedVlans || 'all'}`
            : i.mode;
      rows.push([d.hostname, i.name, i.description, vlan, p?.device.hostname ?? '', p?.iface.name ?? '']);
    }
  }
  return csv(['device', 'interface', 'description', 'vlan', 'connected_device', 'connected_interface'], rows);
}

// ------------------------------------------------------------------ report

export interface ReportOptions {
  /** data: URL of a diagram image to embed. */
  imageDataUrl?: string;
  issues?: Issue[];
  generatedAt?: string;
}

interface ReportSection {
  heading: string;
  header: string[];
  rows: (string | number)[][];
  summary?: string;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function reportSections(doc: NetworkDocument, opts: ReportOptions): ReportSection[] {
  const sections: ReportSection[] = [
    {
      heading: 'Device inventory',
      header: ['Hostname', 'Role', 'Model', 'Mgmt IP', 'Site', 'Interfaces'],
      rows: [...doc.devices]
        .sort((a, b) => a.hostname.localeCompare(b.hostname, undefined, { numeric: true }))
        .map((d) => [
          d.hostname,
          d.role,
          [d.vendor, d.model].filter(Boolean).join(' '),
          d.mgmtIp,
          d.site,
          d.interfaces.length,
        ]),
    },
    {
      heading: 'Links',
      header: ['Device A', 'Interface A', 'Device B', 'Interface B', 'Medium', 'Label'],
      rows: resolveLinks(doc).map((e) => [
        e.a.device.hostname,
        e.a.iface.shortName,
        e.b.device.hostname,
        e.b.iface.shortName,
        e.link.medium,
        e.link.label,
      ]),
    },
    {
      heading: 'IP plan',
      header: ['Subnet', 'Name', 'VLAN', 'Gateway', 'Utilization', 'Address', 'Device', 'Interface', 'Note'],
      rows: exportIpPlanCsv(doc).trim().split('\r\n').slice(1).filter(Boolean).map(parseCsvLine),
    },
    {
      heading: 'VLANs',
      header: ['VLAN', 'Name', 'Description'],
      rows: [...doc.vlans].sort((a, b) => a.number - b.number).map((v) => [v.number, v.name, v.description]),
    },
  ];
  if (opts.issues) {
    const count = (sev: string) => opts.issues?.filter((i) => i.severity === sev).length ?? 0;
    sections.push({
      heading: 'Validation',
      header: ['Severity', 'Rule', 'Message'],
      rows: opts.issues.map((i) => [i.severity, i.ruleId, i.message]),
      summary: `${count('error')} errors, ${count('warning')} warnings, ${count('info')} info.`,
    });
  }
  return sections;
}

function intro(doc: NetworkDocument, opts: ReportOptions): string {
  return `Generated by LineWise${opts.generatedAt ? ` on ${opts.generatedAt}` : ''}. ${doc.devices.length} devices, ${doc.links.length} links.`;
}

function mdCell(s: string | number): string {
  return String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/** Markdown report (FR-EXP-05): diagram, inventory, IP plan, VLANs, validation summary. */
export function exportMarkdownReport(doc: NetworkDocument, opts: ReportOptions = {}): string {
  const out: string[] = [`# ${doc.name}`, ''];
  if (doc.description) out.push(doc.description, '');
  out.push(intro(doc, opts), '');
  if (opts.imageDataUrl) out.push(`![${doc.name}](${opts.imageDataUrl})`, '');
  for (const s of reportSections(doc, opts)) {
    out.push(`## ${s.heading}`, '');
    if (s.summary) out.push(s.summary, '');
    if (!s.rows.length) out.push('_None._', '');
    else
      out.push(
        `| ${s.header.join(' | ')} |`,
        `| ${s.header.map(() => '---').join(' | ')} |`,
        ...s.rows.map((r) => `| ${r.map(mdCell).join(' | ')} |`),
        '',
      );
  }
  return out.join('\n');
}

function htmlEscape(s: string | number): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Self-contained HTML report (no external resources). */
export function exportHtmlReport(doc: NetworkDocument, opts: ReportOptions = {}): string {
  const body: string[] = [`<h1>${htmlEscape(doc.name)}</h1>`];
  if (doc.description) body.push(`<p>${htmlEscape(doc.description)}</p>`);
  body.push(`<p class="meta">${htmlEscape(intro(doc, opts))}</p>`);
  if (opts.imageDataUrl?.startsWith('data:image/'))
    body.push(`<figure><img alt="${htmlEscape(doc.name)}" src="${htmlEscape(opts.imageDataUrl)}"></figure>`);
  for (const s of reportSections(doc, opts)) {
    body.push(`<h2>${htmlEscape(s.heading)}</h2>`);
    if (s.summary) body.push(`<p>${htmlEscape(s.summary)}</p>`);
    if (!s.rows.length) {
      body.push('<p class="meta">None.</p>');
      continue;
    }
    body.push(
      `<table><thead><tr>${s.header.map((h) => `<th>${htmlEscape(h)}</th>`).join('')}</tr></thead><tbody>${s.rows
        .map((r) => `<tr>${r.map((c) => `<td>${htmlEscape(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table>`,
    );
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${htmlEscape(doc.name)} — LineWise report</title>
<style>body{font-family:system-ui,sans-serif;color:#0E1726;max-width:1100px;margin:40px auto;padding:0 24px;line-height:1.5}h1{font-size:28px;margin-bottom:4px}h2{font-size:20px;margin-top:32px;border-bottom:1px solid #E3E7EC;padding-bottom:6px}.meta{color:#4B5563}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #E3E7EC;padding:6px 8px;text-align:left;vertical-align:top}th{background:#F4F6F8}figure{margin:16px 0}img{max-width:100%;border:1px solid #E3E7EC;border-radius:8px}</style></head><body>
${body.join('\n')}
</body></html>
`;
}

// ------------------------------------------------------------------ draw.io

const DRAWIO_SHAPE: Partial<Record<Device['role'], string>> = {
  router: 'mxgraph.cisco.routers.router',
  'l2-switch': 'mxgraph.cisco.switches.workgroup_switch',
  'l3-switch': 'mxgraph.cisco.switches.layer_3_switch',
  firewall: 'mxgraph.cisco.security.firewall',
  wlc: 'mxgraph.cisco.wireless.wireless_lan_controller',
  'access-point': 'mxgraph.cisco.wireless.access_point',
  server: 'mxgraph.cisco.servers.fileserver',
  workstation: 'mxgraph.cisco.computers_and_peripherals.pc',
  laptop: 'mxgraph.cisco.computers_and_peripherals.laptop',
  'ip-phone': 'mxgraph.cisco.modems_and_phones.ip_phone',
  printer: 'mxgraph.cisco.computers_and_peripherals.printer',
  storage: 'mxgraph.cisco.storage.relational_database',
  cloud: 'mxgraph.cisco.storage.cloud',
  internet: 'mxgraph.cisco.storage.cloud',
  'wan-cloud': 'mxgraph.cisco.storage.cloud',
  'mpls-cloud': 'mxgraph.cisco.storage.cloud',
  'load-balancer': 'mxgraph.cisco.misc.load_balancer',
};

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '&#xa;');
}

/** draw.io / diagrams.net XML (FR-EXP-06): positions, labels and links intact. */
export function exportDrawio(doc: NetworkDocument, pageId?: string): string {
  const page = doc.pages.find((p) => p.id === pageId) ?? doc.pages[0];
  if (!page) return '';
  const W = 64;
  const H = 64;
  const cells: string[] = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>'];
  let n = 2;
  const cellId = new Map<string, string>();
  for (const z of doc.zones) {
    const b = page.zoneBoxes[z.id];
    if (!b) continue;
    const id = `c${n++}`;
    cells.push(
      `<mxCell id="${id}" value="${xmlEscape(z.name)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=none;dashed=1;verticalAlign=top;align=left;spacingLeft=8;strokeColor=${xmlEscape(z.color)};" vertex="1" parent="1"><mxGeometry x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" as="geometry"/></mxCell>`,
    );
  }
  for (const d of doc.devices) {
    const p = page.nodePositions[d.id];
    if (!p) continue;
    const id = `c${n++}`;
    cellId.set(d.id, id);
    const shape = DRAWIO_SHAPE[d.role] ? `shape=${DRAWIO_SHAPE[d.role]};` : 'rounded=1;';
    const label = [d.hostname, d.mgmtIp].filter(Boolean).join('\n');
    cells.push(
      `<mxCell id="${id}" value="${xmlEscape(label)}" style="${shape}html=1;verticalLabelPosition=bottom;verticalAlign=top;fillColor=#1F6FB2;strokeColor=#ffffff;" vertex="1" parent="1"><mxGeometry x="${p.x - W / 2}" y="${p.y - H / 2}" width="${W}" height="${H}" as="geometry"/></mxCell>`,
    );
  }
  for (const e of resolveLinks(doc)) {
    const s = cellId.get(e.a.device.id);
    const t = cellId.get(e.b.device.id);
    if (!s || !t) continue;
    const id = `c${n++}`;
    const dash =
      e.link.medium === 'wireless'
        ? 'dashed=1;'
        : e.link.medium === 'virtual' || e.link.medium === 'console'
          ? 'dashed=1;dashPattern=1 3;'
          : '';
    const color = e.link.medium.startsWith('fiber') ? 'strokeColor=#EA580C;' : '';
    cells.push(
      `<mxCell id="${id}" value="${xmlEscape(`${e.a.iface.shortName} - ${e.b.iface.shortName}`)}" style="endArrow=none;html=1;edgeStyle=orthogonalEdgeStyle;${dash}${color}" edge="1" parent="1" source="${s}" target="${t}"><mxGeometry relative="1" as="geometry"/></mxCell>`,
    );
  }
  for (const a of page.annotations) {
    if (!a.text) continue;
    const id = `c${n++}`;
    cells.push(
      `<mxCell id="${id}" value="${xmlEscape(a.text)}" style="text;html=1;whiteSpace=wrap;${a.kind === 'note' ? 'fillColor=#FEF3C7;' : ''}" vertex="1" parent="1"><mxGeometry x="${a.geometry.x}" y="${a.geometry.y}" width="${a.geometry.w}" height="${a.geometry.h}" as="geometry"/></mxCell>`,
    );
  }
  return `<mxfile host="LineWise"><diagram name="${xmlEscape(page.name)}" id="${xmlEscape(page.id)}"><mxGraphModel grid="1" gridSize="10"><root>${cells.join('')}</root></mxGraphModel></diagram></mxfile>\n`;
}

// ------------------------------------------------------------------ Containerlab, Mermaid, DOT

const safeName = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '-');

/** Containerlab topology (FR-EXP-07). Interfaces are mapped to ethN; the mapping is kept in comments. */
export function exportContainerlab(doc: NetworkDocument): string {
  const ends = resolveLinks(doc);
  const ethOf = new Map<string, string>();
  const counter = new Map<string, number>();
  const map = (deviceId: string, ifaceId: string) => {
    if (!ethOf.has(ifaceId)) {
      const n = (counter.get(deviceId) ?? 0) + 1;
      counter.set(deviceId, n);
      ethOf.set(ifaceId, `eth${n}`);
    }
    return ethOf.get(ifaceId) as string;
  };
  const lines = [
    `# Generated by LineWise from "${doc.name}". Set each node's kind and image for your lab.`,
    `name: ${safeName(doc.name) || 'linewise'}`,
    'topology:',
    '  nodes:',
  ];
  for (const d of doc.devices) {
    lines.push(
      `    ${safeName(d.hostname)}:`,
      `      kind: linux`,
      `      image: alpine:latest  # role: ${d.role}${d.model ? `, model: ${d.model}` : ''}`,
    );
  }
  lines.push('  links:');
  for (const e of ends) {
    const a = `${safeName(e.a.device.hostname)}:${map(e.a.device.id, e.a.iface.id)}`;
    const b = `${safeName(e.b.device.hostname)}:${map(e.b.device.id, e.b.iface.id)}`;
    lines.push(`    - endpoints: ["${a}", "${b}"]  # ${e.a.iface.shortName} ↔ ${e.b.iface.shortName}`);
  }
  return `${lines.join('\n')}\n`;
}

const mmId = (s: string) => `n_${s.replace(/[^A-Za-z0-9_]/g, '_')}`;

export function exportMermaid(doc: NetworkDocument): string {
  const lines = ['graph LR'];
  for (const d of doc.devices) lines.push(`  ${mmId(d.id)}["${d.hostname.replace(/"/g, "'")}"]`);
  for (const e of resolveLinks(doc))
    lines.push(
      `  ${mmId(e.a.device.id)} ---|"${e.a.iface.shortName} – ${e.b.iface.shortName}"| ${mmId(e.b.device.id)}`,
    );
  return `${lines.join('\n')}\n`;
}

export function exportDot(doc: NetworkDocument): string {
  const q = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  const lines = [`graph ${q(doc.name)} {`, '  node [shape=box, style=rounded];'];
  for (const d of doc.devices) lines.push(`  ${q(d.id)} [label=${q(d.hostname)}];`);
  for (const e of resolveLinks(doc))
    lines.push(
      `  ${q(e.a.device.id)} -- ${q(e.b.device.id)} [taillabel=${q(e.a.iface.shortName)}, headlabel=${q(e.b.iface.shortName)}];`,
    );
  lines.push('}');
  return `${lines.join('\n')}\n`;
}
