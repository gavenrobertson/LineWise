// SPDX-License-Identifier: Apache-2.0
/**
 * Command factories: the only way the UI changes the model (spec section 9).
 * Each factory returns a Command; IDs for new objects are generated when the
 * factory is called, so callers know them before the command runs.
 */
import type { Draft } from 'immer';
import {
  createDevice,
  createPage,
  copyHostname,
  isPhysical,
  linkedInterfaceIds,
  nextHostname,
  rolePrefix,
} from './document.ts';
import { newId, nowIso } from './ids.ts';
import { expandInterfaceRange, normalizeInterfaceName } from './naming.ts';
import type {
  Annotation,
  Device,
  DeviceRole,
  DocumentSettings,
  Interface,
  Link,
  LinkMedium,
  NetworkDocument,
  Page,
  PortChannel,
  Subnet,
  Vlan,
  Vrf,
  Zone,
} from './schema.ts';
import type { Command } from './history.ts';
import { instantiateInterfaces, makeInterface, type DeviceTemplate } from './templates.ts';

type D = Draft<NetworkDocument>;
type XY = { x: number; y: number };

function stamp<T extends { updatedAt: string }>(o: T): void {
  o.updatedAt = nowIso();
}

function findDevice(d: D, id: string): Draft<Device> {
  const dev = d.devices.find((x) => x.id === id);
  if (!dev) throw new Error(`Device ${id} not found`);
  return dev;
}

function findPage(d: D, id: string): Draft<Page> {
  const p = d.pages.find((x) => x.id === id);
  if (!p) throw new Error(`Page ${id} not found`);
  return p;
}

function base() {
  const t = nowIso();
  return { id: newId(), createdAt: t, updatedAt: t, customFields: {} };
}

// ---------------------------------------------------------------- devices

export interface AddDeviceOptions {
  role: DeviceRole;
  pageId: string;
  position: XY;
  hostname?: string;
  template?: DeviceTemplate;
  zoneId?: string;
  fields?: Partial<Pick<Device, 'vendor' | 'model' | 'platform' | 'mgmtIp' | 'site' | 'serial'>>;
}

export function addDevice(opts: AddDeviceOptions): Command & { deviceId: string } {
  const device = createDevice(opts.role, opts.hostname ?? '__auto__');
  if (opts.template) {
    device.templateId = opts.template.id;
    device.vendor = opts.template.generic ? '' : opts.template.vendor;
    device.model = opts.template.generic ? '' : opts.template.model;
    device.platform = opts.template.defaults.platform;
    device.osVersion = opts.template.defaults.osVersion;
    if (opts.template.iconRef) device.iconOverride = opts.template.iconRef;
    device.interfaces = instantiateInterfaces(opts.template, device.id);
  }
  if (opts.zoneId) device.zoneId = opts.zoneId;
  Object.assign(device, opts.fields ?? {});
  return {
    label: 'Add device',
    deviceId: device.id,
    run: (d) => {
      const dev = { ...device };
      if (dev.hostname === '__auto__') dev.hostname = nextHostname(d, rolePrefix(opts.role));
      d.devices.push(dev);
      findPage(d, opts.pageId).nodePositions[dev.id] = { ...opts.position };
    },
  };
}

type DeviceFields = Partial<Omit<Device, 'id' | 'createdAt' | 'interfaces'>>;

export function updateDevices(ids: string[], patch: DeviceFields): Command {
  return {
    label: ids.length > 1 ? `Edit ${ids.length} devices` : 'Edit device',
    run: (d) => {
      for (const id of ids) {
        const dev = findDevice(d, id);
        Object.assign(dev, patch);
        stamp(dev);
      }
    },
  };
}

