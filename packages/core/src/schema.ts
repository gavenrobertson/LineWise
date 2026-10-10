// SPDX-License-Identifier: Apache-2.0
/**
 * The LineWise network model (spec section 4). Zod schemas are the single
 * source of truth for runtime validation, TypeScript types and the generated
 * JSON Schema (FR-FMT-02).
 */
import { z } from 'zod';

export const FORMAT_NAME = 'LineWise';
export const SCHEMA_VERSION = 1;

export const Id = z.string().min(1);
export const CustomFields = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));

const base = {
  id: Id,
  createdAt: z.string(),
  updatedAt: z.string(),
  customFields: CustomFields.default({}),
};

export const DEVICE_ROLES = [
  'router',
  'l2-switch',
  'l3-switch',
  'firewall',
  'wlc',
  'access-point',
  'load-balancer',
  'server',
  'virtual-machine',
  'hypervisor',
  'workstation',
  'laptop',
  'ip-phone',
  'printer',
  'iot',
  'storage',
  'cloud',
  'internet',
  'wan-cloud',
  'mpls-cloud',
  'modem',
  'vpn-concentrator',
  'ids-ips',
  'proxy',
  'dns-dhcp',
  'patch-panel',
  'generic',
] as const;
export const DeviceRole = z.enum(DEVICE_ROLES);
export type DeviceRole = z.infer<typeof DeviceRole>;

export const INTERFACE_TYPES = [
  'ethernet',
  'fastethernet',
  'gigabitethernet',
  'tengigabitethernet',
  'twentyfivegige',
  'fortygigabitethernet',
  'hundredgige',
  'serial',
  'loopback',
  'vlan',
  'tunnel',
  'port-channel',
  'management',
  'wireless',
  'subinterface',
  'other',
] as const;
export const InterfaceType = z.enum(INTERFACE_TYPES);
export type InterfaceType = z.infer<typeof InterfaceType>;

export const InterfaceMode = z.enum(['access', 'trunk', 'routed', 'unset']);
export type InterfaceMode = z.infer<typeof InterfaceMode>;

export const Duplex = z.enum(['auto', 'full', 'half']);

export const IpAssignment = z.object({
  address: z.string(),
  prefix: z.number().int().min(0).max(128),
  secondary: z.boolean().default(false),
});
export type IpAssignment = z.infer<typeof IpAssignment>;

export const Interface = z.object({
  ...base,
  deviceId: Id,
  name: z.string().min(1),
  shortName: z.string(),
  type: InterfaceType,
  speedMbps: z.number().int().positive().optional(),
  duplex: Duplex.default('auto'),
  mtu: z.number().int().positive().optional(),
  enabled: z.boolean().default(true),
  description: z.string().default(''),
  mode: InterfaceMode.default('unset'),
  accessVlan: z.number().int().min(1).max(4094).optional(),
  nativeVlan: z.number().int().min(1).max(4094).optional(),
  /** VLAN list in Cisco range syntax, e.g. "1-10,20,30-40". Empty = all (trunk default). */
  allowedVlans: z.string().default(''),
  ipv4: z.array(IpAssignment).default([]),
  ipv6: z.array(IpAssignment).default([]),
  vrfId: Id.optional(),
  portChannelId: Id.optional(),
  /** For sub-interfaces: dot1q tag. */
  dot1q: z.number().int().min(1).max(4094).optional(),
  /** Physical medium the port accepts (copper or fiber); drives VAL-020. */
  media: z.enum(['copper', 'fiber', 'any']).default('any'),
  mac: z.string().optional(),
  poe: z.boolean().default(false),
  /** HSRP/VRRP/GLBP group membership (FR-NET-12). */
  fhrp: z
    .object({ protocol: z.enum(['hsrp', 'vrrp', 'glbp']), group: z.number().int().min(0), vip: z.string() })
    .optional(),
});
export type Interface = z.infer<typeof Interface>;

export const Device = z.object({
  ...base,
  hostname: z.string().min(1),
  role: DeviceRole,
  templateId: z.string().optional(),
  vendor: z.string().default(''),
  model: z.string().default(''),
  platform: z.string().default(''),
  osVersion: z.string().default(''),
  serial: z.string().default(''),
  assetTag: z.string().default(''),
  mgmtIp: z.string().default(''),
  site: z.string().default(''),
  rack: z.string().default(''),
  rackUnit: z.number().int().positive().optional(),
  zoneId: Id.optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().default(''),
  interfaces: z.array(Interface).default([]),
  /** Another role's icon ("router") or an embedded custom icon ("asset:<assetId>", FR-ICO-05/06). */
  iconOverride: z.string().optional(),
  /** User-chosen color tag shown as a badge (FR-ICO-04). */
  colorTag: z.string().optional(),
  locked: z.boolean().default(false),
  labelPosition: z.enum(['bottom', 'top', 'left', 'right']).default('bottom'),
  /** Routing annotations (FR-NET-11). */
  routing: z
    .array(
      z.object({ protocol: z.enum(['ospf', 'eigrp', 'bgp', 'isis', 'rip', 'static']), value: z.string() }),
    )
    .default([]),
});
export type Device = z.infer<typeof Device>;

export const LINK_MEDIA = [
  'copper',
  'fiber-sm',
  'fiber-mm',
  'serial',
  'wireless',
  'virtual',
  'console',
] as const;
export const LinkMedium = z.enum(LINK_MEDIA);
export type LinkMedium = z.infer<typeof LinkMedium>;

export const Endpoint = z.object({ deviceId: Id, interfaceId: Id });
export type Endpoint = z.infer<typeof Endpoint>;

