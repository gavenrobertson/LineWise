// SPDX-License-Identifier: Apache-2.0
/**
 * Document → drawable model. Shared by the React Flow canvas and the SVG
 * exporter so exports match the screen. Pure: no React, no DOM.
 */
import {
  endLabel,
  isVisibleInLayer,
  renderLabel,
  resolveLinks,
  type Annotation,
  type Device,
  type Highlight,
  type Issue,
  type Link,
  type NetworkDocument,
  type Page,
  type Severity,
  type ViewLayer,
  type Zone,
} from '@linewise/core';
import { edgeGeometryPure } from './edgeGeometry.ts';
import {
  END_LABEL_DIST,
  iconRect,
  LINK_CLEARANCE,
  ObstacleIndex,
  parallelOffset,
  pointAlong,
  polylineLength,
  type Rect,
  type Routing,
  type XY,
} from './geometry.ts';

export interface DeviceView {
  device: Device;
  center: XY;
  label: string;
  severity: Severity | null;
  issueCount: number;
  dimmed: boolean;
  badges: string[];
}

export interface LinkView {
  link: Link;
  sourceId: string;
  targetId: string;
  routing: Routing;
  offset: number;
  color: string;
  width: number;
  dash: string | null;
  serial: boolean;
  labelA: string;
  labelB: string;
  labelMid: string;
  dimmed: boolean;
  severity: Severity | null;
  bundle: { lead: boolean; size: number } | null;
  waypoints: XY[];
  /** Other devices' icon boxes near an orthogonal link, for routing around them (FR-LNK-02). */
  obstacles: Rect[];
  /** Shift of an orthogonal link's middle leg so links sharing a channel do not overlap. */
  lane: number;
  /** Distance of each end label along the link, spread apart where labels would overlap (FR-LNK-03). */
  labelDist: { a: number; b: number };
}

export interface ZoneView {
  zone: Zone;
  box: { x: number; y: number; w: number; h: number };
}

export interface PageModel {
  devices: DeviceView[];
  links: LinkView[];
  zones: ZoneView[];
  annotations: Annotation[];
  offPage: { deviceId: string; hostname: string; pageName: string; position: XY }[];
}

const SEV_RANK: Record<Severity, number> = { error: 3, warning: 2, info: 1 };

function worst(a: Severity | null, b: Severity): Severity {
  return !a || SEV_RANK[b] > SEV_RANK[a] ? b : a;
}

/**
 * Severity is shown by a glyph as well as a color, so it never depends on color alone
 * (NFR-A11Y-03): ✕ error, ▲ warning, i information.
 */
export const SEVERITY_GLYPH: Record<Severity, string> = { error: '✕', warning: '▲', info: 'i' };

const MEDIUM_STYLE: Record<Link['medium'], { color: string; dash: string | null; width: number }> = {
  copper: { color: 'var(--link)', dash: null, width: 1.75 },
  'fiber-sm': { color: 'var(--link-fiber)', dash: null, width: 1.75 },
  'fiber-mm': { color: 'var(--link-fiber)', dash: null, width: 1.75 },
  serial: { color: 'var(--link-serial)', dash: null, width: 1.75 },
  wireless: { color: 'var(--link)', dash: '6 4', width: 1.5 },
  virtual: { color: 'var(--link)', dash: '2 4', width: 1.5 },
  console: { color: 'var(--link)', dash: '4 3', width: 1 },
};

export interface ModelOptions {
  layer: ViewLayer;
  highlight: Highlight | null;
  issues: Issue[];
  /** Positions overriding the page while dragging. */
  overrides?: Record<string, XY> | null;
}