/** Remove devices, links, zones and annotations by id; links on removed devices go too. */
export function removeItems(ids: string[]): Command {
  const set = new Set(ids);
  return {
    label: 'Delete',
    run: (d) => {
      const removedDevices = new Set(d.devices.filter((x) => set.has(x.id)).map((x) => x.id));
      d.devices = d.devices.filter((x) => !removedDevices.has(x.id));
      d.links = d.links.filter(
        (l) =>
          !set.has(l.id) &&
          !removedDevices.has(l.endpointA.deviceId) &&
          !removedDevices.has(l.endpointB.deviceId),
      );
      d.portChannels = d.portChannels.filter((pc) => !removedDevices.has(pc.deviceId) && !set.has(pc.id));
      const removedZones = new Set(d.zones.filter((z) => set.has(z.id)).map((z) => z.id));
      d.zones = d.zones.filter((z) => !removedZones.has(z.id));
      for (const z of d.zones) if (z.parentZoneId && removedZones.has(z.parentZoneId)) delete z.parentZoneId;
      for (const dev of d.devices) if (dev.zoneId && removedZones.has(dev.zoneId)) delete dev.zoneId;
      for (const p of d.pages) {
        for (const id of [...removedDevices, ...removedZones]) {
          delete p.nodePositions[id];
          delete p.zoneBoxes[id];
        }
        p.annotations = p.annotations.filter((a) => !set.has(a.id));
        p.offPageRefs = p.offPageRefs.filter((r) => !removedDevices.has(r.deviceId));
      }
    },
  };
}

/** Move nodes (devices or zones) on a page. Pass the same coalesceKey for one drag gesture. */
export function moveNodes(pageId: string, positions: Record<string, XY>, coalesceKey?: string): Command {
  const cmd: Command = {
    label: 'Move',
    run: (d) => {
      const p = findPage(d, pageId);
      for (const [id, pos] of Object.entries(positions)) {
        if (p.zoneBoxes[id]) {
          const box = p.zoneBoxes[id];
          box.x = pos.x;
          box.y = pos.y;
        } else {
          p.nodePositions[id] = { x: pos.x, y: pos.y };
        }
      }
    },
  };
  if (coalesceKey) cmd.coalesceKey = coalesceKey;
  return cmd;
}

/** Nudge selected nodes by a delta (arrow keys, FR-CAN-05). */
export function nudgeNodes(pageId: string, ids: string[], dx: number, dy: number): Command {
  return {
    label: 'Nudge',
    coalesceKey: `nudge:${pageId}:${ids.join(',')}`,
    run: (d) => {
      const p = findPage(d, pageId);
      for (const id of ids) {
        const pos = p.nodePositions[id];
        if (pos) {
          pos.x += dx;
          pos.y += dy;
        }
        const box = p.zoneBoxes[id];
        if (box) {
          box.x += dx;
          box.y += dy;
        }
        const ann = p.annotations.find((a) => a.id === id);
        if (ann) {
          ann.geometry.x += dx;
          ann.geometry.y += dy;
        }
      }
    },
  };
}

export type AlignMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

/** Align device nodes (FR-CAN-06). Positions are node centers. */
export function alignNodes(pageId: string, ids: string[], mode: AlignMode): Command {
  return {
    label: 'Align',
    run: (d) => {
      const p = findPage(d, pageId);
      const pts = ids.map((id) => p.nodePositions[id]).filter((x): x is XY => !!x);
      if (pts.length < 2) return;
      const xs = pts.map((q) => q.x);
      const ys = pts.map((q) => q.y);
      const target: Record<AlignMode, number> = {
        left: Math.min(...xs),
        right: Math.max(...xs),
        center: (Math.min(...xs) + Math.max(...xs)) / 2,
        top: Math.min(...ys),
        bottom: Math.max(...ys),
        middle: (Math.min(...ys) + Math.max(...ys)) / 2,
      };
      for (const q of pts) {
        if (mode === 'left' || mode === 'right' || mode === 'center') q.x = target[mode];
        else q.y = target[mode];
      }
    },
  };
}

export function distributeNodes(pageId: string, ids: string[], axis: 'horizontal' | 'vertical'): Command {
  return {
    label: 'Distribute',
    run: (d) => {
      const p = findPage(d, pageId);
      const pts = ids.map((id) => p.nodePositions[id]).filter((x): x is XY => !!x);
      if (pts.length < 3) return;
      const k = axis === 'horizontal' ? 'x' : 'y';
      pts.sort((a, b) => a[k] - b[k]);
      const first = pts[0] as XY;
      const last = pts.at(-1) as XY;
      const step = (last[k] - first[k]) / (pts.length - 1);
      pts.forEach((q, i) => {
        q[k] = first[k] + step * i;
      });
    },
  };
}

/** Bulk position update from auto-layout (FR-CAN-14). */
export function applyLayout(pageId: string, positions: Record<string, XY>): Command {
  return { ...moveNodes(pageId, positions), label: 'Auto-layout' };
}

