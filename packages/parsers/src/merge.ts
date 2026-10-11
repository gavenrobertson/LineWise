// SPDX-License-Identifier: Apache-2.0
/**
 * Import preview and merge (FR-IMP-21, FR-IMP-23). Parse results from many
 * files are combined into an ImportPlan the user reviews; applying it is one
 * Command, so the whole import is a single undo step.
 */
import {
  createDevice,
  isPhysical,
  linkedInterfaceIds,
  makeInterface,
  newId,
  normalizeInterfaceName,
  nowIso,
  vlanColorAt,
  type Command,
  type Device,
  type DeviceRole,
  type Interface,
  type NetworkDocument,
  type PortChannel,
} from '@linewise/core';
import type { Draft } from 'immer';
import type { ParseResult, ParsedDevice, ParsedInterface, ParsedLink } from './types.ts';

export interface PlanDevice {
  key: string;
  action: 'create' | 'update';
  existingId?: string;
  hostname: string;
  role: DeviceRole;
  parsed: ParsedDevice;
  changes: string[];
  selected: boolean;
}

export interface PlanLink {
  key: string;
  action: 'create' | 'exists' | 'conflict';
  a: { hostname: string; iface?: string };
  b: { hostname: string; iface?: string };
  medium?: ParsedLink['medium'];
  label?: string;
  reason?: string;
  selected: boolean;
}

export interface ImportPlan {
  devices: PlanDevice[];
  links: PlanLink[];
  vlans: { number: number; name: string; action: 'create' | 'exists' }[];
  vrfs: { name: string; rd?: string; action: 'create' | 'exists' }[];
  annotations: ParseResult['annotations'];
  warnings: string[];
  unparsed: { source: string; lines: ParseResult['unparsedLines'] }[];
}

const key = (h: string) => h.trim().toLowerCase();
const nName = (n: string) => normalizeInterfaceName(n).name.toLowerCase();

function mergeInterface(into: ParsedInterface, from: ParsedInterface): void {
  for (const [k, v] of Object.entries(from)) {
    if (v === undefined || k === 'name') continue;
    if (k === 'ipv4' || k === 'ipv6') {
      const list = (into[k] ??= []);
      for (const ip of v as { address: string }[])
        if (!list.some((x) => x.address === ip.address)) list.push(ip as never);
    } else {
      (into as unknown as Record<string, unknown>)[k] = v;
    }
  }
}

function mergeDevice(into: ParsedDevice, from: ParsedDevice): void {
  for (const k of ['role', 'platform', 'vendor', 'model', 'osVersion', 'serial', 'site', 'mgmtIp'] as const) {
    if (from[k] !== undefined && (into[k] === undefined || into[k] === ''))
      (into as unknown as Record<string, unknown>)[k] = from[k];
  }
  // A running-config's role guess is better than a neighbor's capability guess.
  if (from.role && from.interfaces.some((i) => i.mode || i.ipv4?.length)) into.role = from.role;
  for (const i of from.interfaces) {
    const existing = into.interfaces.find((x) => nName(x.name) === nName(i.name));
    if (existing) mergeInterface(existing, i);
    else into.interfaces.push({ ...i });
  }
  if (from.routing?.length)
    into.routing = [
      ...(into.routing ?? []),
      ...from.routing.filter(
        (r) => !into.routing?.some((x) => x.protocol === r.protocol && x.value === r.value),
      ),
    ];
  into.position ??= from.position;
}

function findExisting(doc: NetworkDocument, d: ParsedDevice): Device | undefined {
  return (
    doc.devices.find((x) => key(x.hostname) === key(d.hostname)) ??
    (d.serial ? doc.devices.find((x) => x.serial && x.serial === d.serial) : undefined) ??
    (d.mgmtIp ? doc.devices.find((x) => x.mgmtIp && x.mgmtIp === d.mgmtIp) : undefined)
  );
}

