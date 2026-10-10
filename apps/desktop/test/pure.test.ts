// SPDX-License-Identifier: Apache-2.0
/** Unit tests for the desktop app's pure modules. */
import {
  addDevice,
  addOffPageRef,
  addPage,
  assignIp,
  connect,
  createDocument,
  Editor,
  setPageLayers,
  addAnnotation,
  updateDevices,
  upsertSubnet,
  addAsset,
  type NetworkDocument,
} from '@linewise/core';
import { getTemplate, STARTERS } from '@linewise/device-library';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { labelBox, buildPageModel, pageBounds } from '../src/canvas/model.ts';
import { distanceToPolyline, linkPoints, parallelOffset } from '../src/canvas/geometry.ts';
import { assetDataUrl, customIconUrl, iconRole } from '../src/canvas/icons.ts';
import { renderPageSvg } from '../src/export/svg.ts';
import { planPdf, PAPER } from '../src/export/pdf.ts';
import { clampScale } from '../src/export/raster.ts';
import {
  circularLayout,
  elkLayout,
  forceLayout,
  gridLayout,
  tierOf,
  type ElkLike,
} from '../src/layout/layouts.ts';
import { searchDocument } from '../src/lib/search.ts';
import { overlappingSubnets, p2pCommand, subnetUtilization } from '../src/lib/ipam.ts';
import { buildPack } from '../src/lib/iconPacks.ts';
import { handlesShortcut, matches } from '../src/lib/keyboard.ts';
import { commandList } from '../src/lib/actions.ts';
import { parseCalcInput } from '../src/dialogs/CalculatorDialog.tsx';
import { normalizeCidr } from '../src/dialogs/IpamDialog.tsx';
import { safeFileName } from '../src/dialogs/ExportDialog.tsx';
import { parseIpWithPrefix } from '../src/panels/InterfaceTable.tsx';

function twoRouters() {
  const ed = new Editor(createDocument('t'));
  const pageId = ed.doc.pages[0]!.id;
  const tpl = getTemplate('generic/router-4ge');
  const a = addDevice({ role: 'router', pageId, position: { x: 0, y: 0 }, template: tpl, hostname: 'R1' });
  const b = addDevice({ role: 'router', pageId, position: { x: 300, y: 0 }, template: tpl, hostname: 'R2' });
  ed.execute(a);
  ed.execute(b);
  const l = connect({ deviceId: a.deviceId }, { deviceId: b.deviceId });
  ed.execute(l);
  return { ed, pageId, a: a.deviceId, b: b.deviceId, link: l.linkId };
}

describe('page model', () => {
  it('draws a link to an off-page reference and hides layers', () => {
    const { ed, pageId, a } = twoRouters();
    const p2 = addPage('WAN');
    ed.execute(p2);
    const tpl = getTemplate('generic/router-4ge');
    const c = addDevice({
      role: 'router',
      pageId: p2.pageId,
      position: { x: 0, y: 0 },
      template: tpl,
      hostname: 'R3',
    });
    ed.execute(c);
    ed.execute(connect({ deviceId: a }, { deviceId: c.deviceId }));
    let m = buildPageModel(ed.doc, ed.doc.pages[0]!, { layer: 'l1', highlight: null, issues: [] });
    expect(m.links).toHaveLength(1);
    ed.execute(addOffPageRef(pageId, c.deviceId, { x: 500, y: 200 }));
    m = buildPageModel(ed.doc, ed.doc.pages[0]!, { layer: 'l1', highlight: null, issues: [] });
    expect(m.links).toHaveLength(2);
    expect(
      m.links.some((l) => l.targetId === `offpage:${c.deviceId}` || l.sourceId === `offpage:${c.deviceId}`),
    ).toBe(true);
    expect(m.offPage[0]).toMatchObject({ hostname: 'R3', pageName: 'WAN' });

    ed.execute(setPageLayers(pageId, [{ id: 'L', name: 'Notes', visible: false, locked: false, order: 0 }]));
    ed.execute(
      addAnnotation(pageId, {
        kind: 'note',
        geometry: { x: 0, y: 0, w: 10, h: 10, rotation: 0 },
        style: {},
        text: 'hidden',
        layerId: 'L',
        locked: false,
      }),
    );
    m = buildPageModel(ed.doc, ed.doc.pages[0]!, { layer: 'l1', highlight: null, issues: [] });
    expect(m.annotations).toHaveLength(0);
  });

  it('places labels on every side and includes them in the bounds', () => {
    const { ed, a } = twoRouters();
    const m0 = buildPageModel(ed.doc, ed.doc.pages[0]!, { layer: 'l1', highlight: null, issues: [] });
    const dv = m0.devices.find((d) => d.device.id === a)!;
    expect(labelBox(dv).y).toBeGreaterThan(dv.center.y);
    for (const pos of ['top', 'left', 'right'] as const) {
      const box = labelBox({ ...dv, device: { ...dv.device, labelPosition: pos } });
      if (pos === 'top') expect(box.y + box.h).toBeLessThan(dv.center.y);
      if (pos === 'left') expect(box.x + box.w).toBeLessThan(dv.center.x);
      if (pos === 'right') expect(box.x).toBeGreaterThan(dv.center.x);
    }
    const b = pageBounds(m0, 0);
    expect(b.w).toBeGreaterThan(300);
  });
});

