// SPDX-License-Identifier: Apache-2.0
/**
 * Auto-layout algorithms (FR-CAN-14, FR-IMP-24). Pure functions over a small
 * graph description so they run in the layout worker and in unit tests.
 * Hierarchical layouts place devices in network tiers (WAN → edge → core →
 * access → endpoints) using ELK's layered algorithm, with edges oriented down the tiers.
 */
import type { DeviceRole } from '@linewise/core';
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationNodeDatum,
} from 'd3-force';

export type LayoutAlgorithm =
  'hierarchical-down' | 'hierarchical-right' | 'orthogonal' | 'force' | 'circular' | 'grid';

export const LAYOUT_ALGORITHMS: LayoutAlgorithm[] = [
  'hierarchical-down',
  'hierarchical-right',
  'orthogonal',
  'force',
  'circular',
  'grid',
];

export interface LayoutNode {
  id: string;
  role: DeviceRole;
  /** Current center (kept as the anchor of the result). */
  x: number;
  y: number;
}

export interface LayoutEdge {
  source: string;
  target: string;
}

export interface LayoutRequest {
  algorithm: LayoutAlgorithm;
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  spacing?: number;
}

export type Positions = Record<string, { x: number; y: number }>;

/** Network tier for hierarchical layouts (0 = top). */
export function tierOf(role: DeviceRole): number {
  switch (role) {
    case 'internet':
    case 'cloud':
    case 'wan-cloud':
    case 'mpls-cloud':
      return 0;
    case 'modem':
    case 'router':
    case 'vpn-concentrator':
      return 1;
    case 'firewall':
    case 'ids-ips':
    case 'proxy':
    case 'load-balancer':
      return 2;
    case 'l3-switch':
    case 'wlc':
      return 3;
    case 'l2-switch':
    case 'patch-panel':
    case 'hypervisor':
      return 4;
    default:
      return 5;
  }
}

const NODE_W = 120;
const NODE_H = 100;

/** Keep the layout where the old one was: shift so the bounding box's top-left matches. */
function anchor(nodes: LayoutNode[], pos: Positions): Positions {
  if (!nodes.length) return pos;
  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  const ps = Object.values(pos);
  if (!ps.length) return pos;
  const pMinX = Math.min(...ps.map((p) => p.x));
  const pMinY = Math.min(...ps.map((p) => p.y));
  const out: Positions = {};
  for (const [id, p] of Object.entries(pos))
    out[id] = { x: Math.round(p.x - pMinX + minX), y: Math.round(p.y - pMinY + minY) };
  return out;
}

export function gridLayout(nodes: LayoutNode[], spacing = 1): Positions {
  const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  const sorted = [...nodes].sort((a, b) => tierOf(a.role) - tierOf(b.role) || a.id.localeCompare(b.id));
  const pos: Positions = {};
  sorted.forEach(
    (n, i) =>
      (pos[n.id] = {
        x: (i % cols) * NODE_W * 1.4 * spacing,
        y: Math.floor(i / cols) * NODE_H * 1.4 * spacing,
      }),
  );
  return anchor(nodes, pos);
}

export function circularLayout(nodes: LayoutNode[], spacing = 1): Positions {
  const sorted = [...nodes].sort((a, b) => tierOf(a.role) - tierOf(b.role) || a.id.localeCompare(b.id));
  const n = sorted.length;
  const r = Math.max(120, (n * NODE_W * 0.9 * spacing) / (2 * Math.PI));
  const pos: Positions = {};
  sorted.forEach((node, i) => {
    const a = (2 * Math.PI * i) / Math.max(1, n) - Math.PI / 2;
    pos[node.id] = { x: r + r * Math.cos(a), y: r + r * Math.sin(a) };
  });
  return anchor(nodes, pos);
}

export function forceLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  spacing = 1,
  shouldStop: () => boolean = () => false,
): Positions {
  type N = SimulationNodeDatum & { id: string; tier: number };
  const simNodes: N[] = nodes.map((n, i) => ({
    id: n.id,
    tier: tierOf(n.role),
    x: n.x || (i % 10) * 50,
    y: n.y || Math.floor(i / 10) * 50,
  }));
  const ids = new Set(nodes.map((n) => n.id));
  const links = edges
    .filter((e) => ids.has(e.source) && ids.has(e.target) && e.source !== e.target)
    .map((e) => ({ ...e }));
  const sim = forceSimulation<N>(simNodes)
    .force(
      'link',
      forceLink<N, { source: string; target: string }>(links)
        .id((d) => d.id)
        .distance(140 * spacing)
        .strength(0.7),
    )
    .force('charge', forceManyBody().strength(-500 * spacing))
    .force('collide', forceCollide(70 * spacing))
    .force('x', forceX(0).strength(0.03))
    .force('y', forceY<N>((d) => d.tier * 90 * spacing).strength(0.08))
    .stop();
  const ticks = Math.min(400, 120 + nodes.length);
  for (let i = 0; i < ticks; i++) {
    if (i % 25 === 0 && shouldStop()) break;
    sim.tick();
  }
  const pos: Positions = {};
  for (const n of simNodes) pos[n.id] = { x: n.x ?? 0, y: n.y ?? 0 };
  return anchor(nodes, pos);
}