export function buildPageModel(doc: NetworkDocument, page: Page, opts: ModelOptions): PageModel {
  const s = doc.settings;
  // Issues by object: a device collects its own issues and its interfaces'.
  const sevByObj = new Map<string, { sev: Severity; n: number }>();
  for (const iss of opts.issues) {
    for (const id of iss.objectIds) {
      const cur = sevByObj.get(id);
      sevByObj.set(id, { sev: worst(cur?.sev ?? null, iss.severity), n: (cur?.n ?? 0) + 1 });
    }
  }
  const hl = opts.highlight;
  const visible = new Set<string>();
  const devices: DeviceView[] = [];
  for (const d of doc.devices) {
    const pos = opts.overrides?.[d.id] ?? page.nodePositions[d.id];
    if (!pos) continue;
    if (!isVisibleInLayer(d, opts.layer)) continue;
    visible.add(d.id);
    let severity: Severity | null = null;
    let issueCount = 0;
    for (const id of [d.id, ...d.interfaces.map((i) => i.id)]) {
      const e = sevByObj.get(id);
      if (e) {
        severity = worst(severity, e.sev);
        issueCount += e.n;
      }
    }
    const badges =
      opts.layer === 'l3'
        ? d.routing.map((r) => `${r.protocol.toUpperCase()}${r.value ? ` ${r.value}` : ''}`)
        : [];
    devices.push({
      device: d,
      center: pos,
      label: renderLabel(s.labelTemplate, d) || d.hostname,
      severity,
      issueCount,
      dimmed: !!hl && !hl.deviceIds.has(d.id),
      badges,
    });
  }

  // Parallel links between the same two devices fan out; port-channel members get a bundle mark.
  // A link to a device on another page ends at its off-page reference, when the page has one (FR-CAN-12).
  const refs = new Set(
    page.offPageRefs.filter((r) => !page.nodePositions[r.deviceId]).map((r) => r.deviceId),
  );
  const endId = (id: string) => (visible.has(id) ? id : refs.has(id) ? `offpage:${id}` : null);
  const ends = resolveLinks(doc).filter((e) => {
    const a = endId(e.a.device.id);
    const b = endId(e.b.device.id);
    return a && b && !(a.startsWith('offpage:') && b.startsWith('offpage:'));
  });
  const groups = new Map<string, typeof ends>();
  for (const e of ends) {
    const k = [e.a.device.id, e.b.device.id].sort().join('|');
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  const vlanColor = new Map(doc.vlans.map((v) => [v.number, v.color]));
  const links: LinkView[] = [];
  for (const group of groups.values()) {
    group.sort((x, y) => x.link.id.localeCompare(y.link.id));
    const bundled = group.filter((e) => e.a.iface.portChannelId || e.b.iface.portChannelId);
    group.forEach((e, i) => {
      const st = MEDIUM_STYLE[e.link.medium];
      const trunk = e.a.iface.mode === 'trunk' || e.b.iface.mode === 'trunk';
      let color = e.link.style.color ?? st.color;
      if (opts.layer === 'l2' && !e.link.style.color) {
        const v =
          e.a.iface.mode === 'access'
            ? (e.a.iface.accessVlan ?? 1)
            : e.b.iface.mode === 'access'
              ? (e.b.iface.accessVlan ?? 1)
              : undefined;
        if (v !== undefined) color = vlanColor.get(v) ?? color;
        else if (trunk) color = 'var(--text)';
      }
      const show = { names: s.showInterfaceNames, ips: s.showInterfaceIps, vlans: s.showVlans };
      const mid = [e.link.label, e.link.bandwidthMbps ? fmtBandwidth(e.link.bandwidthMbps) : '']
        .filter(Boolean)
        .join(' · ');
      let severity: Severity | null = null;
      for (const id of [e.link.id]) {
        const x = sevByObj.get(id);
        if (x) severity = worst(severity, x.sev);
      }
      const isBundle = bundled.length > 1 && bundled.includes(e);
      links.push({
        link: e.link,
        sourceId: endId(e.a.device.id) as string,
        targetId: endId(e.b.device.id) as string,
        routing: e.link.style.routing ?? s.defaultLinkRouting,
        offset: parallelOffset(i, group.length) * (e.a.device.id < e.b.device.id ? 1 : -1),
        color,
        width: st.width + (trunk && opts.layer !== 'l3' ? 1.25 : 0),
        dash: st.dash,
        serial: e.link.medium === 'serial',
        labelA: endLabel(e.a.iface, opts.layer, show),
        labelB: endLabel(e.b.iface, opts.layer, show),
        labelMid: mid,
        dimmed: !!hl && !hl.linkIds.has(e.link.id),
        severity,
        bundle: isBundle ? { lead: bundled[0] === e, size: bundled.length } : null,
        waypoints: e.link.style.waypoints ?? [],
        obstacles: [],
        lane: 0,
        labelDist: { a: END_LABEL_DIST, b: END_LABEL_DIST },
      });
    });
  }

  const centers = new Map<string, XY>(devices.map((d) => [d.device.id, d.center]));
  for (const o of page.offPageRefs) {
    const r = offPageBox({ hostname: '', pageName: '', position: o.position });
    centers.set(`offpage:${o.deviceId}`, { x: r.x + r.w / 2, y: r.y + r.h / 2 });
  }
  routeOrthogonal(links, devices, centers);
  spreadEndLabels(links, centers);

  const zones: ZoneView[] = doc.zones.flatMap((z) => {
    const box = page.zoneBoxes[z.id];
    if (!box) return [];
    const o = opts.overrides?.[z.id];
    return [
      {
        zone: z,
        box: o ? { x: o.x, y: o.y, w: box.w, h: box.h } : { x: box.x, y: box.y, w: box.w, h: box.h },
      },
    ];
  });

  const offPage = page.offPageRefs.flatMap((r) => {
    const d = doc.devices.find((x) => x.id === r.deviceId);
    const home = doc.pages.find((p) => p.id !== page.id && p.nodePositions[r.deviceId]);
    return d && home
      ? [{ deviceId: d.id, hostname: d.hostname, pageName: home.name, position: r.position }]
      : [];
  });

  const hidden = new Set(page.layers.filter((l) => !l.visible).map((l) => l.id));
  const annotations = page.annotations.filter((a) => !a.layerId || !hidden.has(a.layerId));
  return { devices, links, zones, annotations, offPage };
}

/** Give orthogonal links the nearby device boxes they must route around. */
function routeOrthogonal(links: LinkView[], devices: DeviceView[], centers: Map<string, XY>): void {
  const ortho = links.filter((l) => l.routing === 'orthogonal' && !l.waypoints.length);
  if (!ortho.length) return;
  const ids = devices.map((d) => d.device.id);
  const rects = devices.map((d) => iconRect(d.center));
  const byRect = new Map(rects.map((r, i) => [r, ids[i] as string]));
  const index = new ObstacleIndex(rects);
  const pad = 160;
  // Links whose middle legs would fall on the same line share a channel: give each its own lane.
  const channels = new Map<string, { l: LinkView; a: XY; b: XY }[]>();
  for (const l of ortho) {
    const a = centers.get(l.sourceId);
    const b = centers.get(l.targetId);
    if (!a || !b) continue;
    const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
    const mid = horizontal ? (a.x + b.x) / 2 : (a.y + b.y) / 2;
    const k = `${horizontal ? 'h' : 'v'}:${Math.round(mid / 8)}`;
    channels.set(k, [...(channels.get(k) ?? []), { l, a, b }]);
  }
  for (const [k, members] of channels) {
    if (members.length < 2) continue;
    const horizontal = k.startsWith('h');
    const span = Math.min(
      ...members.map(({ a, b }) => (horizontal ? Math.abs(b.x - a.x) : Math.abs(b.y - a.y))),
    );
    const gap = Math.max(0, Math.min(8, (span - 2 * LINK_CLEARANCE - 8) / (members.length - 1)));
    // Order by where the links run so lanes do not cross each other needlessly.
    members.sort((p, q) => (horizontal ? p.a.y + p.b.y - (q.a.y + q.b.y) : p.a.x + p.b.x - (q.a.x + q.b.x)));
    members.forEach(({ l }, i) => (l.lane = (i - (members.length - 1) / 2) * gap));
  }
  for (const l of ortho) {
    const a = centers.get(l.sourceId);
    const b = centers.get(l.targetId);
    if (!a || !b) continue;
    const box = {
      x: Math.min(a.x, b.x) - pad,
      y: Math.min(a.y, b.y) - pad,
      w: Math.abs(a.x - b.x) + 2 * pad,
      h: Math.abs(a.y - b.y) + 2 * pad,
    };
    l.obstacles = index.query(box).filter((r) => {
      const id = byRect.get(r);
      return id !== l.sourceId && id !== l.targetId;
    });
  }
}

/**
 * Interface labels near a device can collide when several links leave it in similar
 * directions. Place each end label at the default distance, and push it further along its link
 * while it overlaps a label already placed at the same device (FR-LNK-03).
 */
function spreadEndLabels(links: LinkView[], centers: Map<string, XY>): void {
  type End = { link: LinkView; side: 'a' | 'b'; text: string; points: XY[]; len: number };
  const byDevice = new Map<string, End[]>();
  for (const l of links) {
    const a = centers.get(l.sourceId);
    const b = centers.get(l.targetId);
    if (!a || !b) continue;
    const { points } = edgeGeometryPure(a, b, l);
    const len = polylineLength(points);
    const push = (id: string, end: End) => byDevice.set(id, [...(byDevice.get(id) ?? []), end]);
    if (l.labelA) push(l.sourceId, { link: l, side: 'a', text: l.labelA, points, len });
    if (l.labelB) push(l.targetId, { link: l, side: 'b', text: l.labelB, points, len });
  }
  const boxAt = (e: End, d: number) => {
    const p = pointAlong(e.points, e.side === 'a' ? d : e.len - d);
    const lines = e.text.split('\n');
    const w = Math.max(...lines.map((x) => x.length)) * 6.2 + 8;
    const h = lines.length * 13 + 2;
    return { x: p.x - w / 2, y: p.y - h / 2, w, h };
  };
  const overlaps = (r: Rect, q: Rect) =>
    r.x < q.x + q.w && q.x < r.x + r.w && r.y < q.y + q.h && q.y < r.y + r.h;
  for (const ends of byDevice.values()) {
    if (ends.length < 2) continue;
    const placed: Rect[] = [];
    for (const e of ends) {
      let d = END_LABEL_DIST;
      let box = boxAt(e, d);
      for (let step = 0; step < 6 && placed.some((p) => overlaps(p, box)) && d + 14 < e.len * 0.4; step++) {
        d += 14;
        box = boxAt(e, d);
      }
      placed.push(box);
      e.link.labelDist = { ...e.link.labelDist, [e.side]: d };
    }
  }
}

export function fmtBandwidth(mbps: number): string {
  if (mbps >= 1000 && mbps % 1000 === 0) return `${mbps / 1000}G`;
  if (mbps >= 1000) return `${(mbps / 1000).toFixed(1)}G`;
  return `${mbps}M`;
}

/** Off-page reference pill geometry (mirrors the canvas node). */
export function offPageBox(o: { hostname: string; pageName: string; position: XY }): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  return {
    x: o.position.x,
    y: o.position.y,
    w: (o.hostname.length + o.pageName.length + 5) * 6.4 + 20,
    h: 22,
  };
}