describe('geometry', () => {
  it('fans out parallel links and measures distance to a polyline', () => {
    expect([0, 1, 2].map((i) => parallelOffset(i, 3))).toEqual([-14, 0, 14]);
    const pts = linkPoints({ x: 0, y: 0 }, { x: 200, y: 100 }, 'orthogonal');
    expect(pts.length).toBe(4);
    expect(pts.every((p, i) => i === 0 || p.x === pts[i - 1]!.x || p.y === pts[i - 1]!.y)).toBe(true);
    expect(
      distanceToPolyline({ x: 100, y: 0 }, [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
      ]),
    ).toBe(0);
    const via = linkPoints({ x: 0, y: 0 }, { x: 200, y: 0 }, 'straight', 0, [{ x: 100, y: 80 }]);
    expect(via[1]).toEqual({ x: 100, y: 80 });
  });
});

describe('icons', () => {
  it('resolves role overrides and embedded icons', () => {
    const doc = createDocument();
    expect(iconRole('router', 'firewall')).toBe('firewall');
    expect(iconRole('router', 'not-a-role')).toBe('router');
    expect(customIconUrl(doc, 'asset:missing')).toBeUndefined();
    const ed = new Editor(doc);
    const asset = addAsset('image/png', 'AAAA');
    ed.execute(asset);
    expect(customIconUrl(ed.doc, `asset:${asset.assetId}`)).toBe('data:image/png;base64,AAAA');
  });

  it('NFR-SEC-03 never turns a hand-edited asset into markup', () => {
    expect(assetDataUrl({ mime: 'image/svg+xml', base64: 'PHN2Zz4=' })).toBe(
      'data:image/svg+xml;base64,PHN2Zz4=',
    );
    expect(assetDataUrl({ mime: 'image/png" onload="alert(1)', base64: 'AAAA' })).toBeUndefined();
    expect(assetDataUrl({ mime: 'text/html', base64: 'AAAA' })).toBeUndefined();
    expect(assetDataUrl({ mime: 'image/png', base64: 'AA"/><script>' })).toBeUndefined();
    const { ed, a } = twoRouters();
    const bad = addAsset('image/png" onload="alert(1)', 'AAAA');
    ed.execute(bad);
    ed.execute(updateDevices([a], { iconOverride: `asset:${bad.assetId}` }));
    const { svg } = renderPageSvg(ed.doc, { pageId: ed.doc.pages[0]!.id });
    expect(svg).not.toContain('onload');
  });
});

