// SPDX-License-Identifier: Apache-2.0
/** The UX polish pass (FR-UX-01..13): tokens, motion, tooltips, labels and help. */
import { listRules, type NetworkDocument, type ViewLayer } from '@linewise/core';
import * as RTooltip from '@radix-ui/react-tooltip';
import { STARTERS } from '@linewise/device-library';
import { act, render, screen } from '@testing-library/react';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { edgeGeometryPure } from '../src/canvas/edgeGeometry.ts';
import { iconRect, labelAnchors, midLabelT, polylineLength } from '../src/canvas/geometry.ts';
import { CanvasHoverCard, useCanvasHover } from '../src/canvas/HoverCards.tsx';
import {
  buildPageModel,
  ENGLISH_TERMS,
  hostPart,
  labelBox,
  LINK_LABEL,
  linkLabelSize,
  linkWording,
} from '../src/canvas/model.ts';
import { renderPageSvg } from '../src/export/svg.ts';
import { HelpButton } from '../src/components/HelpButton.tsx';
import { helpTopic, term, type HelpId } from '../src/lib/help.ts';
import { ruleText } from '../src/lib/labels.ts';
import { keyParts } from '../src/components/ui.tsx';
import { cubicBezier, easeStandard, motionMs } from '../src/lib/motion.ts';
import { useUi } from '../src/store/ui.ts';

const css = readFileSync(resolve(import.meta.dirname, '../src/styles.css'), 'utf8');

/** The body of the first rule that starts with `selector {`. */
function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(start, i);
  }
  return '';
}

describe('FR-UX-01 design tokens', () => {
  it('defines motion, elevation, material and label tokens', () => {
    const root = block(':root');
    for (const v of ['--dur-instant: 80ms', '--dur-fast: 140ms', '--dur-base: 220ms', '--dur-slow: 320ms'])
      expect(root).toContain(v);
    for (const v of [
      '--ease-standard',
      '--ease-emphasized',
      '--ease-exit',
      '--elev-1',
      '--elev-2',
      '--elev-3',
    ])
      expect(root).toContain(v);
    expect(root).toContain('--material');
    expect(root).toContain('--label-border');
  });
  it('tunes elevation for the dark theme with a hairline highlight', () => {
    const dark = block(":root[data-theme='dark']");
    expect(dark).toMatch(/--elev-2:\s*inset 0 1px 0 rgba\(255, 255, 255/);
    expect(block('@media (prefers-color-scheme: dark)')).toContain('--elev-3');
  });
  it('turns the translucent material opaque under increased contrast and forced colors', () => {
    expect(block('@media (prefers-contrast: more), (prefers-reduced-transparency: reduce)')).toContain(
      'backdrop-filter: none',
    );
    expect(block('@media (forced-colors: active)')).toMatch(/\.lw-material \{\s*background: Canvas/);
  });
  it('has one radius scale and a keyboard-only focus ring', () => {
    expect(block('@theme')).toMatch(/--radius-lg: 10px;\s*--radius-xl: 14px;\s*--radius-2xl: 20px;/);
    const base = block('@layer base');
    expect(base).toContain('outline: 2px solid var(--focus)');
    expect(base).toContain(':focus:not(:focus-visible)');
  });
});

describe('FR-UX-02 motion vocabulary', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('animates only transform and opacity in its keyframes', () => {
    for (const [, body] of css.matchAll(/@keyframes [\w-]+ \{([\s\S]*?)\n\}/g)) {
      const props = [...(body ?? '').matchAll(/^\s*([a-z-]+):/gm)].map((m) => m[1]);
      for (const p of props) expect(['opacity', 'transform', 'scale']).toContain(p);
    }
  });
  it('collapses every animation and transition under reduced motion', () => {
    const rm = block('@media (prefers-reduced-motion: reduce)');
    expect(rm).toContain('animation-duration: 0.01ms !important');
    expect(rm).toContain('transition-duration: 0.01ms !important');
    expect(rm).toContain('animation-delay: 0ms !important');
  });
  it('makes viewport moves instant under reduced motion', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }));
    expect(motionMs(320)).toBe(0);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(motionMs(320)).toBe(320);
  });
  it('eases with the standard curve', () => {
    expect(easeStandard(0)).toBe(0);
    expect(easeStandard(1)).toBe(1);
    // Quick start, gentle stop: well past halfway at half time.
    expect(easeStandard(0.5)).toBeGreaterThan(0.75);
    expect(cubicBezier(0, 0, 1, 1)(0.3)).toBeCloseTo(0.3, 2);
  });
  it('pauses a toast while the pointer is on it', () => {
    vi.useFakeTimers();
    useUi.setState({ toasts: [] });
    const id = useUi.getState().toast('Saved', 'success');
    vi.advanceTimersByTime(2000);
    useUi.getState().hold(id, true);
    vi.advanceTimersByTime(10_000);
    expect(useUi.getState().toasts).toHaveLength(1);
    useUi.getState().hold(id, false);
    vi.advanceTimersByTime(1600);
    expect(useUi.getState().toasts).toHaveLength(0);
    vi.useRealTimers();
  });
});