function describeChanges(existing: Device | undefined, d: ParsedDevice): string[] {
  const out: string[] = [];
  const known = new Set(existing?.interfaces.map((i) => i.name.toLowerCase()) ?? []);
  const newIfs = d.interfaces.filter((i) => !known.has(nName(i.name))).length;
  const updIfs = d.interfaces.length - newIfs;
  if (newIfs) out.push(`${newIfs} new interface${newIfs > 1 ? 's' : ''}`);
  if (existing && updIfs) out.push(`${updIfs} interface${updIfs > 1 ? 's' : ''} updated`);
  const ips = d.interfaces.reduce((n, i) => n + (i.ipv4?.length ?? 0) + (i.ipv6?.length ?? 0), 0);
  if (ips) out.push(`${ips} address${ips > 1 ? 'es' : ''}`);
  if (d.mgmtIp && d.mgmtIp !== existing?.mgmtIp) out.push(`mgmt ${d.mgmtIp}`);
  if (d.model && d.model !== existing?.model) out.push(d.model);
  return out;
}

export function buildImportPlan(
  doc: NetworkDocument,
  results: { source: string; result: ParseResult }[],
): ImportPlan {
  const plan: ImportPlan = {
    devices: [],
    links: [],
    vlans: [],
    vrfs: [],
    annotations: [],
    warnings: [],
    unparsed: [],
  };
  const merged = new Map<string, ParsedDevice>();
  const rawLinks: ParsedLink[] = [];
  for (const { source, result } of results) {
    for (const w of result.warnings) plan.warnings.push(`${source}: ${w}`);
    if (result.unparsedLines.length) plan.unparsed.push({ source, lines: result.unparsedLines });
    for (const d of result.devices) {
      if (!d.hostname) continue;
      const k = key(d.hostname);
      const cur = merged.get(k);
      if (cur) mergeDevice(cur, d);
      else merged.set(k, structuredClone(d));
    }
    rawLinks.push(...result.links);
    for (const v of result.vlans) {
      const existing = plan.vlans.find((x) => x.number === v.number);
      if (existing) existing.name ||= v.name;
      else
        plan.vlans.push({ ...v, action: doc.vlans.some((x) => x.number === v.number) ? 'exists' : 'create' });
    }
    for (const v of result.vrfs) {
      if (!plan.vrfs.some((x) => x.name === v.name)) {
        const entry: ImportPlan['vrfs'][number] = {
          name: v.name,
          action: doc.vrfs.some((x) => x.name === v.name) ? 'exists' : 'create',
        };
        if (v.rd) entry.rd = v.rd;
        plan.vrfs.push(entry);
      }
    }
    plan.annotations.push(...result.annotations);
  }

  for (const [k, d] of merged) {
    const existing = findExisting(doc, d);
    const entry: PlanDevice = {
      key: k,
      action: existing ? 'update' : 'create',
      hostname: existing?.hostname ?? d.hostname,
      role: d.role ?? existing?.role ?? 'generic',
      parsed: d,
      changes: describeChanges(existing, d),
      selected: true,
    };
    if (existing) entry.existingId = existing.id;
    plan.devices.push(entry);
  }

  // De-duplicate links seen from both sides (FR-IMP-23).
  const endKey = (h: string, i?: string) => `${key(h)}|${i ? nName(i) : '?'}`;
  const seen = new Map<string, PlanLink>();
  const knownEnds = new Set<string>();
  for (const l of rawLinks) {
    if (l.a.iface) knownEnds.add(endKey(l.a.hostname, l.a.iface));
    if (l.b.iface) knownEnds.add(endKey(l.b.hostname, l.b.iface));
  }
  for (const l of rawLinks) {
    const ka = endKey(l.a.hostname, l.a.iface);
    const kb = endKey(l.b.hostname, l.b.iface);
    const k = [ka, kb].sort().join('<>');
    if (seen.has(k)) continue;
    // A partial entry (one side unknown) duplicates a complete one sharing its known end.
    const partialDup = [...seen.values()].some((p) => {
      const pa = endKey(p.a.hostname, p.a.iface);
      const pb = endKey(p.b.hostname, p.b.iface);
      const hostsMatch =
        [key(p.a.hostname), key(p.b.hostname)].sort().join() ===
        [key(l.a.hostname), key(l.b.hostname)].sort().join();
      return (
        hostsMatch &&
        (pa === ka || pa === kb || pb === ka || pb === kb) &&
        (ka.endsWith('|?') || kb.endsWith('|?') || pa.endsWith('|?') || pb.endsWith('|?'))
      );
    });
    if (partialDup) continue;
    const pl: PlanLink = { key: k, action: 'create', a: { ...l.a }, b: { ...l.b }, selected: true };
    if (l.medium) pl.medium = l.medium;
    if (l.label) pl.label = l.label;
    seen.set(k, pl);
  }
  void knownEnds;

  // Compare with links already in the document.
  const linked = linkedInterfaceIds(doc);
  const devByHost = new Map(doc.devices.map((d) => [key(d.hostname), d]));
  for (const pl of seen.values()) {
    const da = devByHost.get(key(pl.a.hostname));
    const db = devByHost.get(key(pl.b.hostname));
    const ia = pl.a.iface
      ? da?.interfaces.find((i) => i.name.toLowerCase() === nName(pl.a.iface as string))
      : undefined;
    const ib = pl.b.iface
      ? db?.interfaces.find((i) => i.name.toLowerCase() === nName(pl.b.iface as string))
      : undefined;
    if (ia && ib) {
      const same = doc.links.some(
        (l) =>
          (l.endpointA.interfaceId === ia.id && l.endpointB.interfaceId === ib.id) ||
          (l.endpointA.interfaceId === ib.id && l.endpointB.interfaceId === ia.id),
      );
      if (same) {
        pl.action = 'exists';
        pl.selected = false;
        pl.reason = 'Already in the diagram';
        continue;
      }
    }
    if ((ia && linked.has(ia.id)) || (ib && linked.has(ib.id))) {
      pl.action = 'conflict';
      pl.selected = false;
      pl.reason = 'An interface is already linked to something else';
    }
  }
  plan.links = [...seen.values()];
  plan.devices.sort((a, b) => a.hostname.localeCompare(b.hostname, undefined, { numeric: true }));
  return plan;
}