describe('SVG export', () => {
  it('is self-contained, escapes text and includes every device', () => {
    const { ed, a } = twoRouters();
    ed.execute(updateDevices([a], { hostname: 'R1<script>alert(1)</script>' }));
    const { svg, width, height } = renderPageSvg(ed.doc, {
      pageId: ed.doc.pages[0]!.id,
      titleBlock: { name: 'Doc & co', author: '', date: '2026-10-09', revision: '1', page: 'Page 1' },
    });
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    expect(svg).not.toContain('<script');
    expect(svg).toContain('R1&lt;script&gt;');
    expect(svg).toContain('Doc &amp; co');
    expect(svg).not.toMatch(/href="(?!data:|#)/);
    expect(svg).not.toContain('var(--');
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.querySelectorAll('[data-device]')).toHaveLength(2);
  });

  it('renders every starter without errors, in both themes and all layers', () => {
    for (const s of STARTERS) {
      const d = s.build();
      for (const layer of ['l1', 'l2', 'l3'] as const)
        for (const theme of ['light', 'dark'] as const) {
          const out = renderPageSvg(d, { pageId: d.pages[0]!.id, layer, theme, grid: true });
          expect(
            new DOMParser().parseFromString(out.svg, 'image/svg+xml').querySelector('parsererror'),
          ).toBeNull();
        }
    }
  });

  it('exports only the selection when asked', () => {
    const { ed, a } = twoRouters();
    const { svg } = renderPageSvg(ed.doc, { pageId: ed.doc.pages[0]!.id, selection: [a] });
    expect(svg).toContain('data-device="R1"');
    expect(svg).not.toContain('data-device="R2"');
  });
});

describe('PDF planning and raster limits', () => {
  it('fits each page or tiles large diagrams', () => {
    const fit = planPdf([{ pageId: 'p', width: 2000, height: 1000 }], {
      paper: 'a4',
      orientation: 'auto',
      mode: 'fit',
    });
    expect(fit).toHaveLength(1);
    expect(fit[0]!.orientation).toBe('landscape');
    expect(2000 * fit[0]!.scale).toBeLessThanOrEqual(PAPER.a4.h);
    const tile = planPdf([{ pageId: 'p', width: 4000, height: 3000 }], {
      paper: 'letter',
      orientation: 'portrait',
      mode: 'tile',
      tileScale: 1,
    });
    expect(tile.length).toBeGreaterThan(4);
  });

  it('keeps canvas sizes within browser limits', () => {
    expect(clampScale(1000, 1000, 4)).toBe(4);
    expect(clampScale(10000, 10000, 4)).toBeLessThan(2);
  });
});

describe('layouts', () => {
  const nodes = [
    { id: 'inet', role: 'internet' as const, x: 0, y: 0 },
    { id: 'fw', role: 'firewall' as const, x: 0, y: 0 },
    { id: 'core', role: 'l3-switch' as const, x: 0, y: 0 },
    { id: 'acc', role: 'l2-switch' as const, x: 0, y: 0 },
    { id: 'pc', role: 'workstation' as const, x: 0, y: 0 },
  ];
  const edges = [
    { source: 'inet', target: 'fw' },
    { source: 'fw', target: 'core' },
    { source: 'core', target: 'acc' },
    { source: 'acc', target: 'pc' },
  ];

  it('orders tiers from WAN to endpoints', () => {
    expect(nodes.map((n) => tierOf(n.role))).toEqual([0, 2, 3, 4, 5]);
  });

  it('hierarchical layout puts each tier lower than the one above', async () => {
    const mod = await import('elkjs/lib/elk.bundled.js');
    const elk = new mod.default() as unknown as ElkLike;
    const pos = await elkLayout(elk, { algorithm: 'hierarchical-down', nodes, edges });
    const ys = nodes.map((n) => pos[n.id]!.y);
    for (let i = 1; i < ys.length; i++) expect(ys[i]!).toBeGreaterThan(ys[i - 1]!);
  });

  it('grid, circle and force layouts place every node without overlaps', () => {
    for (const pos of [gridLayout(nodes), circularLayout(nodes), forceLayout(nodes, edges)]) {
      expect(Object.keys(pos).sort()).toEqual(nodes.map((n) => n.id).sort());
      const pts = Object.values(pos);
      for (let i = 0; i < pts.length; i++)
        for (let j = i + 1; j < pts.length; j++)
          expect(Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.y - pts[j]!.y)).toBeGreaterThan(40);
    }
  });
});