describe('FR-UX-08 tooltips', () => {
  it('splits a shortcut into key caps on every platform', () => {
    expect(keyParts('Ctrl+Shift+Z')).toEqual(['Ctrl', 'Shift', 'Z']);
    expect(keyParts('Ctrl++')).toEqual(['Ctrl', '+']);
    expect(keyParts('⌘⇧Z')).toEqual(['⌘', '⇧', 'Z']);
    expect(keyParts('⌘,')).toEqual(['⌘', ',']);
    expect(keyParts('F5')).toEqual(['F5']);
    expect(keyParts('')).toEqual([]);
  });
});

// ------------------------------------------------------------------ link labels

const starter = (id: string) => STARTERS.find((s) => s.id === id)!.build();
const pageModel = (doc: NetworkDocument, layer: ViewLayer) =>
  buildPageModel(doc, doc.pages[0]!, { layer, highlight: null, issues: [] });
type Box = { x: number; y: number; w: number; h: number };
const overlaps = (p: Box, q: Box) => p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;

/** Every link label of a page as a box, from the same geometry the canvas and exports use. */
function labelBoxes(m: ReturnType<typeof pageModel>) {
  const centers = new Map(m.devices.map((d) => [d.device.id, d.center]));
  const out: { r: Box; text: string; len: number }[] = [];
  for (const l of m.links) {
    const a = centers.get(l.sourceId);
    const b = centers.get(l.targetId);
    if (!a || !b) continue;
    const { anchors, points } = edgeGeometryPure(a, b, l);
    const len = polylineLength(points);
    const add = (p: { x: number; y: number }, text: string, kind: 'end' | 'mid') => {
      if (!text) return;
      const s = linkLabelSize(text, kind, kind === 'mid' ? l.midParts.filter((x) => x.color).length : 0);
      out.push({ r: { x: p.x - s.w / 2, y: p.y - s.h / 2, w: s.w, h: s.h }, text, len });
    };
    add(anchors.a, l.labelA, 'end');
    add(anchors.b, l.labelB, 'end');
    add(anchors.mid, l.labelMid, 'mid');
  }
  return out;
}

function contrast(fg: string, bg: string): number {
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
  };
  const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}