// ---------------------------------------------------------------- interfaces

export function addInterfaces(
  deviceId: string,
  rangeSpec: string,
  extra: Partial<Interface> = {},
): Command & { names: string[] } {
  const names = expandInterfaceRange(rangeSpec);
  return {
    label: names.length > 1 ? `Add ${names.length} interfaces` : 'Add interface',
    names,
    run: (d) => {
      const dev = findDevice(d, deviceId);
      const existing = new Set(dev.interfaces.map((i) => i.name.toLowerCase()));
      for (const n of names) {
        if (existing.has(n.toLowerCase())) continue;
        dev.interfaces.push(makeInterface(deviceId, n, extra));
      }
      stamp(dev);
    },
  };
}

type InterfaceFields = Partial<Omit<Interface, 'id' | 'deviceId' | 'createdAt'>>;

export function updateInterface(deviceId: string, interfaceId: string, patch: InterfaceFields): Command {
  return {
    label: 'Edit interface',
    run: (d) => {
      const dev = findDevice(d, deviceId);
      const iface = dev.interfaces.find((i) => i.id === interfaceId);
      if (!iface) throw new Error(`Interface ${interfaceId} not found`);
      if (patch.name !== undefined) {
        const n = normalizeInterfaceName(patch.name);
        Object.assign(iface, patch, { name: n.name, shortName: n.shortName, type: patch.type ?? n.type });
      } else {
        Object.assign(iface, patch);
      }
      stamp(iface);
    },
  };
}

export function removeInterfaces(deviceId: string, interfaceIds: string[]): Command {
  const set = new Set(interfaceIds);
  return {
    label: 'Delete interface',
    run: (d) => {
      const dev = findDevice(d, deviceId);
      dev.interfaces = dev.interfaces.filter((i) => !set.has(i.id));
      d.links = d.links.filter((l) => !set.has(l.endpointA.interfaceId) && !set.has(l.endpointB.interfaceId));
      for (const pc of d.portChannels)
        pc.memberInterfaceIds = pc.memberInterfaceIds.filter((m) => !set.has(m));
    },
  };
}

/** Assign (replace) the primary IPv4 or IPv6 address of an interface. */
export function assignIp(deviceId: string, interfaceId: string, address: string, prefix: number): Command {
  return {
    label: 'Assign IP',
    run: (d) => {
      const iface = findDevice(d, deviceId).interfaces.find((i) => i.id === interfaceId);
      if (!iface) throw new Error(`Interface ${interfaceId} not found`);
      const list = address.includes(':') ? iface.ipv6 : iface.ipv4;
      const primary = list.findIndex((x) => !x.secondary);
      const entry = { address, prefix, secondary: false };
      if (primary >= 0) list[primary] = entry;
      else list.unshift(entry);
      if (iface.mode === 'unset' || iface.mode === 'access') iface.mode = 'routed';
      stamp(iface);
    },
  };
}

// ---------------------------------------------------------------- links

export interface ConnectEnd {
  deviceId: string;
  /** Interface to use; omitted = next free physical port, or a new one is created. */
  interfaceId?: string;
}

function resolveEnd(d: D, end: ConnectEnd, used: Set<string>): string {
  const dev = findDevice(d, end.deviceId);
  if (end.interfaceId) {
    if (!dev.interfaces.some((i) => i.id === end.interfaceId))
      throw new Error(`Interface ${end.interfaceId} not on ${dev.hostname}`);
    if (used.has(end.interfaceId)) throw new Error(`Interface already linked on ${dev.hostname}`);
    return end.interfaceId;
  }
  const free = dev.interfaces.find((i) => isPhysical(i as Interface) && !used.has(i.id));
  if (free) return free.id;
  // Devices without free ports (clouds, generic shapes) get a new port.
  const n = dev.interfaces.filter((i) => i.type === 'ethernet').length;
  const iface = makeInterface(dev.id, `Ethernet${n}`);
  dev.interfaces.push(iface);
  return iface.id;
}