export const Link = z.object({
  ...base,
  endpointA: Endpoint,
  endpointB: Endpoint,
  medium: LinkMedium.default('copper'),
  bandwidthMbps: z.number().int().positive().optional(),
  cableId: z.string().default(''),
  label: z.string().default(''),
  circuitId: z.string().default(''),
  provider: z.string().default(''),
  style: z
    .object({
      routing: z.enum(['straight', 'orthogonal', 'curved']).optional(),
      color: z.string().optional(),
      waypoints: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
    })
    .default({}),
});
export type Link = z.infer<typeof Link>;

export const PortChannel = z.object({
  ...base,
  deviceId: Id,
  number: z.number().int().positive(),
  mode: z.enum(['lacp-active', 'lacp-passive', 'on', 'pagp']),
  memberInterfaceIds: z.array(Id).default([]),
  logicalInterfaceId: Id.optional(),
});
export type PortChannel = z.infer<typeof PortChannel>;

export const Zone = z.object({
  ...base,
  name: z.string().min(1),
  kind: z.enum(['site', 'building', 'floor', 'security-zone', 'cloud-vpc', 'custom']),
  parentZoneId: Id.optional(),
  color: z.string().default('#0D9488'),
  description: z.string().default(''),
  locked: z.boolean().default(false),
});
export type Zone = z.infer<typeof Zone>;

export const Vlan = z.object({
  ...base,
  number: z.number().int().min(1).max(4094),
  name: z.string().default(''),
  description: z.string().default(''),
  color: z.string().default('#2563EB'),
  subnetIds: z.array(Id).default([]),
  site: z.string().optional(),
});
export type Vlan = z.infer<typeof Vlan>;

export const Vrf = z.object({
  ...base,
  name: z.string().min(1),
  rd: z.string().default(''),
  description: z.string().default(''),
});
export type Vrf = z.infer<typeof Vrf>;

export const Subnet = z.object({
  ...base,
  cidr: z.string(),
  name: z.string().default(''),
  vlanId: Id.optional(),
  vrfId: Id.optional(),
  gatewayIp: z.string().default(''),
  description: z.string().default(''),
  reserved: z
    .array(z.object({ start: z.string(), end: z.string(), note: z.string().default('') }))
    .default([]),
});
export type Subnet = z.infer<typeof Subnet>;

export const Geometry = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  rotation: z.number().default(0),
});

export const Annotation = z.object({
  ...base,
  kind: z.enum(['text', 'rect', 'ellipse', 'line', 'note', 'image']),
  geometry: Geometry,
  style: z
    .object({
      fill: z.string().optional(),
      stroke: z.string().optional(),
      fontSize: z.number().optional(),
      arrowEnd: z.boolean().optional(),
    })
    .default({}),
  text: z.string().default(''),
  assetId: Id.optional(),
  layerId: Id.optional(),
  locked: z.boolean().default(false),
});
export type Annotation = z.infer<typeof Annotation>;

export const Layer = z.object({
  id: Id,
  name: z.string(),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  order: z.number(),
});
export type Layer = z.infer<typeof Layer>;

export const Position = z.object({ x: z.number(), y: z.number() });
export const ZoneBox = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });

export const Page = z.object({
  ...base,
  name: z.string().min(1),
  order: z.number(),
  viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number() }).default({ x: 0, y: 0, zoom: 1 }),
  /** Layout lives here, not on devices (ADR 0004). */
  nodePositions: z.record(Id, Position).default({}),
  zoneBoxes: z.record(Id, ZoneBox).default({}),
  annotations: z.array(Annotation).default([]),
  layers: z.array(Layer).default([]),
  background: z.enum(['grid', 'dots', 'plain']).default('dots'),
  /** References to devices placed on other pages (FR-CAN-12). */
  offPageRefs: z.array(z.object({ deviceId: Id, position: Position })).default([]),
});
export type Page = z.infer<typeof Page>;

export const Asset = z.object({ mime: z.string(), base64: z.string() });

export const Suppression = z.object({ ruleId: z.string(), objectIds: z.array(Id), reason: z.string() });

export const DocumentSettings = z.object({
  labelTemplate: z.string().default('{hostname}'),
  defaultLinkRouting: z.enum(['straight', 'orthogonal', 'curved']).default('straight'),
  iconStyle: z.enum(['classic', 'line']).default('classic'),
  showInterfaceNames: z.boolean().default(true),
  showInterfaceIps: z.boolean().default(false),
  showVlans: z.boolean().default(false),
  disabledRules: z.array(z.string()).default([]),
  suppressions: z.array(Suppression).default([]),
});
export type DocumentSettings = z.infer<typeof DocumentSettings>;

export const NetworkDocument = z.object({
  $schema: z.string().optional(),
  format: z.literal(FORMAT_NAME),
  schemaVersion: z.number().int().positive(),
  id: Id,
  name: z.string(),
  description: z.string().default(''),
  author: z.string().default(''),
  createdAt: z.string(),
  updatedAt: z.string(),
  pages: z.array(Page).min(1),
  devices: z.array(Device).default([]),
  links: z.array(Link).default([]),
  portChannels: z.array(PortChannel).default([]),
  zones: z.array(Zone).default([]),
  vlans: z.array(Vlan).default([]),
  vrfs: z.array(Vrf).default([]),
  subnets: z.array(Subnet).default([]),
  assets: z.record(Id, Asset).default({}),
  settings: DocumentSettings.default({
    labelTemplate: '{hostname}',
    defaultLinkRouting: 'straight',
    iconStyle: 'classic',
    showInterfaceNames: true,
    showInterfaceIps: false,
    showVlans: false,
    disabledRules: [],
    suppressions: [],
  }),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type NetworkDocument = z.infer<typeof NetworkDocument>;