const token = (body: string, name: string) => body.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`))?.[1] ?? '';

describe('FR-UX-04 legible link labels', () => {
  it('draws interface labels at 11 px and the middle label at 11.5 px, as pills', () => {
    const pill = block('.lw-pill');
    expect(pill).toContain('font-size: 11px');
    expect(pill).toContain('font-variant-numeric: tabular-nums');
    expect(pill).toContain('border: 1px solid var(--label-border)');
    expect(pill).toContain('scale: var(--lw-label-k, 1)');
    expect(block('.lw-edge-label--mid .lw-pill')).toContain('font-size: 11.5px');
    expect(LINK_LABEL.end.size).toBeGreaterThanOrEqual(11);
  });
  it('keeps 4.5:1 text contrast on the label background in light and dark', () => {
    const light = block(':root');
    const dark = block(":root[data-theme='dark']");
    for (const t of [light, dark]) {
      const canvas = token(t, '--canvas');
      const surface = token(t, '--surface');
      expect(contrast(token(t, '--text-muted'), canvas)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(token(t, '--text'), surface)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('FR-UX-05 link label placement', () => {
  it('never overlaps two labels in any starter diagram, in any view, at 100% zoom', () => {
    for (const s of STARTERS)
      for (const layer of ['l1', 'l2', 'l3'] as const) {
        const boxes = labelBoxes(pageModel(s.build(), layer));
        for (let i = 0; i < boxes.length; i++)
          for (let j = i + 1; j < boxes.length; j++)
            expect(
              overlaps(boxes[i]!.r, boxes[j]!.r),
              `${s.id} ${layer}: "${boxes[i]!.text}" and "${boxes[j]!.text}"`,
            ).toBe(false);
      }
  });
  it('keeps labels off device icons and hostnames (unless the link is too short to hold them)', () => {
    for (const s of STARTERS)
      for (const layer of ['l1', 'l2', 'l3'] as const) {
        const m = pageModel(s.build(), layer);
        const devices = m.devices.flatMap((d) => [iconRect(d.center, 0), labelBox(d)]);
        for (const b of labelBoxes(m).filter((x) => x.len >= 64))
          for (const d of devices) expect(overlaps(b.r, d), `${s.id} ${layer}: "${b.text}"`).toBe(false);
      }
  });
  it('puts the middle label on the longest straight segment', () => {
    // An L-shaped route: 40 px down, then 200 px across; the middle of the long leg is at 140 px.
    const pts = [
      { x: 0, y: 0 },
      { x: 0, y: 40 },
      { x: 200, y: 40 },
    ];
    expect(midLabelT(pts) * 240).toBeCloseTo(140);
    expect(labelAnchors(pts).mid).toEqual({ x: 100, y: 40 });
  });
});

describe('FR-UX-06 link label wording', () => {
  const doc = starter('three-tier-campus');
  const link = (m: ReturnType<typeof pageModel>, a: string, b: string) =>
    m.links.find((l) => l.a.device.hostname === a && l.b.device.hostname === b)!;

  it('says a shared trunk VLAN list once, in the middle, with VLAN chips', () => {
    const l = link(pageModel(doc, 'l2'), 'DIST1', 'ACC1');
    expect(l.labelA).toBe('Te1/0/3');
    expect(l.labelB).toBe('Te1/1/1');
    expect(l.labelMid).toBe('trunk 10, 20, 99');
    expect(l.midParts.filter((p) => p.color).map((p) => p.text)).toEqual(['10', '20', '99']);
  });
  it('names the medium and speed in the physical view', () => {
    expect(link(pageModel(doc, 'l1'), 'CORE1', 'CORE2').labelMid).toBe('10G · fiber');
  });
  it('writes a shared subnet in the middle and host parts at the ends in the network view', () => {
    const lab = pageModel(starter('ccna-lab'), 'l3');
    const l = lab.links.find((x) => x.labelMid.endsWith('/30'))!;
    expect(l.labelMid).toMatch(/^\d+\.\d+\.\d+\.\d+\/30$/);
    expect(l.labelA).toMatch(/ \.\d+$/);
    expect(l.labelB).toMatch(/ \.\d+$/);
    expect(hostPart('10.0.12.1', 30)).toBe('.1');
    expect(hostPart('172.16.5.9', 16)).toBe('.5.9');
  });
  it('keeps each end its own VLANs when they differ, and shortens long lists', () => {
    const l = link(pageModel(doc, 'l2'), 'DIST1', 'ACC1');
    const a = { ...l.a.iface, mode: 'access' as const, accessVlan: 20 };
    const b = { ...l.b.iface, allowedVlans: '10,20,30,40,50-60' };
    const w = linkWording(a, b, l.link, 'l2', doc.settings, new Map());
    expect(w.a).toBe('Te1/0/3\nVLAN 20');
    expect(w.b).toBe('Te1/1/1\ntrunk 10, 20, 30 +2');
    expect(w.mid).toEqual([]);
  });
  it('shows long interface names when the document asks for them', () => {
    const l = link(pageModel(doc, 'l1'), 'CORE1', 'CORE2');
    const w = linkWording(
      l.a.iface,
      l.b.iface,
      l.link,
      'l1',
      { ...doc.settings, interfaceNames: 'long' },
      new Map(),
    );
    expect(w.a).toBe(l.a.iface.name);
    expect(w.a).not.toBe(l.a.iface.shortName);
  });
  it('uses translated words', () => {
    const l = link(pageModel(doc, 'l1'), 'CORE1', 'CORE2');
    const w = linkWording(l.a.iface, l.b.iface, l.link, 'l1', doc.settings, new Map(), {
      ...ENGLISH_TERMS,
      fiber: 'fibre',
    });
    expect(w.mid.map((p) => p.text).join('')).toBe('10G · fibre');
  });
  it('exports the same pills at the same places', () => {
    const { svg } = renderPageSvg(doc, { pageId: doc.pages[0]!.id, layer: 'l2' });
    const m = pageModel(doc, 'l2');
    const boxes = labelBoxes(m);
    const rects = [
      ...svg.matchAll(/<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="([\d.]+)" rx="6"/g),
    ];
    expect(rects.length).toBe(boxes.length);
    for (const b of boxes)
      expect(
        rects.some((r) => Math.abs(Number(r[1]) - b.r.x) < 0.2 && Math.abs(Number(r[2]) - b.r.y) < 0.2),
        b.text,
      ).toBe(true);
    // VLAN chips are drawn as small colored squares before each number.
    expect(svg).toMatch(/<rect x="[\d.-]+" y="[\d.-]+" width="6" height="6" rx="2" fill="#/);
  });
});

describe('FR-UX-07 link hover card', () => {
  it('shows both ends, the medium, the mode and the VLANs', () => {
    const m = pageModel(doc2(), 'l2');
    const l = m.links.find((x) => x.a.device.hostname === 'DIST1' && x.b.device.hostname === 'ACC1')!;
    useCanvasHover.setState({ id: l.link.id, x: 400, y: 400, open: true });
    render(<CanvasHoverCard links={m.links} devices={m.devices} />);
    const card = screen.getByRole('tooltip');
    expect(card).toHaveTextContent('DIST1');
    expect(card).toHaveTextContent('ACC1');
    expect(card).toHaveTextContent(l.a.iface.name);
    expect(card).toHaveTextContent('trunk, VLANs 10,20,99, native');
    act(() => useCanvasHover.getState().hide());
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

function doc2() {
  return starter('three-tier-campus');
}

describe('FR-UX-03 canvas feedback', () => {
  it('draws the device halo and the link glow only on the element under the pointer', () => {
    // Nothing extra is painted for the other 499 devices or 799 links.
    expect(css).not.toMatch(/^\.lw-device-icon::before \{/m);
    expect(css).toContain('.react-flow__node-device:hover .lw-device-icon::before');
    expect(css).not.toMatch(/^\.react-flow__edge \.react-flow__edge-interaction \{/m);
    expect(css).toContain('.react-flow__edge:hover .react-flow__edge-interaction');
  });
  it('springs a selected device in, never while it is dragged, so the drop settles', () => {
    expect(block('.react-flow__node-device.selected:not(.dragging) .lw-device-icon')).toContain(
      'animation: lw-select',
    );
  });
  it('pops connection handles in with scale, which composes with their own transform', () => {
    expect(block('@keyframes lw-handle-in')).toContain('scale: 0.4');
  });
});

describe('FR-UX-08 one tooltip everywhere', () => {
  it('no element in the app uses the browser title attribute; controls use Tooltip', () => {
    const src = resolve(import.meta.dirname, '../src');
    const offenders: string[] = [];
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.tsx') ? [join(dir, e.name)] : [],
      );
    for (const file of walk(src)) {
      const sf = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      const visit = (n: ts.Node) => {
        if (ts.isJsxAttribute(n) && n.name.getText() === 'title') {
          const tag = (n.parent.parent as ts.JsxOpeningLikeElement).tagName.getText();
          // Lower-case tags are DOM elements; components (Dialog, Group, Tooltip…) take `title` as a prop.
          if (/^[a-z]/.test(tag)) offenders.push(`${file.slice(src.length + 1)}: <${tag} title>`);
        }
        ts.forEachChild(n, visit);
      };
      visit(sf);
    }
    expect(offenders).toEqual([]);
  });
});

describe('FR-UX-10 help in context', () => {
  const topics: HelpId[] = ['interfaces', 'routing', 'link', 'display', 'zone', 'problems', 'subnets'];
  it('every topic says what, why, and links to a user-guide section that exists', () => {
    const docs = resolve(import.meta.dirname, '../../../docs');
    for (const id of topics) {
      const h = helpTopic(id);
      expect(h.what.length, id).toBeGreaterThan(30);
      expect(h.why.length, id).toBeGreaterThan(20);
      const [page, anchor] = h.doc.split('#');
      const md = readFileSync(join(docs, `${page}.md`), 'utf8');
      if (anchor)
        expect(
          md
            .split('\n')
            .some(
              (l) => /^#+ /.test(l) && l.replace(/^#+ /, '').toLowerCase().replace(/\s+/g, '-') === anchor,
            ),
          h.doc,
        ).toBe(true);
    }
  });
  it('opens from its "?" button and is keyboard reachable', async () => {
    render(
      <RTooltip.Provider>
        <HelpButton topic="interfaces" />
      </RTooltip.Provider>,
    );
    const btn = screen.getByRole('button', { name: 'About Interfaces and modes' });
    await act(async () => btn.click());
    expect(await screen.findByText(/access carries one VLAN, untagged/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Learn more in the user guide/ })).toBeInTheDocument();
  });
  it('explains every networking term the inspector uses', () => {
    for (const id of [
      'mode',
      'accessVlan',
      'allowedVlans',
      'nativeVlan',
      'speed',
      'duplex',
      'media',
      'fhrp',
      'vip',
      'mgmtIp',
      'medium',
      'bandwidth',
      'circuitId',
      'interfaceNames',
      'labelTemplate',
    ] as const)
      expect(term(id).length, id).toBeGreaterThan(20);
    expect(term('nativeVlan')).toBe(
      'Untagged traffic on a trunk is placed in this VLAN. Both ends must match.',
    );
  });
});

describe('FR-UX-11 validation insights', () => {
  it('the app shows each rule’s title, why and how to fix it', () => {
    for (const r of listRules().filter((x) => /^VAL-0/.test(x.id))) {
      expect(ruleText(r.id, 'title')).toBe(r.title);
      expect(ruleText(r.id, 'why')).toBe(r.why);
      expect(ruleText(r.id, 'fix')).toBe(r.fix);
    }
  });
});
