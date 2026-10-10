// SPDX-License-Identifier: Apache-2.0
/**
 * Network validation (spec section 7). Rules are pure functions over the
 * model, registered in a plugin-style registry (FR-VAL-04). Issues and quick
 * fixes are plain data so they can cross a Web Worker boundary; `applyFix`
 * turns a fix into a Command on the main thread.
 */
import { batch, assignIp, updateInterface, upsertVlan } from './commands.ts';
import type { Command } from './history.ts';
import {
  cidrContains,
  cidrsOverlap,
  isNetworkOrBroadcast,
  isValidCidr,
  isValidIp,
  parseCidr,
  sameSubnet,
  utilization,
} from './ip.ts';
import { formatVlanList, parseVlanList } from './naming.ts';
import { resolveLinks, type LinkEnds } from './selectors.ts';
import type { Device, Interface, NetworkDocument } from './schema.ts';
import { isPhysical } from './document.ts';

export type Severity = 'error' | 'warning' | 'info';

export type QuickFix =
  | { kind: 'set-trunk'; label: string; ends: { deviceId: string; interfaceId: string }[] }
  | { kind: 'set-allowed'; label: string; ends: { deviceId: string; interfaceId: string }[]; allowed: string }
  | { kind: 'set-native'; label: string; ends: { deviceId: string; interfaceId: string }[]; vlan: number }
  | { kind: 'set-access-vlan'; label: string; end: { deviceId: string; interfaceId: string }; vlan: number }
  | { kind: 'create-vlan'; label: string; vlan: number }
  | {
      kind: 'assign-ip';
      label: string;
      end: { deviceId: string; interfaceId: string };
      address: string;
      prefix: number;
    };

export interface Issue {
  ruleId: string;
  severity: Severity;
  message: string;
  /** Devices, interfaces, links or subnets involved; clicking the issue selects them. */
  objectIds: string[];
  fixes: QuickFix[];
}

export interface RuleContext {
  doc: NetworkDocument;
  ends: LinkEnds[];
  /** interface id → owning device */
  deviceOf: Map<string, Device>;
  /** interface id → number of physical links using it */
  linkCount: Map<string, number>;
  /** interface id → the link ends record it participates in */
  linkOf: Map<string, LinkEnds>;
}

export interface Rule {
  id: string;
  severity: Severity;
  title: string;
  run: (ctx: RuleContext) => Omit<Issue, 'ruleId' | 'severity'>[];
}

const registry = new Map<string, Rule>();

export function registerRule(rule: Rule): void {
  registry.set(rule.id, rule);
}