// ------------------------------------------------------------------ apply

type D = Draft<NetworkDocument>;
type XY = { x: number; y: number };

function applyInterfaceFields(
  i: Draft<Interface>,
  p: ParsedInterface,
  vrfIdByName: Map<string, string>,
): void {
  const t = nowIso();
  if (p.description !== undefined) i.description = p.description;
  if (p.enabled !== undefined) i.enabled = p.enabled;
  if (p.mode !== undefined) i.mode = p.mode;
  if (p.accessVlan !== undefined) i.accessVlan = p.accessVlan;
  if (p.nativeVlan !== undefined) i.nativeVlan = p.nativeVlan;
  if (p.allowedVlans !== undefined) i.allowedVlans = p.allowedVlans;
  if (p.ipv4?.length)
    i.ipv4 = p.ipv4.map((x) => ({ address: x.address, prefix: x.prefix, secondary: Boolean(x.secondary) }));
  if (p.ipv6?.length)
    i.ipv6 = p.ipv6.map((x) => ({ address: x.address, prefix: x.prefix, secondary: Boolean(x.secondary) }));
  if (p.vrf && vrfIdByName.has(p.vrf)) i.vrfId = vrfIdByName.get(p.vrf) as string;
  if (p.speedMbps !== undefined) i.speedMbps = p.speedMbps;
  if (p.duplex !== undefined) i.duplex = p.duplex;
  if (p.media !== undefined) i.media = p.media;
  if (p.dot1q !== undefined) i.dot1q = p.dot1q;
  if (p.mtu !== undefined) i.mtu = p.mtu;
  if (p.fhrp?.vip) i.fhrp = { ...p.fhrp };
  i.updatedAt = t;
}

