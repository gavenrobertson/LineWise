// SPDX-License-Identifier: Apache-2.0
/**
 * Document → drawable model. Shared by the React Flow canvas and the SVG
 * exporter so exports match the screen. Pure: no React, no DOM.
 */
import {
  cidrToString,
  isVisibleInLayer,
  parseCidr,
  renderLabel,
  resolveLinks,
  sameSubnet,
  type Annotation,
  type Device,
  type DocumentSettings,
  type Highlight,
  type Interface,
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
  midDirection,
  midLabelT,
  ObstacleIndex,
  parallelOffset,
  polylineLength,
  labelPoint,
  linkLabelSize,
  type LabelSide,
  type Rect,
  type Routing,
  type XY,
} from './geometry.ts';

export { LINK_LABEL, linkLabelSize } from './geometry.ts';

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
  /** The two ends, for the hover card and accessible names. */
  a: { device: Device; iface: Interface };
  b: { device: Device; iface: Interface };
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
  /** The middle label in parts, so VLAN numbers can carry their color (FR-UX-06). */
  midParts: LabelPart[];
  dimmed: boolean;
  severity: Severity | null;
  bundle: { lead: boolean; size: number } | null;
  waypoints: XY[];
  /** Other devices' icon boxes near an orthogonal link, for routing around them (FR-LNK-02). */
  obstacles: Rect[];
  /** Shift of an orthogonal link's middle leg so links sharing a channel do not overlap. */
  lane: number;
  /**
   * Distance of each end label along the link, and where the middle label sits as a fraction of
   * the length, chosen so labels avoid each other and device icons (FR-LNK-03, FR-UX-05).
   */
  labelDist: { a: number; b: number; mid?: number; side?: { a?: LabelSide; b?: LabelSide; mid?: LabelSide } };
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
  /** Words used in link labels, translated by the app (English by default). */
  terms?: LabelTerms;
}

// ------------------------------------------------------------------ link label wording (FR-UX-06)

/** The few words link labels use. The app passes them translated (NFR-I18N-01). */
export interface LabelTerms {
  access: string;
  trunk: string;
  vlan: string;
  all: string;
  fiber: string;
  serial: string;
  wireless: string;
  tunnel: string;
  console: string;
}

export const ENGLISH_TERMS: LabelTerms = {
  access: 'access',
  trunk: 'trunk',
  vlan: 'VLAN',
  all: 'all',
  fiber: 'fiber',
  serial: 'serial',
  wireless: 'wireless',
  tunnel: 'tunnel',
  console: 'console',
};

/** One run of a label; a VLAN number carries its VLAN color for the chip drawn before it. */
export interface LabelPart {
  text: string;
  color?: string;
}

/** At most three VLAN items of a trunk list are shown; the rest become "+N" (the hover card has all). */
export const VLAN_ITEMS_SHOWN = 3;

function vlanItems(spec: string, terms: LabelTerms): { items: string[]; more: number } {
  const all = spec
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  if (!all.length || (all.length === 1 && /^all$/i.test(all[0] as string)))
    return { items: [terms.all], more: 0 };
  return { items: all.slice(0, VLAN_ITEMS_SHOWN), more: Math.max(0, all.length - VLAN_ITEMS_SHOWN) };
}

function vlanKey(i: Interface): string | null {
  if (i.mode === 'access') return `a:${i.accessVlan ?? 1}`;
  if (i.mode === 'trunk') return `t:${i.allowedVlans.replace(/\s+/g, '') || 'all'}`;
  return null;
}

/** The host part of an address in a subnet both ends share: `10.0.12.1/30` → `.1`. */
export function hostPart(address: string, prefix: number): string {
  const octets = address.split('.');
  if (octets.length !== 4 || prefix < 8) return `${address}/${prefix}`;
  return `.${octets.slice(Math.min(3, Math.floor(prefix / 8))).join('.')}`;
}

const MEDIUM_WORD: Partial<Record<Link['medium'], keyof LabelTerms>> = {
  'fiber-sm': 'fiber',
  'fiber-mm': 'fiber',
  serial: 'serial',
  wireless: 'wireless',
  virtual: 'tunnel',
  console: 'console',
};

/**
 * What a link's labels say in each view (FR-LNK-03, FR-LNK-05, FR-UX-06). Facts both ends share go
 * in the middle once instead of at both ends: the access VLAN or trunk list in L2, the subnet in
 * L3 (each end then shows its host part, `.1`). The middle also names a non-copper medium in L1,
 * so the color is never the only cue. Interface names are short or long as the document says.
 */