/** Approximate label box (no DOM measurement) for bounds and the SVG exporter. */
export function labelBox(d: Pick<DeviceView, 'center' | 'label' | 'badges' | 'device'>): {
  x: number;
  y: number;
  w: number;
  h: number;
  anchor: 'middle' | 'start' | 'end';
} {
  const lines = d.label.split('\n');
  const w = Math.max(...lines.map((l) => l.length)) * 7 + 8;
  const h = lines.length * 14 + (d.badges.length ? 14 : 0) + 2;
  const { x, y } = d.center;
  switch (d.device.labelPosition) {
    case 'top':
      return { x: x - w / 2, y: y - 28 - 4 - h, w, h, anchor: 'middle' };
    case 'left':
      return { x: x - 28 - 6 - w, y: y - h / 2, w, h, anchor: 'end' };
    case 'right':
      return { x: x + 28 + 6, y: y - h / 2, w, h, anchor: 'start' };
    default:
      return { x: x - w / 2, y: y + 28 + 4, w, h, anchor: 'middle' };
  }
}

/** Bounding box of everything on a page (for zoom-to-fit and export). */
export function pageBounds(model: PageModel, pad = 40): { x: number; y: number; w: number; h: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const d of model.devices) {
    const lb = labelBox(d);
    xs.push(d.center.x - 48, d.center.x + 48, lb.x, lb.x + lb.w);
    ys.push(d.center.y - 28, d.center.y + 28, lb.y, lb.y + lb.h);
  }
  for (const z of model.zones) {
    xs.push(z.box.x, z.box.x + z.box.w);
    ys.push(z.box.y, z.box.y + z.box.h);
  }
  for (const o of model.offPage) {
    const r = offPageBox(o);
    xs.push(r.x, r.x + r.w);
    ys.push(r.y, r.y + r.h);
  }
  for (const a of model.annotations) {
    xs.push(a.geometry.x, a.geometry.x + a.geometry.w);
    ys.push(a.geometry.y, a.geometry.y + a.geometry.h);
  }
  if (!xs.length) return { x: 0, y: 0, w: 400, h: 300 };
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
}
