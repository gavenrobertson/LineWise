// SPDX-License-Identifier: Apache-2.0
import { newId, nowIso } from './ids.ts';
import {
  FORMAT_NAME,
  SCHEMA_VERSION,
  type Device,
  type DeviceRole,
  type Interface,
  type NetworkDocument,
  type Page,
} from './schema.ts';

export function createPage(name: string, order: number): Page {
  const t = nowIso();
  return {
    id: newId(),
    createdAt: t,
    updatedAt: t,
    customFields: {},
    name,
    order,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodePositions: {},
    zoneBoxes: {},
    annotations: [],
    layers: [],
    background: 'dots',
    offPageRefs: [],
  };
}

export function createDocument(name = 'Untitled diagram', author = ''): NetworkDocument {
  const t = nowIso();
  return {
    format: FORMAT_NAME,
    schemaVersion: SCHEMA_VERSION,
    id: newId(),
    name,
    description: '',
    author,
    createdAt: t,
    updatedAt: t,
    pages: [createPage('Page 1', 0)],
    devices: [],
    links: [],
    portChannels: [],
    zones: [],
    vlans: [],
    vrfs: [],
    subnets: [],
    assets: {},
    settings: {
      labelTemplate: '{hostname}',
      defaultLinkRouting: 'straight',
      iconStyle: 'classic',
      showInterfaceNames: true,
      showInterfaceIps: false,
      showVlans: false,
      disabledRules: [],
      suppressions: [],
    },
    metadata: {},
  };
}

export function createDevice(role: DeviceRole, hostname: string, extra: Partial<Device> = {}): Device {
  const t = nowIso();
  return {
    id: newId(),
    createdAt: t,
    updatedAt: t,
    customFields: {},
    hostname,
    role,
    vendor: '',
    model: '',
    platform: '',
    osVersion: '',
    serial: '',
    assetTag: '',
    mgmtIp: '',
    site: '',
    rack: '',
    tags: [],
    notes: '',
    interfaces: [],
    labelPosition: 'bottom',
    routing: [],
    locked: false,
    ...extra,
  };
}

// ---------- lookups (pure helpers shared by commands, selectors and rules) ----------

export function getDevice(doc: NetworkDocument, id: string): Device | undefined {
  return doc.devices.find((d) => d.id === id);
}

export function getInterface(
  doc: NetworkDocument,
  deviceId: string,
  interfaceId: string,
): Interface | undefined {
  return getDevice(doc, deviceId)?.interfaces.find((i) => i.id === interfaceId);
}

export function getPage(doc: NetworkDocument, id: string): Page | undefined {
  return doc.pages.find((p) => p.id === id);
}

/** Interface IDs currently used by a physical link. */
export function linkedInterfaceIds(doc: NetworkDocument): Set<string> {
  const s = new Set<string>();
  for (const l of doc.links) {
    s.add(l.endpointA.interfaceId);
    s.add(l.endpointB.interfaceId);
  }
  return s;
}

const PHYSICAL_TYPES = new Set([
  'ethernet',
  'fastethernet',
  'gigabitethernet',
  'tengigabitethernet',
  'twentyfivegige',
  'fortygigabitethernet',
  'hundredgige',
  'serial',
  'management',
  'wireless',
  'other',
]);

export function isPhysical(i: Interface): boolean {
  return PHYSICAL_TYPES.has(i.type);
}

/** First enabled physical interface with no link ("next free port", FR-LNK-01). */
export function nextFreeInterface(doc: NetworkDocument, deviceId: string): Interface | undefined {
  const used = linkedInterfaceIds(doc);
  return getDevice(doc, deviceId)?.interfaces.find((i) => isPhysical(i) && !used.has(i.id));
}

const ROLE_PREFIX: Partial<Record<DeviceRole, string>> = {
  router: 'R',
  'l2-switch': 'SW',
  'l3-switch': 'L3SW',
  firewall: 'FW',
  wlc: 'WLC',
  'access-point': 'AP',
  'load-balancer': 'LB',
  server: 'SRV',
  'virtual-machine': 'VM',
  hypervisor: 'HV',
  workstation: 'PC',
  laptop: 'LAPTOP',
  'ip-phone': 'PHONE',
  printer: 'PRN',
  iot: 'IOT',
  storage: 'NAS',
  cloud: 'CLOUD',
  internet: 'INTERNET',
  'wan-cloud': 'WAN',
  'mpls-cloud': 'MPLS',
  modem: 'MODEM',
  'vpn-concentrator': 'VPN',
  'ids-ips': 'IPS',
  proxy: 'PROXY',
  'dns-dhcp': 'DNS',
  'patch-panel': 'PP',
};

export function rolePrefix(role: DeviceRole): string {
  return ROLE_PREFIX[role] ?? 'DEV';
}

/** Next unused hostname with a prefix: R1, R2, … */
export function nextHostname(doc: Pick<NetworkDocument, 'devices'>, prefix: string): string {
  const taken = new Set(doc.devices.map((d) => d.hostname.toLowerCase()));
  for (let i = 1; ; i++) {
    const h = `${prefix}${i}`;
    if (!taken.has(h.toLowerCase())) return h;
  }
}

/** Unique copy name for pasted devices: R1 → R1-copy, R1-copy2, … */
export function copyHostname(doc: Pick<NetworkDocument, 'devices'>, hostname: string): string {
  const taken = new Set(doc.devices.map((d) => d.hostname.toLowerCase()));
  if (!taken.has(`${hostname}-copy`.toLowerCase())) return `${hostname}-copy`;
  for (let i = 2; ; i++) {
    const h = `${hostname}-copy${i}`;
    if (!taken.has(h.toLowerCase())) return h;
  }
}

/** Render a device label from the document's label template (FR-NET-10). */
export function renderLabel(template: string, d: Device): string {
  return template
    .replace(/\\n/g, '\n')
    .replace(/\{(\w+)\}/g, (_, key: string) => {
      const v = (d as unknown as Record<string, unknown>)[key];
      return typeof v === 'string' || typeof v === 'number' ? String(v) : '';
    })
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l !== '')
    .join('\n');
}