export function connect(
  a: ConnectEnd,
  b: ConnectEnd,
  medium: LinkMedium = 'copper',
  extra: Partial<Link> = {},
): Command & { linkId: string } {
  const id = newId();
  return {
    label: 'Connect',
    linkId: id,
    run: (d) => {
      if (a.deviceId === b.deviceId && a.interfaceId && a.interfaceId === b.interfaceId)
        throw new Error('Cannot link an interface to itself');
      const used = linkedInterfaceIds(d as NetworkDocument);
      const ia = resolveEnd(d, a, used);
      used.add(ia);
      const ib = resolveEnd(d, b, used);
      const t = nowIso();
      d.links.push({
        id,
        createdAt: t,
        updatedAt: t,
        customFields: {},
        endpointA: { deviceId: a.deviceId, interfaceId: ia },
        endpointB: { deviceId: b.deviceId, interfaceId: ib },
        medium,
        cableId: '',
        label: '',
        circuitId: '',
        provider: '',
        style: {},
        ...extra,
      });
    },
  };
}

type LinkFields = Partial<Omit<Link, 'id' | 'createdAt'>>;

export function updateLinks(ids: string[], patch: LinkFields): Command {
  return {
    label: 'Edit link',
    run: (d) => {
      for (const id of ids) {
        const l = d.links.find((x) => x.id === id);
        if (!l) throw new Error(`Link ${id} not found`);
        Object.assign(l, patch);
        stamp(l);
      }
    },
  };
}

/** Drop a device onto a link: the link is split into two through the device (FR-CAN-09). */
export function insertDeviceOnLink(linkId: string, opts: AddDeviceOptions): Command & { deviceId: string } {
  const add = addDevice(opts);
  return {
    label: 'Insert device on link',
    deviceId: add.deviceId,
    run: (d) => {
      const link = d.links.find((l) => l.id === linkId);
      if (!link) throw new Error(`Link ${linkId} not found`);
      add.run(d);
      const { endpointA, endpointB, medium } = link;
      d.links = d.links.filter((l) => l.id !== linkId);
      connect({ ...endpointA }, { deviceId: add.deviceId }, medium).run(d);
      connect({ deviceId: add.deviceId }, { ...endpointB }, medium).run(d);
    },
  };
}

// ---------------------------------------------------------------- port-channels

export function createPortChannel(
  deviceId: string,
  number: number,
  memberInterfaceIds: string[],
  mode: PortChannel['mode'] = 'lacp-active',
): Command & { portChannelId: string } {
  const pc: PortChannel = { ...base(), deviceId, number, mode, memberInterfaceIds };
  return {
    label: 'Create port-channel',
    portChannelId: pc.id,
    run: (d) => {
      const dev = findDevice(d, deviceId);
      let logical = dev.interfaces.find((i) => i.name.toLowerCase() === `port-channel${number}`);
      if (!logical) {
        const li = makeInterface(deviceId, `Port-channel${number}`);
        dev.interfaces.push(li);
        logical = dev.interfaces.at(-1);
      }
      const entry: PortChannel = { ...pc };
      if (logical) entry.logicalInterfaceId = logical.id;
      d.portChannels.push(entry);
      for (const i of dev.interfaces) if (memberInterfaceIds.includes(i.id)) i.portChannelId = pc.id;
    },
  };
}

// ---------------------------------------------------------------- zones, VLANs, VRFs, subnets

export function addZone(
  pageId: string,
  name: string,
  kind: Zone['kind'],
  box: { x: number; y: number; w: number; h: number },
  parentZoneId?: string,
): Command & { zoneId: string } {
  const zone: Zone = { ...base(), name, kind, color: '#0D9488', description: '' };
  if (parentZoneId) zone.parentZoneId = parentZoneId;
  return {
    label: 'Add zone',
    zoneId: zone.id,
    run: (d) => {
      d.zones.push(zone);
      findPage(d, pageId).zoneBoxes[zone.id] = { ...box };
    },
  };
}

export function updateZone(id: string, patch: Partial<Omit<Zone, 'id' | 'createdAt'>>): Command {
  return {
    label: 'Edit zone',
    run: (d) => {
      const z = d.zones.find((x) => x.id === id);
      if (!z) throw new Error(`Zone ${id} not found`);
      Object.assign(z, patch);
      stamp(z);
    },
  };
}