export function listRules(): Rule[] {
  return [...registry.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function buildContext(doc: NetworkDocument): RuleContext {
  const ends = resolveLinks(doc);
  const deviceOf = new Map<string, Device>();
  for (const d of doc.devices) for (const i of d.interfaces) deviceOf.set(i.id, d);
  const linkCount = new Map<string, number>();
  const linkOf = new Map<string, LinkEnds>();
  for (const e of ends) {
    for (const i of [e.a.iface.id, e.b.iface.id]) {
      linkCount.set(i, (linkCount.get(i) ?? 0) + 1);
      linkOf.set(i, e);
    }
  }
  return { doc, ends, deviceOf, linkCount, linkOf };
}

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

/** Run every enabled rule (FR-VAL-01/02). Suppressed issues are returned separately. */
export function validate(doc: NetworkDocument): { issues: Issue[]; suppressed: Issue[] } {
  const ctx = buildContext(doc);
  const disabled = new Set(doc.settings.disabledRules);
  const issues: Issue[] = [];
  const suppressed: Issue[] = [];
  for (const rule of listRules()) {
    if (disabled.has(rule.id)) continue;
    for (const raw of rule.run(ctx)) {
      const issue: Issue = { ruleId: rule.id, severity: rule.severity, ...raw };
      const isSuppressed = doc.settings.suppressions.some(
        (s) => s.ruleId === rule.id && sameIds(s.objectIds, issue.objectIds),
      );
      (isSuppressed ? suppressed : issues).push(issue);
    }
  }
  const order: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
  issues.sort((a, b) => order[a.severity] - order[b.severity] || a.ruleId.localeCompare(b.ruleId));
  return { issues, suppressed };
}

/** Turn a quick fix into a single undoable command. */
export function applyFix(fix: QuickFix): Command {
  switch (fix.kind) {
    case 'set-trunk':
      return batch(
        fix.label,
        fix.ends.map((e) => updateInterface(e.deviceId, e.interfaceId, { mode: 'trunk' })),
      );
    case 'set-allowed':
      return batch(
        fix.label,
        fix.ends.map((e) => updateInterface(e.deviceId, e.interfaceId, { allowedVlans: fix.allowed })),
      );
    case 'set-native':
      return batch(
        fix.label,
        fix.ends.map((e) => updateInterface(e.deviceId, e.interfaceId, { nativeVlan: fix.vlan })),
      );
    case 'set-access-vlan':
      return {
        ...updateInterface(fix.end.deviceId, fix.end.interfaceId, { accessVlan: fix.vlan }),
        label: fix.label,
      };
    case 'create-vlan':
      return { ...upsertVlan({ number: fix.vlan, name: `VLAN${fix.vlan}` }), label: fix.label };
    case 'assign-ip':
      return {
        ...assignIp(fix.end.deviceId, fix.end.interfaceId, fix.address, fix.prefix),
        label: fix.label,
      };
  }
}

// ------------------------------------------------------------------ helpers

const name = (ctx: RuleContext, i: Interface) => `${ctx.deviceOf.get(i.id)?.hostname ?? '?'} ${i.shortName}`;
const endRef = (e: { device: Device; iface: Interface }) => ({
  deviceId: e.device.id,
  interfaceId: e.iface.id,
});
const primary4 = (i: Interface) => i.ipv4.find((x) => !x.secondary);

function allowedSet(i: Interface): Set<number> | null {
  if (!i.allowedVlans.trim()) return null;
  try {
    return new Set(parseVlanList(i.allowedVlans));
  } catch {
    return new Set();
  }
}

const MANAGED_ROLES = new Set([
  'router',
  'l2-switch',
  'l3-switch',
  'firewall',
  'wlc',
  'access-point',
  'load-balancer',
  'vpn-concentrator',
  'ids-ips',
]);

// ------------------------------------------------------------------ rules

registerRule({
  id: 'VAL-001',
  severity: 'error',
  title: 'Duplicate IP address',
  run: (ctx) => {
    const seen = new Map<string, Interface[]>();
    for (const d of ctx.doc.devices) {
      for (const i of d.interfaces) {
        for (const a of [...i.ipv4, ...i.ipv6]) {
          if (!isValidIp(a.address)) continue;
          const key = `${i.vrfId ?? 'global'}|${a.address.toLowerCase()}`;
          seen.set(key, [...(seen.get(key) ?? []), i]);
        }
      }
    }
    return [...seen.entries()]
      .filter(([, list]) => list.length > 1)
      .map(([key, list]) => ({
        message: `${key.split('|')[1]} is assigned to ${list.length} interfaces: ${list.map((i) => name(ctx, i)).join(', ')}`,
        objectIds: list.map((i) => i.id),
        fixes: [],
      }));
  },
});

registerRule({
  id: 'VAL-002',
  severity: 'error',
  title: 'Link endpoints in different subnets',
  run: (ctx) =>
    ctx.ends.flatMap((e) => {
      const a = primary4(e.a.iface);
      const b = primary4(e.b.iface);
      if (!a || !b || !isValidIp(a.address) || !isValidIp(b.address)) return [];
      if (sameSubnet(a.address, a.prefix, b.address, b.prefix)) return [];
      const fixes: QuickFix[] = [];
      try {
        const net = parseCidr(`${a.address}/${a.prefix}`);
        const candidate = (() => {
          // Next address after A's within A's subnet that is not A itself.
          const parts = a.address.split('.').map(Number);
          if (parts.length !== 4) return null;
          for (let delta = 1; delta < 256; delta++) {
            const n =
              ((parts[0] ?? 0) << 24) +
              ((parts[1] ?? 0) << 16) +
              ((parts[2] ?? 0) << 8) +
              (parts[3] ?? 0) +
              delta;
            const ip = [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
            if (cidrContains(net, ip) && !isNetworkOrBroadcast(ip, a.prefix)) return ip;
          }
          return null;
        })();
        if (candidate) {
          fixes.push({
            kind: 'assign-ip',
            label: `Set ${name(ctx, e.b.iface)} to ${candidate}/${a.prefix}`,
            end: endRef(e.b),
            address: candidate,
            prefix: a.prefix,
          });
        }
      } catch {
        // invalid prefix: VAL-003 reports it
      }
      return [
        {
          message: `${name(ctx, e.a.iface)} (${a.address}/${a.prefix}) and ${name(ctx, e.b.iface)} (${b.address}/${b.prefix}) are not in the same subnet`,
          objectIds: [e.link.id, e.a.iface.id, e.b.iface.id],
          fixes,
        },
      ];
    }),
});

registerRule({
  id: 'VAL-003',
  severity: 'error',
  title: 'Invalid interface address',
  run: (ctx) => {
    const out: Omit<Issue, 'ruleId' | 'severity'>[] = [];
    for (const d of ctx.doc.devices) {
      for (const i of d.interfaces) {
        for (const a of i.ipv4) {
          if (!isValidIp(a.address) || a.address.includes(':') || a.prefix > 32) {
            out.push({
              message: `${name(ctx, i)} has an invalid IPv4 address ${a.address}/${a.prefix}`,
              objectIds: [i.id],
              fixes: [],
            });
          } else if (isNetworkOrBroadcast(a.address, a.prefix)) {
            out.push({
              message: `${name(ctx, i)} uses the network or broadcast address ${a.address}/${a.prefix}`,
              objectIds: [i.id],
              fixes: [],
            });
          }
        }
        for (const a of i.ipv6) {
          if (!isValidIp(a.address) || !a.address.includes(':') || a.prefix > 128) {
            out.push({
              message: `${name(ctx, i)} has an invalid IPv6 address ${a.address}/${a.prefix}`,
              objectIds: [i.id],
              fixes: [],
            });
          }
        }
      }
    }
    return out;
  },
});

registerRule({
  id: 'VAL-004',
  severity: 'error',
  title: 'Overlapping subnets',
  run: (ctx) => {
    const subs = ctx.doc.subnets.filter((s) => isValidCidr(s.cidr));
    const out: Omit<Issue, 'ruleId' | 'severity'>[] = [];
    for (let i = 0; i < subs.length; i++) {
      for (let j = i + 1; j < subs.length; j++) {
        const a = subs[i];
        const b = subs[j];
        if (!a || !b || (a.vrfId ?? '') !== (b.vrfId ?? '')) continue;
        if (cidrsOverlap(parseCidr(a.cidr), parseCidr(b.cidr))) {
          out.push({
            message: `Subnets ${a.cidr} and ${b.cidr} overlap`,
            objectIds: [a.id, b.id],
            fixes: [],
          });
        }
      }
    }
    return out;
  },
});

registerRule({
  id: 'VAL-005',
  severity: 'error',
  title: 'Interface used by more than one link',
  run: (ctx) => {
    const out: Omit<Issue, 'ruleId' | 'severity'>[] = [];
    for (const [ifaceId, count] of ctx.linkCount) {
      if (count < 2) continue;
      const d = ctx.deviceOf.get(ifaceId);
      const i = d?.interfaces.find((x) => x.id === ifaceId);
      if (!i) continue;
      const links = ctx.ends
        .filter((e) => e.a.iface.id === ifaceId || e.b.iface.id === ifaceId)
        .map((e) => e.link.id);
      out.push({
        message: `${name(ctx, i)} is used by ${count} links`,
        objectIds: [ifaceId, ...links],
        fixes: [],
      });
    }
    return out;
  },
});

registerRule({
  id: 'VAL-006',
  severity: 'warning',
  title: 'Duplicate hostname',
  run: (ctx) => {
    const groups = new Map<string, Device[]>();
    for (const d of ctx.doc.devices) {
      const k = d.hostname.trim().toLowerCase();
      groups.set(k, [...(groups.get(k) ?? []), d]);
    }
    return [...groups.values()]
      .filter((g) => g.length > 1)
      .map((g) => ({
        message: `Hostname "${g[0]?.hostname}" is used by ${g.length} devices`,
        objectIds: g.map((d) => d.id),
        fixes: [],
      }));
  },
});

registerRule({
  id: 'VAL-007',
  severity: 'warning',
  title: 'Trunk on one end, access on the other',
  run: (ctx) =>
    ctx.ends.flatMap((e) => {
      const modes = [e.a.iface.mode, e.b.iface.mode];
      if (!(modes.includes('trunk') && modes.includes('access'))) return [];
      return [
        {
          message: `${name(ctx, e.a.iface)} is ${e.a.iface.mode} but ${name(ctx, e.b.iface)} is ${e.b.iface.mode}`,
          objectIds: [e.link.id, e.a.iface.id, e.b.iface.id],
          fixes: [{ kind: 'set-trunk', label: 'Set both ends to trunk', ends: [endRef(e.a), endRef(e.b)] }],
        },
      ];
    }),
});

registerRule({
  id: 'VAL-008',
  severity: 'warning',
  title: 'Native VLAN mismatch',
  run: (ctx) =>
    ctx.ends.flatMap((e) => {
      if (e.a.iface.mode !== 'trunk' || e.b.iface.mode !== 'trunk') return [];
      const na = e.a.iface.nativeVlan ?? 1;
      const nb = e.b.iface.nativeVlan ?? 1;
      if (na === nb) return [];
      return [
        {
          message: `Native VLAN ${na} on ${name(ctx, e.a.iface)} does not match native VLAN ${nb} on ${name(ctx, e.b.iface)}`,
          objectIds: [e.link.id, e.a.iface.id, e.b.iface.id],
          fixes: [
            {
              kind: 'set-native',
              label: `Use native VLAN ${na} on both ends`,
              ends: [endRef(e.a), endRef(e.b)],
              vlan: na,
            },
          ],
        },
      ];
    }),
});

registerRule({
  id: 'VAL-009',
  severity: 'warning',
  title: 'Allowed VLANs differ across a trunk',
  run: (ctx) =>
    ctx.ends.flatMap((e) => {
      if (e.a.iface.mode !== 'trunk' || e.b.iface.mode !== 'trunk') return [];
      const sa = allowedSet(e.a.iface);
      const sb = allowedSet(e.b.iface);
      if (sa === null && sb === null) return [];
      const all = new Set(Array.from({ length: 4094 }, (_, k) => k + 1));
      const A = sa ?? all;
      const B = sb ?? all;
      const onlyA = [...A].filter((v) => !B.has(v));
      const onlyB = [...B].filter((v) => !A.has(v));
      if (!onlyA.length && !onlyB.length) return [];
      const union = formatVlanList([...A, ...B]);
      const parts: string[] = [];
      if (onlyA.length) parts.push(`only on ${name(ctx, e.a.iface)}: ${formatVlanList(onlyA)}`);
      if (onlyB.length) parts.push(`only on ${name(ctx, e.b.iface)}: ${formatVlanList(onlyB)}`);
      return [
        {
          message: `Allowed VLANs differ (${parts.join('; ')})`,
          objectIds: [e.link.id, e.a.iface.id, e.b.iface.id],
          fixes: [
            {
              kind: 'set-allowed',
              label: `Allow ${union.length > 40 ? 'the combined list' : union} on both ends`,
              ends: [endRef(e.a), endRef(e.b)],
              allowed: sa === null || sb === null ? '' : union,
            },
          ],
        },
      ];
    }),
});

registerRule({
  id: 'VAL-010',
  severity: 'warning',
  title: 'Access VLAN mismatch',
  run: (ctx) =>
    ctx.ends.flatMap((e) => {
      if (e.a.iface.mode !== 'access' || e.b.iface.mode !== 'access') return [];
      const va = e.a.iface.accessVlan ?? 1;
      const vb = e.b.iface.accessVlan ?? 1;
      if (va === vb) return [];
      return [
        {
          message: `${name(ctx, e.a.iface)} is in VLAN ${va} but ${name(ctx, e.b.iface)} is in VLAN ${vb}`,
          objectIds: [e.link.id, e.a.iface.id, e.b.iface.id],
          fixes: [
            {
              kind: 'set-access-vlan',
              label: `Put ${name(ctx, e.b.iface)} in VLAN ${va}`,
              end: endRef(e.b),
              vlan: va,
            },
          ],
        },
      ];
    }),
});

registerRule({
  id: 'VAL-011',
  severity: 'warning',
  title: 'Speed or duplex mismatch',
  run: (ctx) =>
    ctx.ends.flatMap((e) => {
      const a = e.a.iface;
      const b = e.b.iface;
      const problems: string[] = [];
      if (a.speedMbps && b.speedMbps && a.speedMbps !== b.speedMbps)
        problems.push(`speed ${a.speedMbps} vs ${b.speedMbps} Mb/s`);
      if (a.duplex !== 'auto' && b.duplex !== 'auto' && a.duplex !== b.duplex)
        problems.push(`duplex ${a.duplex} vs ${b.duplex}`);
      if (!problems.length) return [];
      return [
        {
          message: `${name(ctx, a)} ↔ ${name(ctx, b)}: ${problems.join(', ')}`,
          objectIds: [e.link.id, a.id, b.id],
          fixes: [],
        },
      ];
    }),
});

registerRule({
  id: 'VAL-012',
  severity: 'warning',
  title: 'Inconsistent port-channel members',
  run: (ctx) =>
    ctx.doc.portChannels.flatMap((pc) => {
      const dev = ctx.doc.devices.find((d) => d.id === pc.deviceId);
      if (!dev) return [];
      const members = dev.interfaces.filter((i) => pc.memberInterfaceIds.includes(i.id));
      if (members.length < 2) return [];
      const sig = (i: Interface) =>
        [i.mode, i.accessVlan ?? '', i.nativeVlan ?? '', i.allowedVlans, i.speedMbps ?? ''].join('|');
      const problems: string[] = [];
      if (new Set(members.map(sig)).size > 1) problems.push('member settings differ (mode, VLANs or speed)');
      const neighbors = new Set(
        members.flatMap((i) => {
          const e = ctx.linkOf.get(i.id);
          if (!e) return [];
          return [e.a.iface.id === i.id ? e.b.device.id : e.a.device.id];
        }),
      );
      if (neighbors.size > 1) problems.push(`members connect to ${neighbors.size} different neighbors`);
      if (!problems.length) return [];
      return [
        {
          message: `${dev.hostname} Port-channel${pc.number}: ${problems.join('; ')}`,
          objectIds: [pc.id, ...members.map((m) => m.id)],
          fixes: [],
        },
      ];
    }),
});

registerRule({
  id: 'VAL-013',
  severity: 'warning',
  title: 'Reference to a missing VLAN or VRF',
  run: (ctx) => {
    const out: Omit<Issue, 'ruleId' | 'severity'>[] = [];
    const vlans = new Set([1, ...ctx.doc.vlans.map((v) => v.number)]);
    const vrfs = new Set(ctx.doc.vrfs.map((v) => v.id));
    const checkVlans = ctx.doc.vlans.length > 0;
    const missing = new Map<number, string[]>();
    for (const d of ctx.doc.devices) {
      for (const i of d.interfaces) {
        if (i.vrfId && !vrfs.has(i.vrfId))
          out.push({
            message: `${name(ctx, i)} references a VRF that does not exist`,
            objectIds: [i.id],
            fixes: [],
          });
        if (!checkVlans) continue;
        const refs: number[] = [];
        if (i.mode === 'access' && i.accessVlan) refs.push(i.accessVlan);
        if (i.mode === 'trunk' && i.nativeVlan) refs.push(i.nativeVlan);
        if (i.type === 'vlan') {
          const n = Number(/(\d+)$/.exec(i.name)?.[1]);
          if (n) refs.push(n);
        }
        for (const v of refs) if (!vlans.has(v)) missing.set(v, [...(missing.get(v) ?? []), i.id]);
      }
    }
    for (const [v, ids] of missing) {
      out.push({
        message: `VLAN ${v} is used by ${ids.length} interface(s) but is not defined`,
        objectIds: ids,
        fixes: [{ kind: 'create-vlan', label: `Create VLAN ${v}`, vlan: v }],
      });
    }
    return out;
  },
});

registerRule({
  id: 'VAL-014',
  severity: 'warning',
  title: 'Gateway problem',
  run: (ctx) => {
    const owned = new Set<string>();
    for (const d of ctx.doc.devices)
      for (const i of d.interfaces) {
        for (const a of i.ipv4) owned.add(a.address);
        if (i.fhrp?.vip) owned.add(i.fhrp.vip);
      }
    return ctx.doc.subnets.flatMap((s) => {
      if (!s.gatewayIp || !isValidCidr(s.cidr)) return [];
      if (!isValidIp(s.gatewayIp) || !cidrContains(parseCidr(s.cidr), s.gatewayIp)) {
        return [
          { message: `Gateway ${s.gatewayIp} is outside subnet ${s.cidr}`, objectIds: [s.id], fixes: [] },
        ];
      }
      if (!owned.has(s.gatewayIp)) {
        return [
          { message: `No interface owns gateway ${s.gatewayIp} for ${s.cidr}`, objectIds: [s.id], fixes: [] },
        ];
      }
      return [];
    });
  },
});

registerRule({
  id: 'VAL-015',
  severity: 'warning',
  title: 'FHRP group mismatch',
  run: (ctx) => {
    const groups = new Map<string, Interface[]>();
    for (const d of ctx.doc.devices) {
      for (const i of d.interfaces) {
        const p = primary4(i);
        if (!i.fhrp || !p || !isValidCidr(`${p.address}/${p.prefix}`)) continue;
        const net = parseCidr(`${p.address}/${p.prefix}`);
        const key = `${i.vrfId ?? ''}|${net.network}/${net.prefix}`;
        groups.set(key, [...(groups.get(key) ?? []), i]);
      }
    }
    const out: Omit<Issue, 'ruleId' | 'severity'>[] = [];
    for (const list of groups.values()) {
      const first = list[0];
      if (!first?.fhrp) continue;
      const p = primary4(first);
      const vips = new Set(list.map((i) => i.fhrp?.vip));
      const nums = new Set(list.map((i) => `${i.fhrp?.protocol}:${i.fhrp?.group}`));
      const problems: string[] = [];
      if (vips.size > 1) problems.push(`virtual IPs differ (${[...vips].join(', ')})`);
      if (nums.size > 1) problems.push(`protocol/group differ (${[...nums].join(', ')})`);
      if (p && first.fhrp.vip && !sameSubnet(first.fhrp.vip, p.prefix, p.address, p.prefix))
        problems.push(`virtual IP ${first.fhrp.vip} is outside the subnet`);
      if (problems.length)
        out.push({
          message: `${first.fhrp.protocol.toUpperCase()} group: ${problems.join('; ')}`,
          objectIds: list.map((i) => i.id),
          fixes: [],
        });
    }
    return out;
  },
});

registerRule({
  id: 'VAL-016',
  severity: 'info',
  title: 'Device with no links',
  run: (ctx) => {
    const linked = new Set(ctx.ends.flatMap((e) => [e.a.device.id, e.b.device.id]));
    return ctx.doc.devices
      .filter((d) => !linked.has(d.id))
      .map((d) => ({ message: `${d.hostname} has no links`, objectIds: [d.id], fixes: [] }));
  },
});

registerRule({
  id: 'VAL-017',
  severity: 'info',
  title: 'Addressed interface without a link',
  run: (ctx) =>
    ctx.doc.devices.flatMap((d) =>
      d.interfaces
        .filter(
          (i) =>
            i.enabled &&
            isPhysical(i) &&
            i.ipv4.length + i.ipv6.length > 0 &&
            !ctx.linkCount.has(i.id) &&
            !i.portChannelId,
        )
        .map((i) => ({
          message: `${name(ctx, i)} has an address but no link`,
          objectIds: [i.id],
          fixes: [],
        })),
    ),
});

registerRule({
  id: 'VAL-018',
  severity: 'info',
  title: 'Subnet over 90% utilized',
  run: (ctx) => {
    const addrs = ctx.doc.devices.flatMap((d) => d.interfaces.flatMap((i) => i.ipv4.map((a) => a.address)));
    return ctx.doc.subnets.flatMap((s) => {
      if (!isValidCidr(s.cidr) || parseCidr(s.cidr).family !== 4) return [];
      const u = utilization(s.cidr, addrs);
      return u > 0.9
        ? [{ message: `${s.cidr} is ${Math.round(u * 100)}% utilized`, objectIds: [s.id], fixes: [] }]
        : [];
    });
  },
});

registerRule({
  id: 'VAL-019',
  severity: 'info',
  title: 'Device missing management IP',
  run: (ctx) =>
    ctx.doc.devices
      .filter((d) => MANAGED_ROLES.has(d.role) && !d.mgmtIp.trim())
      .map((d) => ({ message: `${d.hostname} has no management IP`, objectIds: [d.id], fixes: [] })),
});

registerRule({
  id: 'VAL-020',
  severity: 'info',
  title: 'Media mismatch',
  run: (ctx) =>
    ctx.ends.flatMap((e) => {
      const m = [e.a.iface.media, e.b.iface.media];
      if (!(m.includes('fiber') && m.includes('copper'))) return [];
      return [
        {
          message: `${name(ctx, e.a.iface)} (${e.a.iface.media}) is linked to ${name(ctx, e.b.iface)} (${e.b.iface.media})`,
          objectIds: [e.link.id, e.a.iface.id, e.b.iface.id],
          fixes: [],
        },
      ];
    }),
});