/** Minimal ELK interface (elkjs's bundled build). */
export interface ElkLike {
  layout: (graph: ElkGraph) => Promise<ElkGraph>;
}
interface ElkGraph {
  id: string;
  layoutOptions?: Record<string, string>;
  children?: {
    id: string;
    width: number;
    height: number;
    x?: number;
    y?: number;
    layoutOptions?: Record<string, string>;
  }[];
  edges?: { id: string; sources: string[]; targets: string[] }[];
}

/**
 * For each node, the number of same-tier hops to a node of its tier that links to a lower tier
 * (0 for those nodes; missing when there is none).
 */
function depthToLowerTier(
  edges: { source: string; target: string }[],
  tier: Map<string, number>,
): Map<string, number> {
  const same = new Map<string, string[]>();
  const depth = new Map<string, number>();
  const queue: string[] = [];
  for (const { source: a, target: b } of edges) {
    const ta = tier.get(a) as number;
    const tb = tier.get(b) as number;
    if (ta === tb) {
      same.set(a, [...(same.get(a) ?? []), b]);
      same.set(b, [...(same.get(b) ?? []), a]);
    } else {
      const upper = ta < tb ? a : b;
      if (!depth.has(upper)) {
        depth.set(upper, 0);
        queue.push(upper);
      }
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const n = queue[i] as string;
    for (const m of same.get(n) ?? [])
      if (!depth.has(m)) {
        depth.set(m, (depth.get(n) as number) + 1);
        queue.push(m);
      }
  }
  return depth;
}

export async function elkLayout(elk: ElkLike, req: LayoutRequest): Promise<Positions> {
  const s = req.spacing ?? 1;
  const direction = req.algorithm === 'hierarchical-right' ? 'RIGHT' : 'DOWN';
  const ids = new Set(req.nodes.map((n) => n.id));
  const tier = new Map(req.nodes.map((n) => [n.id, tierOf(n.role)]));
  const multiTier = new Set(tier.values()).size > 1;
  // Rows come from orienting every edge downward instead of ELK's partitioning, which is far
  // slower on large graphs (NFR-PERF-05: 500 nodes in about a second instead of ~40 s):
  //  - between tiers, from the upper tier to the lower one;
  //  - inside a tier, from the device farther (through same-tier links) from the tier below to
  //    the nearer one, so a core switch sits above the distribution switches of the same role;
  //  - peers at the same distance (DIST1–DIST2, CORE1–CORE2) are left out.
  const valid = req.edges.filter((e) => ids.has(e.source) && ids.has(e.target) && e.source !== e.target);
  const depth = multiTier ? depthToLowerTier(valid, tier) : new Map<string, number>();
  const edges = valid.flatMap((e, i) => {
    const ta = tier.get(e.source) as number;
    const tb = tier.get(e.target) as number;
    let down: boolean;
    if (!multiTier) down = true;
    else if (ta !== tb) down = ta < tb;
    else {
      const da = depth.get(e.source) ?? Infinity;
      const db = depth.get(e.target) ?? Infinity;
      if (da === db) return [];
      down = da > db;
    }
    const [src, dst] = down ? [e.source, e.target] : [e.target, e.source];
    return [{ id: `e${i}`, sources: [src], targets: [dst] }];
  });
  const large = req.nodes.length > 150;
  const graph: ElkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      // Only node positions are used; LineWise draws its own link routes.
      'elk.edgeRouting': 'POLYLINE',
      'elk.separateConnectedComponents': 'false',
      'elk.layered.spacing.nodeNodeBetweenLayers': String(Math.round(70 * s)),
      'elk.spacing.nodeNode': String(Math.round(40 * s)),
      'elk.spacing.componentComponent': String(Math.round(80 * s)),
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.thoroughness': large ? '1' : '7',
      'elk.layered.considerModelOrder.strategy': large ? 'NONE' : 'NODES_AND_EDGES',
    },
    children: [...req.nodes]
      .sort((a, b) => (direction === 'DOWN' ? a.x - b.x : a.y - b.y))
      .map((n) => ({ id: n.id, width: NODE_W - 24, height: NODE_H - 30 })),
    edges,
  };
  const out = await elk.layout(graph);
  const pos: Positions = {};
  for (const c of out.children ?? [])
    pos[c.id] = { x: (c.x ?? 0) + c.width / 2, y: (c.y ?? 0) + c.height / 2 };
  return anchor(req.nodes, pos);
}

export async function runLayout(
  req: LayoutRequest,
  elk: () => Promise<ElkLike>,
  shouldStop?: () => boolean,
): Promise<Positions> {
  switch (req.algorithm) {
    case 'grid':
      return gridLayout(req.nodes, req.spacing);
    case 'circular':
      return circularLayout(req.nodes, req.spacing);
    case 'force':
      return forceLayout(req.nodes, req.edges, req.spacing, shouldStop);
    default:
      return elkLayout(await elk(), req);
  }
}