export function resizeZone(
  pageId: string,
  id: string,
  box: { x: number; y: number; w: number; h: number },
  coalesceKey?: string,
): Command {
  const cmd: Command = {
    label: 'Resize zone',
    run: (d) => {
      findPage(d, pageId).zoneBoxes[id] = { ...box };
    },
  };
  if (coalesceKey) cmd.coalesceKey = coalesceKey;
  return cmd;
}

export function upsertVlan(v: Partial<Vlan> & { number: number }): Command & { vlanId: string } {
  const id = v.id ?? newId();
  return {
    label: 'Edit VLAN',
    vlanId: id,
    run: (d) => {
      const existing = d.vlans.find((x) => x.id === id);
      if (existing) {
        Object.assign(existing, v);
        stamp(existing);
        return;
      }
      if (d.vlans.some((x) => x.number === v.number && (x.site ?? '') === (v.site ?? ''))) {
        throw new Error(`VLAN ${v.number} already exists`);
      }
      const t = nowIso();
      d.vlans.push({
        name: '',
        description: '',
        color: '#2563EB',
        subnetIds: [],
        customFields: {},
        ...v,
        id,
        createdAt: t,
        updatedAt: t,
      });
    },
  };
}

export function removeVlans(ids: string[]): Command {
  return { label: 'Delete VLAN', run: (d) => void (d.vlans = d.vlans.filter((v) => !ids.includes(v.id))) };
}

export function upsertVrf(v: Partial<Vrf> & { name: string }): Command & { vrfId: string } {
  const id = v.id ?? newId();
  return {
    label: 'Edit VRF',
    vrfId: id,
    run: (d) => {
      const existing = d.vrfs.find((x) => x.id === id);
      if (existing) {
        Object.assign(existing, v);
        stamp(existing);
        return;
      }
      const t = nowIso();
      d.vrfs.push({ rd: '', description: '', customFields: {}, ...v, id, createdAt: t, updatedAt: t });
    },
  };
}

export function upsertSubnet(s: Partial<Subnet> & { cidr: string }): Command & { subnetId: string } {
  const id = s.id ?? newId();
  return {
    label: 'Edit subnet',
    subnetId: id,
    run: (d) => {
      const existing = d.subnets.find((x) => x.id === id);
      if (existing) {
        Object.assign(existing, s);
        stamp(existing);
        return;
      }
      const t = nowIso();
      d.subnets.push({
        name: '',
        gatewayIp: '',
        description: '',
        reserved: [],
        customFields: {},
        ...s,
        id,
        createdAt: t,
        updatedAt: t,
      });
    },
  };
}

export function removeSubnets(ids: string[]): Command {
  return {
    label: 'Delete subnet',
    run: (d) => void (d.subnets = d.subnets.filter((s) => !ids.includes(s.id))),
  };
}

// ---------------------------------------------------------------- pages, annotations, settings

export function addPage(name: string): Command & { pageId: string } {
  const page = createPage(name, 0);
  return {
    label: 'Add page',
    pageId: page.id,
    run: (d) => {
      d.pages.push({ ...page, order: Math.max(-1, ...d.pages.map((p) => p.order)) + 1 });
    },
  };
}

export function renamePage(id: string, name: string): Command {
  return { label: 'Rename page', run: (d) => void (findPage(d, id).name = name) };
}

export function removePage(id: string): Command {
  return {
    label: 'Delete page',
    run: (d) => {
      if (d.pages.length <= 1) throw new Error('A document needs at least one page');
      const page = findPage(d, id);
      const ids = new Set(Object.keys(page.nodePositions));
      d.pages = d.pages.filter((p) => p.id !== id);
      // Devices only placed on the removed page are removed with their links.
      const stillPlaced = new Set(d.pages.flatMap((p) => Object.keys(p.nodePositions)));
      const orphans = [...ids].filter((x) => !stillPlaced.has(x));
      removeItems(orphans).run(d);
    },
  };
}

export function addAnnotation(
  pageId: string,
  a: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt' | 'customFields'>,
): Command & { annotationId: string } {
  const ann: Annotation = { ...base(), ...a };
  return {
    label: 'Add annotation',
    annotationId: ann.id,
    run: (d) => void findPage(d, pageId).annotations.push(ann),
  };
}