describe('search', () => {
  it('finds devices, interfaces, IPs and VLANs', () => {
    const d: NetworkDocument = STARTERS.find((s) => s.id === 'three-tier-campus')!.build();
    expect(searchDocument(d, 'core1').some((h) => h.kind === 'device' && h.title === 'CORE1')).toBe(true);
    expect(searchDocument(d, 'vlan 10')[0]).toMatchObject({ kind: 'vlan', vlan: 10 });
    const mgmt = d.devices.find((x) => x.mgmtIp)!.mgmtIp;
    expect(searchDocument(d, mgmt).some((h) => h.kind === 'device')).toBe(true);
    const lab = STARTERS.find((s) => s.id === 'ccna-lab')!.build();
    const ip = lab.devices.flatMap((x) => x.interfaces).find((i) => i.ipv4[0])!.ipv4[0]!.address;
    expect(searchDocument(lab, ip).some((h) => h.kind === 'interface')).toBe(true);
    expect(searchDocument(d, '   ')).toEqual([]);
  });
});

describe('IPAM helpers', () => {
  it('numbers a point-to-point link from a pool, skipping used blocks', () => {
    const { ed, link } = twoRouters();
    ed.execute(upsertSubnet({ cidr: '10.255.0.0/30' }));
    const { cmd, cidr } = p2pCommand(ed.doc, link, '10.255.0.0/24', 30);
    expect(cidr).toBe('10.255.0.4/30');
    ed.execute(cmd);
    const ips = ed.doc.devices
      .flatMap((d) => d.interfaces.flatMap((i) => i.ipv4.map((x) => x.address)))
      .sort();
    expect(ips).toEqual(['10.255.0.5', '10.255.0.6']);
    expect(() => p2pCommand(ed.doc, link, 'nonsense', 30)).toThrow();
    expect(subnetUtilization(ed.doc).get(ed.doc.subnets.find((s) => s.cidr === cidr)!.id)).toBe(1);
  });

  it('flags overlapping subnets in the same VRF only', () => {
    const { ed, a } = twoRouters();
    ed.execute(upsertSubnet({ cidr: '10.0.0.0/16' }));
    ed.execute(upsertSubnet({ cidr: '10.0.5.0/24' }));
    ed.execute(upsertSubnet({ cidr: '192.168.0.0/24' }));
    expect(overlappingSubnets(ed.doc).size).toBe(2);
    ed.execute(assignIp(a, ed.doc.devices[0]!.interfaces[1]!.id, '10.0.5.1', 24));
  });
});

describe('icon packs', () => {
  const enc = (s: string) => new TextEncoder().encode(s);
  it('reads a manifest, sanitizes SVG and rejects fake PNGs', () => {
    const warnings: string[] = [];
    const pack = buildPack(
      [
        {
          name: 'pack/manifest.json',
          bytes: enc(
            JSON.stringify({
              name: 'Ops icons',
              icons: [{ file: 'edge.svg', role: 'router', name: 'Edge' }],
            }),
          ),
        },
        {
          name: 'pack/edge.svg',
          bytes: enc(
            '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="5" height="5" onclick="x()"/></svg>',
          ),
        },
        {
          name: 'pack/firewall.svg',
          bytes: enc('<svg xmlns="http://www.w3.org/2000/svg"><circle r="3"/></svg>'),
        },
        { name: 'pack/fake.png', bytes: enc('not a png') },
        { name: 'readme.txt', bytes: enc('hi') },
      ],
      'fallback',
      warnings,
    );
    expect(pack.name).toBe('Ops icons');
    expect(pack.icons.map((i) => [i.name, i.role])).toEqual([
      ['Edge', 'router'],
      ['firewall', 'firewall'],
    ]);
    const svg = atob(pack.icons[0]!.base64);
    expect(svg).not.toContain('script');
    expect(svg).not.toContain('onclick');
    expect(warnings.some((w) => w.includes('fake.png'))).toBe(true);
  });
});