export function linkWording(
  a: Interface,
  b: Interface,
  link: Link,
  layer: ViewLayer,
  s: Pick<DocumentSettings, 'showInterfaceNames' | 'showInterfaceIps' | 'showVlans'> &
    Partial<Pick<DocumentSettings, 'interfaceNames'>>,
  vlanColor: Map<number, string>,
  terms: LabelTerms = ENGLISH_TERMS,
): { a: string; b: string; mid: LabelPart[] } {
  const showName = s.showInterfaceNames || layer === 'l1';
  const showIp = s.showInterfaceIps || layer === 'l3';
  const showVlan = s.showVlans || layer === 'l2';
  const name = (i: Interface) => (s.interfaceNames === 'long' ? i.name : i.shortName || i.name);

  const ipA = a.ipv4[0];
  const ipB = b.ipv4[0];
  const sharedSubnet =
    showIp && !!ipA && !!ipB && sameSubnet(ipA.address, ipA.prefix, ipB.address, ipB.prefix)
      ? cidrToString(parseCidr(`${ipA.address}/${ipA.prefix}`))
      : null;
  const keyA = vlanKey(a);
  const sharedVlans = showVlan && !!keyA && keyA === vlanKey(b);

  const vlanParts = (i: Interface): LabelPart[] => {
    if (i.mode === 'access') {
      const v = i.accessVlan ?? 1;
      return [{ text: `${terms.vlan} ${v}`, color: vlanColor.get(v) }];
    }
    const { items, more } = vlanItems(i.allowedVlans, terms);
    const parts: LabelPart[] = [{ text: `${terms.trunk} ` }];
    items.forEach((x, n) => {
      if (n) parts.push({ text: ', ' });
      parts.push({ text: x, color: /^\d+$/.test(x) ? vlanColor.get(Number(x)) : undefined });
    });
    if (more) parts.push({ text: ` +${more}` });
    return parts;
  };
  const end = (i: Interface): string => {
    const first: string[] = [];
    if (showName) first.push(name(i));
    const ip = i.ipv4[0];
    if (showIp && ip)
      first.push(sharedSubnet ? hostPart(ip.address, ip.prefix) : `${ip.address}/${ip.prefix}`);
    const lines = [first.join(' ')];
    if (showVlan && !sharedVlans && (i.mode === 'access' || i.mode === 'trunk'))
      lines.push(
        vlanParts(i)
          .map((p) => p.text)
          .join(''),
      );
    return lines.filter(Boolean).join('\n');
  };

  const mid: LabelPart[] = [];
  const add = (parts: LabelPart[]) => {
    if (!parts.length) return;
    if (mid.length) mid.push({ text: ' · ' });
    mid.push(...parts);
  };
  if (link.label) add([{ text: link.label }]);
  // Speed: the link's bandwidth, else the speed both interfaces run at.
  const speed = link.bandwidthMbps ?? (a.speedMbps && a.speedMbps === b.speedMbps ? a.speedMbps : undefined);
  if (link.bandwidthMbps || (layer === 'l1' && speed)) add([{ text: fmtBandwidth(speed as number) }]);
  const medium = MEDIUM_WORD[link.medium];
  if (layer === 'l1' && medium) add([{ text: terms[medium] }]);
  if (sharedVlans) {
    if (a.mode === 'access') add([{ text: `${terms.access} · ` }, ...vlanParts(a)]);
    else add(vlanParts(a));
  }
  if (sharedSubnet) add([{ text: sharedSubnet }]);
  return { a: end(a), b: end(b), mid };
}

// ------------------------------------------------------------------ link label boxes (FR-UX-04)

/** Where a link's problem badge goes: just after its middle label, or at the middle anchor. */
export function badgeAt(mid: XY, l: Pick<LinkView, 'labelMid' | 'midParts'>): XY {
  if (!l.labelMid) return { x: mid.x, y: mid.y };
  const { w } = linkLabelSize(l.labelMid, 'mid', l.midParts.filter((p) => p.color).length);
  return { x: mid.x + w / 2 + 9, y: mid.y };
}

/**
 * Per-link results kept between model builds while their inputs are the same objects (the
 * document is immutable, so an unchanged link keeps its link and interface objects). Unchanged
 * links then hand the canvas the same values, which its edge comparison skips (NFR-PERF-04).
 */
const wordingCache = new WeakMap<
  Link,
  {
    a: Interface;
    b: Interface;
    key: string;
    vlans: Map<number, string>;
    terms?: LabelTerms;
    value: ReturnType<typeof linkWording>;
  }
>();