export function updateAnnotation(
  pageId: string,
  id: string,
  patch: Partial<Omit<Annotation, 'id' | 'createdAt'>>,
  coalesceKey?: string,
): Command {
  const cmd: Command = {
    label: 'Edit annotation',
    run: (d) => {
      const a = findPage(d, pageId).annotations.find((x) => x.id === id);
      if (!a) throw new Error(`Annotation ${id} not found`);
      Object.assign(a, patch);
      stamp(a);
    },
  };
  if (coalesceKey) cmd.coalesceKey = coalesceKey;
  return cmd;
}

export function updateSettings(patch: Partial<DocumentSettings>): Command {
  return { label: 'Change settings', run: (d) => void Object.assign(d.settings, patch) };
}

export function renameDocument(name: string): Command {
  return { label: 'Rename diagram', run: (d) => void (d.name = name) };
}

export function addAsset(mime: string, base64: string): Command & { assetId: string } {
  const id = newId();
  return { label: 'Add image', assetId: id, run: (d) => void (d.assets[id] = { mime, base64 }) };
}

// ---------------------------------------------------------------- clipboard

export interface ClipboardPayload {
  kind: 'linewise-clipboard';
  version: 1;
  devices: Device[];
  links: Link[];
  positions: Record<string, XY>;
}

/** Serialize the selection for copy (FR-CAN-08). Only links between copied devices are kept. */
export function copySelection(doc: NetworkDocument, pageId: string, deviceIds: string[]): ClipboardPayload {
  const ids = new Set(deviceIds);
  const page = doc.pages.find((p) => p.id === pageId);
  const devices = doc.devices.filter((d) => ids.has(d.id));
  const links = doc.links.filter((l) => ids.has(l.endpointA.deviceId) && ids.has(l.endpointB.deviceId));
  const positions: Record<string, XY> = {};
  for (const id of ids) {
    const p = page?.nodePositions[id];
    if (p) positions[id] = { ...p };
  }
  return { kind: 'linewise-clipboard', version: 1, devices, links, positions };
}

/**
 * Paste: new IDs, unique hostnames, IPs cleared (FR-CAN-08), positions offset.
 * Returns the new device IDs so the UI can select them.
 */
export function paste(
  pageId: string,
  payload: ClipboardPayload,
  offset: XY = { x: 40, y: 40 },
): Command & { newDeviceIds: string[] } {
  const idMap = new Map<string, string>();
  const ifaceMap = new Map<string, string>();
  for (const dev of payload.devices) {
    idMap.set(dev.id, newId());
    for (const i of dev.interfaces) ifaceMap.set(i.id, newId());
  }
  const newDeviceIds = payload.devices.map((d) => idMap.get(d.id) as string);
  return {
    label: 'Paste',
    newDeviceIds,
    run: (d) => {
      const page = findPage(d, pageId);
      const t = nowIso();
      for (const dev of payload.devices) {
        const id = idMap.get(dev.id) as string;
        const copy: Device = {
          ...structuredClone(dev),
          id,
          createdAt: t,
          updatedAt: t,
          hostname: copyHostname(d, dev.hostname),
          mgmtIp: '',
          serial: '',
          interfaces: dev.interfaces.map((i) => ({
            ...structuredClone(i),
            id: ifaceMap.get(i.id) as string,
            deviceId: id,
            ipv4: [],
            ipv6: [],
            createdAt: t,
            updatedAt: t,
          })),
        };
        delete copy.zoneId;
        for (const i of copy.interfaces) delete i.portChannelId;
        d.devices.push(copy);
        const pos = payload.positions[dev.id] ?? { x: 0, y: 0 };
        page.nodePositions[id] = { x: pos.x + offset.x, y: pos.y + offset.y };
      }
      for (const l of payload.links) {
        d.links.push({
          ...structuredClone(l),
          id: newId(),
          createdAt: t,
          updatedAt: t,
          endpointA: {
            deviceId: idMap.get(l.endpointA.deviceId) as string,
            interfaceId: ifaceMap.get(l.endpointA.interfaceId) as string,
          },
          endpointB: {
            deviceId: idMap.get(l.endpointB.deviceId) as string,
            interfaceId: ifaceMap.get(l.endpointB.interfaceId) as string,
          },
        });
      }
    },
  };
}

/** Run several commands as one undo step (imports, multi-step actions). */
export function batch(label: string, commands: Command[]): Command {
  return { label, run: (d) => commands.forEach((c) => c.run(d)) };
}