describe('keyboard', () => {
  const ev = (key: string, code: string, mods: Partial<KeyboardEvent> = {}) => ({
    key,
    code,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...mods,
  });
  it('matches shortcuts by key or physical code', () => {
    expect(matches(ev('s', 'KeyS', { ctrlKey: true }), 'mod+S')).toBe(true);
    expect(matches(ev(')', 'Digit0', { ctrlKey: true, shiftKey: true }), 'mod+shift+0')).toBe(true);
    expect(matches(ev('}', 'BracketRight', { metaKey: true, shiftKey: true }), 'mod+shift+]')).toBe(true);
    expect(matches(ev('s', 'KeyS'), 'mod+S')).toBe(false);
    expect(matches(ev('+', 'Equal', { ctrlKey: true }), 'mod+=')).toBe(true);
  });
  it('leaves macOS menu shortcuts to the menu, except Edit', () => {
    expect(handlesShortcut('file.save', 'tauri', 'macos')).toBe(false);
    expect(handlesShortcut('edit.copy', 'tauri', 'macos')).toBe(true);
    expect(handlesShortcut('file.save', 'tauri', 'windows')).toBe(true);
    expect(handlesShortcut('file.save', 'browser', 'web')).toBe(true);
  });
  it('has no duplicate shortcuts', () => {
    const seen = new Map<string, string>();
    for (const c of commandList()) {
      if (!c.shortcut) continue;
      const k = c.shortcut.toLowerCase();
      expect(seen.get(k), `${c.id} reuses ${k}`).toBeUndefined();
      seen.set(k, c.id);
    }
  });
});

describe('native menu', () => {
  it('only sends commands the app knows, and every app command is in the menu or the palette', () => {
    const rs = readFileSync(resolve(__dirname, '../src-tauri/src/menu.rs'), 'utf8');
    const ids = [...rs.matchAll(/item\(\s*app,\s*"([a-zA-Z]+\.[a-zA-Z]+)"/g)].map((m) => m[1]);
    const known = new Set(commandList().map((c) => c.id));
    for (const id of ids) expect(known.has(id as never), id).toBe(true);
    expect(ids.length).toBeGreaterThan(40);
  });
});

describe('input parsing', () => {
  it('parses calculator input forms', () => {
    expect(parseCalcInput('10.1.2.3 255.255.255.192')).toBe('10.1.2.3/26');
    expect(parseCalcInput('10.1.2.3 / 26')).toBe('10.1.2.3/26');
    expect(parseCalcInput('2001:db8::1')).toBe('2001:db8::1/128');
  });
  it('normalizes subnets and interface addresses', () => {
    expect(normalizeCidr('10.1.1.77/24')).toBe('10.1.1.0/24');
    expect(normalizeCidr('10.1.1.77')).toBeNull();
    expect(parseIpWithPrefix('10.0.0.1/30', 4)).toEqual({
      address: '10.0.0.1',
      prefix: 30,
      secondary: false,
    });
    expect(parseIpWithPrefix('10.0.0.1 255.255.255.0', 4)?.prefix).toBe(24);
    expect(parseIpWithPrefix('10.0.0.1 255.0.255.0', 4)).toBeNull();
    expect(parseIpWithPrefix('2001:db8::1/64', 4)).toBeNull();
    expect(parseIpWithPrefix('2001:db8::1/64', 6)?.prefix).toBe(64);
  });
  it('makes safe file names', () => {
    expect(safeFileName('HQ: core/dist <v2>')).toBe('HQ- core-dist -v2-');
    expect(safeFileName('   ')).toBe('diagram');
  });
});