function cachedWording(
  a: Interface,
  b: Interface,
  link: Link,
  layer: ViewLayer,
  s: DocumentSettings,
  vlanColor: Map<number, string>,
  terms?: LabelTerms,
): ReturnType<typeof linkWording> {
  const key = `${layer}|${s.showInterfaceNames}|${s.showInterfaceIps}|${s.showVlans}|${s.interfaceNames}`;
  const c = wordingCache.get(link);
  if (c && c.a === a && c.b === b && c.key === key && c.vlans === vlanColor && c.terms === terms)
    return c.value;
  const value = linkWording(a, b, link, layer, s, vlanColor, terms);
  wordingCache.set(link, { a, b, key, vlans: vlanColor, terms, value });
  return value;
}

const endCache = new WeakMap<Interface, { device: Device; iface: Interface }>();
function endOf(device: Device, iface: Interface): { device: Device; iface: Interface } {
  const c = endCache.get(iface);
  if (c && c.device === device) return c;
  const e = { device, iface };
  endCache.set(iface, e);
  return e;
}

const vlanColorCache = new WeakMap<object, Map<number, string>>();
function vlanColors(vlans: NetworkDocument['vlans']): Map<number, string> {
  let m = vlanColorCache.get(vlans);
  if (!m) {
    m = new Map(vlans.map((v) => [v.number, v.color]));
    vlanColorCache.set(vlans, m);
  }
  return m;
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
  const vlanColor = vlanColors(doc.vlans);
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
      const words = cachedWording(e.a.iface, e.b.iface, e.link, opts.layer, s, vlanColor, opts.terms);
      let severity: Severity | null = null;
      for (const id of [e.link.id]) {
        const x = sevByObj.get(id);
        if (x) severity = worst(severity, x.sev);
      }
      const isBundle = bundled.length > 1 && bundled.includes(e);
      links.push({
        link: e.link,
        a: endOf(e.a.device, e.a.iface),
        b: endOf(e.b.device, e.b.iface),
        sourceId: endId(e.a.device.id) as string,
        targetId: endId(e.b.device.id) as string,
        routing: e.link.style.routing ?? s.defaultLinkRouting,
        offset: parallelOffset(i, group.length) * (e.a.device.id < e.b.device.id ? 1 : -1),
        color,
        width: st.width + (trunk && opts.layer !== 'l3' ? 1.25 : 0),
        dash: st.dash,
        serial: e.link.medium === 'serial',
        labelA: words.a,
        labelB: words.b,
        labelMid: words.mid.map((p) => p.text).join(''),
        midParts: words.mid,
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
  placeLinkLabels(links, devices, centers, page, opts.layer);

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

/** Uniform grid of placed boxes, so each label only checks its neighbours. */
class BoxGrid {
  private readonly cells = new Map<number, Rect[]>();
  private stamp = 0;
  private readonly seen = new WeakMap<Rect, number>();
  constructor(private readonly size = 64) {}
  private each(r: Rect, f: (cell: number) => boolean | void): void {
    const s = this.size;
    const x1 = Math.floor((r.x + r.w) / s);
    const y1 = Math.floor((r.y + r.h) / s);
    for (let x = Math.floor(r.x / s); x <= x1; x++)
      for (let y = Math.floor(r.y / s); y <= y1; y++) if (f(x * 100_003 + y) === true) return;
  }
  add(r: Rect): void {
    this.each(r, (k) => {
      const c = this.cells.get(k);
      if (c) c.push(r);
      else this.cells.set(k, [r]);
    });
  }
  remove(r: Rect): void {
    this.each(r, (k) => {
      const c = this.cells.get(k);
      const i = c?.indexOf(r) ?? -1;
      if (c && i >= 0) c.splice(i, 1);
    });
  }
  /** Whether `r` touches any placed box. */
  hits(r: Rect): boolean {
    let hit = false;
    this.each(r, (k) => {
      for (const q of this.cells.get(k) ?? [])
        if (r.x < q.x + q.w && q.x < r.x + r.w && r.y < q.y + q.h && q.y < r.y + r.h) return (hit = true);
    });
    return hit;
  }
  /** Area of `r` covered by placed boxes (overlaps counted per box). */
  overlap(r: Rect): number {
    let area = 0;
    const stamp = ++this.stamp;
    this.each(r, (k) => {
      for (const q of this.cells.get(k) ?? []) {
        if (this.seen.get(q) === stamp) continue;
        this.seen.set(q, stamp);
        const w = Math.min(r.x + r.w, q.x + q.w) - Math.max(r.x, q.x);
        const h = Math.min(r.y + r.h, q.y + q.h) - Math.max(r.y, q.y);
        if (w > 0 && h > 0) area += w * h;
      }
    });
    return area;
  }
}

/** Space kept clear around each label so pills never touch. */
const LABEL_GAP = 2;
const STEP = 10;
/** How far a label may move: 20 steps along the link, each way for the middle label. */
const MAX_STEPS = 20;
/** On the line first, then beside it on either side, then one row further out. */
const SIDES: LabelSide[] = [0, 1, -1, 2, -2];

/** A candidate place for a label: its box, distance (end) or fraction (middle) and side. */
type Slot = { r: Rect; v: number; side: LabelSide };
/** A label to place: its candidate slots in order of preference, generated on demand, and how to apply one. */
type Item = {
  mid: boolean;
  slots: () => Iterable<Slot>;
  apply: (s: Slot) => void;
  taken: Slot | null;
};
/** At most this many slots are tried per label before the least covered of the first few is taken. */
const MAX_TRIES = 130;
const FALLBACK_TRIES = 130;
/**
 * Slot checks for a whole placement: 12 per label, and at least 4,000 (a few ms) so a small but
 * crowded page still settles; past it, labels keep their first slot.
 */
const BUDGET_PER_LABEL = 12;
const MIN_BUDGET = 4000;

type LabelDist = LinkView['labelDist'];
/**
 * Where each link's labels went last time, by page and view, with the boxes they take. An edit
 * changes a few links; every other link keeps its labels (the same labelDist object, which the
 * canvas's edge comparison then skips), so an edit places only what it changed (NFR-PERF-04).
 * Exports run in the same session and reuse it, so they match the screen.
 */
const lastPlaced = new Map<string, Map<string, { sig: string; dist: LabelDist; rects: Rect[] }>>();
const MAX_CACHED_VIEWS = 24;

/**
 * Place every link label where it overlaps nothing (FR-LNK-03, FR-UX-05). Device icons, hostnames,
 * off-page pills and serial zigzags are obstacles. Each interface label walks outward from its
 * device in 10 px steps, up to 40% of the link, trying the line and then each side of it, and takes
 * the first free spot (or the least covered one). Middle labels go last, around the middle of their
 * link's longest straight segment, moving outward over the middle three quarters of the link. A
 * short repair pass then moves any label still covered. Slots are generated lazily and checks are
 * budgeted, so a crowded page cannot stall an edit; links whose labels and route did not change
 * keep their placement (lastPlaced). Runs when the document changes, never per frame.
 */
function placeLinkLabels(
  links: LinkView[],
  devices: DeviceView[],
  centers: Map<string, XY>,
  page: Page,
  layer: ViewLayer,
): void {
  const cacheKey = `${page.id}:${layer}`;
  const before = lastPlaced.get(cacheKey);
  const now = new Map<string, { sig: string; dist: LabelDist; rects: Rect[] }>();
  const kept: Rect[] = [];
  const changed: { l: LinkView; sig: string; items: Item[] }[] = [];
  const serials: (() => { points: XY[]; len: number })[] = [];
  for (const l of links) {
    if (!l.labelA && !l.labelB && !l.labelMid) continue;
    const a = centers.get(l.sourceId);
    const b = centers.get(l.targetId);
    if (!a || !b) continue;
    let geo: { points: XY[]; len: number } | null = null;
    const g = () => {
      if (!geo) {
        const { points } = edgeGeometryPure(a, b, l);
        geo = { points, len: polylineLength(points) };
      }
      return geo;
    };
    if (l.serial) serials.push(g);
    // What decides the labels' places: their text and the route (without computing it).
    const sig = `${l.labelA}|${l.labelB}|${l.labelMid}|${a.x},${a.y},${b.x},${b.y},${l.routing},${l.offset},${l.lane},${l.obstacles.length},${l.waypoints.map((w) => `${w.x},${w.y}`).join(';')}`;
    const prev = before?.get(l.link.id);
    if (prev && prev.sig === sig) {
      l.labelDist = prev.dist;
      kept.push(...prev.rects);
      now.set(l.link.id, prev);
      continue;
    }
    const dist = l.labelDist;
    const items: Item[] = [];
    for (const end of ['a', 'b'] as const) {
      const text = end === 'a' ? l.labelA : l.labelB;
      if (!text) continue;
      items.push({
        mid: false,
        taken: null,
        apply: (s) => {
          dist[end] = s.v;
          dist.side = { ...dist.side, [end]: s.side };
        },
        *slots() {
          const { points, len } = g();
          const size = linkLabelSize(text, 'end');
          const cap = Math.min(Math.max(END_LABEL_DIST, len * 0.4), END_LABEL_DIST + MAX_STEPS * STEP);
          for (let d = END_LABEL_DIST; d <= cap; d += STEP)
            for (const side of SIDES) {
              const at = Math.min(d, len * 0.4);
              yield { r: box(labelPoint(points, end === 'a' ? at : len - at, side, size), size), v: d, side };
            }
        },
      });
    }
    if (l.labelMid) {
      const text = l.labelMid;
      items.push({
        mid: true,
        taken: null,
        apply: (s) => {
          dist.mid = s.v;
          dist.side = { ...dist.side, mid: s.side };
        },
        *slots() {
          const { points, len } = g();
          const size = linkLabelSize(text, 'mid', l.midParts.filter((p) => p.color).length);
          const steps = Math.min(MAX_STEPS, Math.floor((len * 0.38) / STEP));
          const t0 = midLabelT(points);
          for (let n = 0; n <= 2 * steps; n++) {
            const k = n % 2 ? (n + 1) / 2 : -n / 2;
            const t = t0 + (k * STEP) / (len || 1);
            if (k && (t < 0.12 || t > 0.88)) continue;
            for (const side of SIDES)
              yield { r: box(labelPoint(points, len * t, side, size), size), v: t, side };
          }
        },
      });
    }
    changed.push({ l, sig, items });
  }
  if (changed.length) placeChanged(changed, kept, serials, devices, page);
  for (const c of changed)
    now.set(c.l.link.id, {
      sig: c.sig,
      dist: c.l.labelDist,
      rects: c.items.flatMap((x) => (x.taken ? [x.taken.r] : [])),
    });
  lastPlaced.delete(cacheKey);
  lastPlaced.set(cacheKey, now);
  if (lastPlaced.size > MAX_CACHED_VIEWS) lastPlaced.delete(lastPlaced.keys().next().value as string);
}

/** Place the labels of changed links around everything already placed. */
function placeChanged(
  changed: { items: Item[] }[],
  kept: Rect[],
  serials: (() => { points: XY[]; len: number })[],
  devices: DeviceView[],
  page: Page,
): void {
  const grid = new BoxGrid();
  for (const d of devices) {
    grid.add(iconRect(d.center, 2));
    const lb = labelBox(d);
    grid.add({ x: lb.x, y: lb.y, w: lb.w, h: lb.h });
  }
  for (const o of page.offPageRefs)
    if (!page.nodePositions[o.deviceId])
      grid.add(offPageBox({ hostname: '', pageName: '', position: o.position }));
  for (const g of serials) {
    const { mid } = midDirection(g().points);
    grid.add({ x: mid.x - 9, y: mid.y - 9, w: 18, h: 18 });
  }
  for (const r of kept) grid.add(r);
  const fresh = changed.flatMap((c) => c.items);
  let budget = Math.max(MIN_BUDGET, BUDGET_PER_LABEL * fresh.length);
  const commit = (item: Item, slot: Slot) => {
    item.apply(slot);
    grid.add(slot.r);
    item.taken = slot;
  };
  /** Take the first free slot; when none is free within the tries, the least covered of the first few. */
  const take = (item: Item): void => {
    let first: Slot | null = null;
    let tries = 0;
    for (const c of item.slots()) {
      first ??= c;
      if (budget <= 0 || tries >= MAX_TRIES) break;
      tries++;
      budget--;
      if (!grid.hits(c.r)) return commit(item, c);
    }
    if (!first) return;
    if (budget <= 0) return commit(item, first);
    let best = first;
    let bestCover = Infinity;
    let n = 0;
    for (const c of item.slots()) {
      if (n++ >= FALLBACK_TRIES) break;
      budget--;
      const cover = grid.overlap(c.r);
      if (cover < bestCover) {
        best = c;
        bestCover = cover;
      }
    }
    commit(item, best);
  };
  // Interface labels first, then middle labels, then a repair: a newly placed label still covered
  // by others is lifted and placed again, now that everything else has a place.
  const order = [...fresh.filter((x) => !x.mid), ...fresh.filter((x) => x.mid)];
  for (const item of order) take(item);
  for (let round = 0; round < 2 && budget > 0; round++)
    for (const item of order) {
      if (!item.taken || budget <= 0) continue;
      grid.remove(item.taken.r);
      budget--;
      if (grid.hits(item.taken.r)) take(item);
      else grid.add(item.taken.r);
    }
}

function box(p: XY, size: { w: number; h: number }): Rect {
  return {
    x: p.x - size.w / 2 - LABEL_GAP,
    y: p.y - size.h / 2 - LABEL_GAP,
    w: size.w + 2 * LABEL_GAP,
    h: size.h + 2 * LABEL_GAP,
  };
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