export interface ApplyOptions {
  pageId: string;
  /** Positions for new devices by plan key (from the layout worker). */
  positions?: Record<string, XY>;
  /** Top-left corner for devices without a position. */
  origin?: XY;
}

/** Build the single undoable Command that applies the selected parts of a plan. */
export function applyImportPlan(
  plan: ImportPlan,
  opts: ApplyOptions,
): Command & { createdDeviceIds: string[] } {
  const createdDeviceIds: string[] = [];
  const preIds = new Map(
    plan.devices.filter((d) => d.selected && d.action === 'create').map((d) => [d.key, newId()]),
  );
  createdDeviceIds.push(...preIds.values());
  return {
    label: 'Import',
    createdDeviceIds,
    run: (d: D) => {
      const page = d.pages.find((p) => p.id === opts.pageId);
      if (!page) throw new Error('Page not found');
      const t = nowIso();
      // VRFs and VLANs first, so interfaces can reference them.
      const vrfIdByName = new Map(d.vrfs.map((v) => [v.name, v.id]));
      for (const v of plan.vrfs) {
        if (vrfIdByName.has(v.name)) continue;
        const id = newId();
        d.vrfs.push({
          id,
          createdAt: t,
          updatedAt: t,
          customFields: {},
          name: v.name,
          rd: v.rd ?? '',
          description: '',
        });
        vrfIdByName.set(v.name, id);
      }
      for (const v of plan.vlans) {
        if (d.vlans.some((x) => x.number === v.number)) continue;
        d.vlans.push({
          id: newId(),
          createdAt: t,
          updatedAt: t,
          customFields: {},
          number: v.number,
          name: v.name,
          description: '',
          color: vlanColorAt(d.vlans.length),
          subnetIds: [],
        });
      }

      const origin = opts.origin ?? { x: 0, y: 0 };
      let gridIdx = 0;
      const byKey = new Map<string, Draft<Device>>();
      for (const dev of d.devices) byKey.set(key(dev.hostname), dev);

      for (const pd of plan.devices) {
        if (!pd.selected) continue;
        let dev: Draft<Device> | undefined;
        if (pd.action === 'update' && pd.existingId) {
          dev = d.devices.find((x) => x.id === pd.existingId);
          if (!dev) continue;
          const p = pd.parsed;
          for (const k of ['vendor', 'model', 'platform', 'osVersion', 'serial', 'site', 'mgmtIp'] as const) {
            const v = p[k];
            if (v && !dev[k]) dev[k] = v;
          }
          if (p.role && dev.role === 'generic') dev.role = p.role;
          dev.updatedAt = t;
        } else {
          const id = preIds.get(pd.key) as string;
          const fresh = createDevice(pd.role, pd.parsed.hostname, { id });
          for (const k of ['vendor', 'model', 'platform', 'osVersion', 'serial', 'site', 'mgmtIp'] as const) {
            const v = pd.parsed[k];
            if (v) fresh[k] = v;
          }
          d.devices.push(fresh);
          dev = d.devices.at(-1) as Draft<Device>;
          const pos =
            opts.positions?.[pd.key] ??
            (pd.parsed.position
              ? { x: origin.x + pd.parsed.position.x, y: origin.y + pd.parsed.position.y }
              : { x: origin.x + (gridIdx % 6) * 180, y: origin.y + Math.floor(gridIdx / 6) * 160 });
          gridIdx++;
          page.nodePositions[id] = pos;
        }
        byKey.set(key(dev.hostname), dev);
        byKey.set(pd.key, dev);
        for (const r of pd.parsed.routing ?? [])
          if (!dev.routing.some((x) => x.protocol === r.protocol && x.value === r.value))
            dev.routing.push({ ...r });
        for (const pi of pd.parsed.interfaces) {
          let iface = dev.interfaces.find((x) => x.name.toLowerCase() === nName(pi.name));
          if (!iface) {
            dev.interfaces.push(makeInterface(dev.id, pi.name));
            iface = dev.interfaces.at(-1) as Draft<Interface>;
          }
          applyInterfaceFields(iface, pi, vrfIdByName);
        }
        // Port-channels from channel-group membership.
        const groups = new Map<number, { ids: string[]; mode: PortChannel['mode'] }>();
        for (const pi of pd.parsed.interfaces) {
          if (!pi.channelGroup) continue;
          const iface = dev.interfaces.find((x) => x.name.toLowerCase() === nName(pi.name));
          if (!iface) continue;
          const g = groups.get(pi.channelGroup.number) ?? { ids: [], mode: pi.channelGroup.mode };
          g.ids.push(iface.id);
          groups.set(pi.channelGroup.number, g);
        }
        for (const [num, g] of groups) {
          let pc = d.portChannels.find((x) => x.deviceId === dev.id && x.number === num);
          if (!pc) {
            let logical = dev.interfaces.find((x) => x.name.toLowerCase() === `port-channel${num}`);
            if (!logical) {
              dev.interfaces.push(makeInterface(dev.id, `Port-channel${num}`));
              logical = dev.interfaces.at(-1);
            }
            const entry: PortChannel = {
              id: newId(),
              createdAt: t,
              updatedAt: t,
              customFields: {},
              deviceId: dev.id,
              number: num,
              mode: g.mode,
              memberInterfaceIds: [],
            };
            if (logical) entry.logicalInterfaceId = logical.id;
            d.portChannels.push(entry);
            pc = d.portChannels.at(-1);
          }
          if (!pc) continue;
          for (const id of g.ids) if (!pc.memberInterfaceIds.includes(id)) pc.memberInterfaceIds.push(id);
          for (const i of dev.interfaces) if (g.ids.includes(i.id)) i.portChannelId = pc.id;
        }
      }

      // Links.
      const used = linkedInterfaceIds(d as NetworkDocument);
      const resolveEnd = (end: {
        hostname: string;
        iface?: string;
      }): { deviceId: string; interfaceId: string } | null => {
        const dev = byKey.get(key(end.hostname));
        if (!dev) return null;
        let iface: Draft<Interface> | undefined;
        if (end.iface) {
          iface = dev.interfaces.find((x) => x.name.toLowerCase() === nName(end.iface as string));
          if (!iface) {
            dev.interfaces.push(makeInterface(dev.id, end.iface));
            iface = dev.interfaces.at(-1);
          }
        } else {
          iface = dev.interfaces.find((x) => isPhysical(x as Interface) && !used.has(x.id));
          if (!iface) {
            dev.interfaces.push(makeInterface(dev.id, `Ethernet${dev.interfaces.length}`));
            iface = dev.interfaces.at(-1);
          }
        }
        if (!iface || used.has(iface.id)) return null;
        return { deviceId: dev.id, interfaceId: iface.id };
      };
      for (const pl of plan.links) {
        if (!pl.selected || pl.action === 'exists') continue;
        const a = resolveEnd(pl.a);
        if (!a) continue;
        used.add(a.interfaceId);
        const b = resolveEnd(pl.b);
        if (!b) {
          used.delete(a.interfaceId);
          continue;
        }
        used.add(b.interfaceId);
        d.links.push({
          id: newId(),
          createdAt: t,
          updatedAt: t,
          customFields: {},
          endpointA: a,
          endpointB: b,
          medium: pl.medium ?? 'copper',
          cableId: '',
          label: pl.label ?? '',
          circuitId: '',
          provider: '',
          style: {},
        });
      }

      for (const a of plan.annotations) {
        page.annotations.push({
          id: newId(),
          createdAt: t,
          updatedAt: t,
          customFields: {},
          kind: 'text',
          geometry: { x: origin.x + a.x, y: origin.y + a.y, w: a.w, h: a.h, rotation: 0 },
          style: {},
          text: a.text,
          locked: false,
        });
      }
    },
  };
}
