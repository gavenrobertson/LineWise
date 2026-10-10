// SPDX-License-Identifier: Apache-2.0
/**
 * Deterministic large-network generator for benchmarks (NFR-PERF-07). Builds a campus: two
 * cores, distribution pairs, dual-homed access switches with stack links, and endpoints, with
 * routed /30s between cores and distribution, trunks to the access layer and access VLANs at
 * the edge. About 1.6 links per device, so 500 devices give about 800 links.
 *
 * It applies real core commands straight to the document (no undo history), so the entities
 * are exactly what the app creates and 5,000-device files still build in seconds.
 */
import {
  addDevice,
  assignIp,
  connect,
  createDocument,
  setClock,
  setIdSource,
  sequentialIds,
  updateInterface,
  upsertVlan,
  type Command,
  type DeviceRole,
  type NetworkDocument,
} from '@linewise/core';
import { getTemplate } from '@linewise/device-library';

export const SIZES = [100, 500, 2000, 5000] as const;

const TEMPLATE: Record<string, string> = {
  core: 'generic/l3-switch-24sfpplus-2qsfp',
  dist: 'generic/l3-switch-48ge-4sfpplus',
  access: 'generic/access-switch-48ge-4sfpplus',
  server: 'generic/server-2ge',
  ap: 'generic/access-point',
  phone: 'generic/ip-phone',
  pc: 'generic/workstation',
};

/** Small deterministic PRNG (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ipv4 = (n: number) => `${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`;

export interface Generated {
  doc: NetworkDocument;
  devices: number;
  links: number;
}

export function generateNetwork(target: number, seed = 1): Generated {
  // Stable ids and timestamps make the generated files reproducible byte for byte.
  const restoreIds = setIdSource(sequentialIds(`b${target}-`));
  const restoreClock = setClock(() => '2026-01-01T00:00:00.000Z');
  try {
    const rand = rng(seed);
    const doc = createDocument(`Benchmark ${target}`);
    const pageId = doc.pages[0]?.id as string;
    const run = (c: Command) => c.run(doc);
    let p2p = (10 << 24) | (255 << 16);
    let mgmt = (10 << 24) | (254 << 16) | 10;

    const add = (role: DeviceRole, kind: string, hostname: string, x: number, y: number): string => {
      const template = getTemplate(TEMPLATE[kind] as string);
      const cmd = addDevice({
        role,
        pageId,
        position: { x: Math.round(x), y: Math.round(y) },
        hostname,
        ...(template ? { template } : {}),
        fields: { mgmtIp: ipv4(mgmt++), site: 'Bench campus' },
      });
      run(cmd);
      return cmd.deviceId;
    };
    const ends = (linkId: string) =>
      doc.links.find((l) => l.id === linkId) as NetworkDocument['links'][number];
    const link = (
      a: string,
      b: string,
      opts: { routed?: boolean; trunk?: boolean; vlan?: number; fiber?: boolean } = {},
    ): void => {
      const c = connect({ deviceId: a }, { deviceId: b }, opts.fiber ? 'fiber-mm' : 'copper');
      run(c);
      const l = ends(c.linkId);
      if (opts.routed) {
        const net = p2p;
        p2p += 4;
        for (const [e, host] of [
          [l.endpointA, 1],
          [l.endpointB, 2],
        ] as const) {
          run(updateInterface(e.deviceId, e.interfaceId, { mode: 'routed' }));
          run(assignIp(e.deviceId, e.interfaceId, ipv4(net + host), 30));
        }
      } else if (opts.trunk) {
        for (const e of [l.endpointA, l.endpointB])
          run(
            updateInterface(e.deviceId, e.interfaceId, {
              mode: 'trunk',
              allowedVlans: '10,20,30',
              nativeVlan: 1,
            }),
          );
      } else if (opts.vlan) {
        for (const e of [l.endpointA, l.endpointB])
          run(updateInterface(e.deviceId, e.interfaceId, { mode: 'access', accessVlan: opts.vlan }));
      }
    };

    for (const [number, name] of [
      [10, 'Users'],
      [20, 'Voice'],
      [30, 'Wireless'],
    ] as const)
      run(upsertVlan({ number, name }));

    // Tier sizes: about 36% access switches, distribution pairs per 10 of them, the rest endpoints.
    const accessCount = Math.max(2, Math.round(target * 0.36));
    const distPairs = Math.max(1, Math.ceil(accessCount / 10));
    const endpoints = Math.max(0, target - 2 - distPairs * 2 - accessCount);
    const W = 140;

    const cores = [add('l3-switch', 'core', 'CORE1', 0, 0), add('l3-switch', 'core', 'CORE2', W * 2, 0)];
    link(cores[0] as string, cores[1] as string, { routed: true, fiber: true });

    const dists: [string, string][] = [];
    for (let p = 0; p < distPairs; p++) {
      const a = add('l3-switch', 'dist', `DIST${2 * p + 1}`, p * W * 3, 240);
      const b = add('l3-switch', 'dist', `DIST${2 * p + 2}`, p * W * 3 + W, 240);
      for (const d of [a, b]) for (const c of cores) link(d, c, { routed: true, fiber: true });
      link(a, b, { trunk: true });
      dists.push([a, b]);
    }

    const access: string[] = [];
    const perRow = 40;
    for (let i = 0; i < accessCount; i++) {
      const pair = dists[Math.min(distPairs - 1, Math.floor((i / accessCount) * distPairs))] as [
        string,
        string,
      ];
      const sw = add(
        'l2-switch',
        'access',
        `ACC${i + 1}`,
        (i % perRow) * W,
        480 + Math.floor(i / perRow) * 560,
      );
      link(sw, pair[0], { trunk: true, fiber: true });
      link(sw, pair[1], { trunk: true, fiber: true });
      if (i % 3 === 1) link(sw, access.at(-1) as string, { trunk: true });
      access.push(sw);
    }

    const kinds: [DeviceRole, string, number][] = [
      ['workstation', 'pc', 10],
      ['ip-phone', 'phone', 20],
      ['access-point', 'ap', 30],
      ['server', 'server', 10],
    ];
    const page = doc.pages[0] as NetworkDocument['pages'][number];
    for (let e = 0; e < endpoints; e++) {
      const sw = access[e % access.length] as string;
      const [role, kind, vlan] = kinds[Math.floor(rand() * kinds.length)] as [DeviceRole, string, number];
      const pos = page.nodePositions[sw] as { x: number; y: number };
      const slot = Math.floor(e / access.length);
      const dev = add(
        role,
        kind,
        `${kind.toUpperCase()}${e + 1}`,
        pos.x + ((slot % 2) - 0.5) * 64,
        pos.y + 130 + Math.floor(slot / 2) * 100,
      );
      link(dev, sw, { vlan });
    }
    return { doc, devices: doc.devices.length, links: doc.links.length };
  } finally {
    restoreIds();
    restoreClock();
  }
}
