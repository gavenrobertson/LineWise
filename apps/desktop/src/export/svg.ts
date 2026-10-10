// SPDX-License-Identifier: Apache-2.0
/**
 * Standalone SVG rendering of a page (FR-EXP-02). It uses the same page model
 * and link geometry as the canvas, so exports match the screen. Text stays
 * text, icons are embedded inline, colors are resolved (no CSS variables) and
 * there are no external references. PNG, PDF and print all start from here.
 */
import type { NetworkDocument, ViewLayer, Issue } from '@linewise/core';
import { iconMarkup } from '@linewise/device-library';
import { edgeGeometryPure } from '../canvas/edgeGeometry.ts';
import { ICON, midDirection, type XY } from '../canvas/geometry.ts';
import { buildPageModel, labelBox, offPageBox, pageBounds, type PageModel } from '../canvas/model.ts';
import { assetDataUrl, customIconUrl, iconRole } from '../canvas/icons.ts';

export type ExportTheme = 'light' | 'dark';

const PALETTES: Record<ExportTheme, Record<string, string>> = {
  light: {
    '--canvas': '#ffffff',
    '--grid': '#d5dbe3',
    '--text': '#0e1726',
    '--text-muted': '#4b5563',
    '--device': '#1f6fb2',
    '--device-line': '#0e1726',
    '--link': '#64748b',
    '--link-fiber': '#ea580c',
    '--link-serial': '#7c3aed',
    '--accent': '#0d9488',
    '--danger': '#dc2626',
    '--warning': '#b45309',
    '--info': '#2563eb',
    '--border-strong': '#cdd4de',
    '--label-bg': '#ffffff',
  },
  dark: {
    '--canvas': '#0e1726',
    '--grid': '#24324a',
    '--text': '#e6eaf0',
    '--text-muted': '#a3aebf',
    '--device': '#3b8ad9',
    '--device-line': '#e6eaf0',
    '--link': '#94a3b8',
    '--link-fiber': '#fb923c',
    '--link-serial': '#a78bfa',
    '--accent': '#14b8a6',
    '--danger': '#f87171',
    '--warning': '#fbbf24',
    '--info': '#60a5fa',
    '--border-strong': '#33435f',
    '--label-bg': '#0e1726',
  },
};

export interface SvgExportOptions {
  pageId: string;
  layer?: ViewLayer;
  /** Only these devices (plus links between them, zones and annotations that contain them). */
  selection?: string[];
  transparent?: boolean;
  grid?: boolean;
  theme?: ExportTheme;
  issues?: Issue[];
  padding?: number;
  /** Adds a title block strip at the bottom (PDF/print). */
  titleBlock?: { name: string; author: string; date: string; revision: string; page: string } | null;
}

export interface SvgExport {
  svg: string;
  width: number;
  height: number;
}

export function escapeXml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] as string,
  );
}

function resolveColor(c: string | null | undefined, pal: Record<string, string>): string {
  if (!c) return 'none';
  return c.replace(/var\((--[\w-]+)\)/g, (_, v: string) => pal[v] ?? '#888888');
}

const f = (n: number) => Math.round(n * 10) / 10;

function textLines(x: number, y: number, text: string, attrs: string, lineHeight = 12): string {
  const lines = text.split('\n');
  const tspans = lines
    .map((l, i) => `<tspan x="${f(x)}" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(l)}</tspan>`)
    .join('');
  return `<text x="${f(x)}" y="${f(y)}" ${attrs}>${tspans}</text>`;
}

/** Approximate text width for label backgrounds (export has no DOM measurement). */
function approxWidth(text: string, size: number, mono: boolean): number {
  const longest = Math.max(...text.split('\n').map((l) => l.length));
  return longest * size * (mono ? 0.6 : 0.56);
}

function filterModel(model: PageModel, ids: Set<string>): PageModel {
  const devices = model.devices.filter((d) => ids.has(d.device.id));
  const keep = new Set(devices.map((d) => d.device.id));
  const inside = (b: { x: number; y: number; w: number; h: number }) =>
    devices.some(
      (d) => d.center.x >= b.x && d.center.x <= b.x + b.w && d.center.y >= b.y && d.center.y <= b.y + b.h,
    );
  return {
    devices,
    links: model.links.filter((l) => keep.has(l.sourceId) && keep.has(l.targetId)),
    zones: model.zones.filter((z) => ids.has(z.zone.id) || inside(z.box)),
    annotations: model.annotations.filter((a) => ids.has(a.id)),
    offPage: [],
  };
}

export function renderPageSvg(doc: NetworkDocument, opts: SvgExportOptions): SvgExport {
  const page = doc.pages.find((p) => p.id === opts.pageId) ?? doc.pages[0];
  if (!page) throw new Error('Document has no pages');
  const pal = PALETTES[opts.theme ?? 'light'];
  let model = buildPageModel(doc, page, {
    layer: opts.layer ?? 'l1',
    highlight: null,
    issues: opts.issues ?? [],
  });
  if (opts.selection?.length) model = filterModel(model, new Set(opts.selection));
  const pad = opts.padding ?? 32;
  const b = pageBounds(model, pad);
  const titleH = opts.titleBlock ? 56 : 0;
  const width = Math.ceil(b.w);
  const height = Math.ceil(b.h + titleH);
  const out: string[] = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="${f(b.x)} ${f(b.y)} ${width} ${height}" font-family="Helvetica, Arial, sans-serif">`,
  );
  out.push(`<title>${escapeXml(`${doc.name} — ${page.name}`)}</title>`);
  if (!opts.transparent)
    out.push(
      `<rect x="${f(b.x)}" y="${f(b.y)}" width="${width}" height="${height}" fill="${pal['--canvas']}"/>`,
    );
  if (opts.grid) {
    out.push(
      `<defs><pattern id="lw-grid" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.8" fill="${pal['--grid']}"/></pattern></defs>`,
      `<rect x="${f(b.x)}" y="${f(b.y)}" width="${width}" height="${height - titleH}" fill="url(#lw-grid)"/>`,
    );
  }

  // Zones (bottom layer).
  for (const z of model.zones) {
    const { x, y, w, h } = z.box;
    out.push(
      `<g data-zone="${escapeXml(z.zone.name)}"><rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="12" fill="${escapeXml(z.zone.color)}" fill-opacity="0.06" stroke="${escapeXml(z.zone.color)}" stroke-width="2" stroke-dasharray="6 4"/>`,
      `<text x="${f(x + 8)}" y="${f(y + 18)}" font-size="12" font-weight="600" fill="${escapeXml(z.zone.color)}">${escapeXml(z.zone.name)}</text></g>`,
    );
  }

  // Annotations.
  for (const a of model.annotations) {
    const g = a.geometry;
    const rot = g.rotation
      ? ` transform="rotate(${g.rotation} ${f(g.x + g.w / 2)} ${f(g.y + g.h / 2)})"`
      : '';
    const textColor = a.kind === 'note' ? '#0E1726' : pal['--text'];
    const fs = a.style.fontSize ?? 13;
    const centerText = () =>
      textLines(
        g.x + g.w / 2,
        g.y + g.h / 2 - ((a.text.split('\n').length - 1) * fs * 1.2) / 2 + fs * 0.35,
        a.text,
        `font-size="${fs}" text-anchor="middle" fill="${textColor}"`,
        fs * 1.2,
      );
    switch (a.kind) {
      case 'image': {
        const href = assetDataUrl(a.assetId ? doc.assets[a.assetId] : undefined);
        if (href)
          out.push(
            `<image x="${f(g.x)}" y="${f(g.y)}" width="${f(g.w)}" height="${f(g.h)}" preserveAspectRatio="xMidYMid meet" href="${href}"${rot}/>`,
          );
        break;
      }
      case 'line':
        out.push(
          `<line x1="${f(g.x)}" y1="${f(g.y + g.h / 2)}" x2="${f(g.x + g.w)}" y2="${f(g.y + g.h / 2)}" stroke="${resolveColor(a.style.stroke ?? 'var(--text)', pal)}" stroke-width="2"${rot}/>`,
        );
        break;
      case 'rect':
      case 'ellipse':
      case 'note': {
        const fill =
          a.kind === 'note' ? (a.style.fill ?? '#FEF3C7') : resolveColor(a.style.fill ?? null, pal);
        const stroke =
          a.kind === 'note' ? 'none' : resolveColor(a.style.stroke ?? 'var(--border-strong)', pal);
        const shape =
          a.kind === 'ellipse'
            ? `<ellipse cx="${f(g.x + g.w / 2)}" cy="${f(g.y + g.h / 2)}" rx="${f(g.w / 2)}" ry="${f(g.h / 2)}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`
            : `<rect x="${f(g.x)}" y="${f(g.y)}" width="${f(g.w)}" height="${f(g.h)}" rx="${a.kind === 'note' ? 2 : 6}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
        out.push(`<g${rot}>${shape}${a.text ? centerText() : ''}</g>`);
        break;
      }
      case 'text':
        out.push(`<g${rot}>${centerText()}</g>`);
        break;
    }
  }

  // Links.
  const centers = new Map<string, XY>(model.devices.map((d) => [d.device.id, d.center]));
  for (const o of model.offPage) {
    const r = offPageBox(o);
    centers.set(`offpage:${o.deviceId}`, { x: r.x + r.w / 2, y: r.y + r.h / 2 });
  }
  const labels: string[] = [];
  for (const l of model.links) {
    const a = centers.get(l.sourceId);
    const c = centers.get(l.targetId);
    if (!a || !c) continue;
    const { points, d, anchors } = edgeGeometryPure(a, c, l);
    const stroke = resolveColor(l.severity === 'error' ? 'var(--danger)' : l.color, pal);
    out.push(
      `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${l.width}" stroke-linecap="round"${l.dash ? ` stroke-dasharray="${l.dash}"` : ''}/>`,
    );
    const { mid, ux, uy } = midDirection(points);
    if (l.serial) {
      const px = -uy;
      const py = ux;
      out.push(
        `<path d="M${f(mid.x - ux * 8)} ${f(mid.y - uy * 8)}L${f(mid.x - ux * 2 + px * 6)} ${f(mid.y - uy * 2 + py * 6)}L${f(mid.x + ux * 2 - px * 6)} ${f(mid.y + uy * 2 - py * 6)}L${f(mid.x + ux * 8)} ${f(mid.y + uy * 8)}" fill="none" stroke="${stroke}" stroke-width="${l.width}" stroke-linejoin="round"/>`,
      );
    }
    if (l.bundle?.lead) {
      const cx = anchors.a.x * 0.6 + mid.x * 0.4;
      const cy = anchors.a.y * 0.6 + mid.y * 0.4;
      const ang = (Math.atan2(ux, -uy) * 180) / Math.PI;
      out.push(
        `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f((l.bundle.size * 14) / 2 + 6)}" ry="7" transform="rotate(${f(ang)} ${f(cx)} ${f(cy)})" fill="none" stroke="${stroke}" stroke-width="1.25"/>`,
      );
    }
    const label = (p: XY, text: string, mono: boolean, dy = 0) => {
      if (!text) return;
      const size = mono ? 10 : 11;
      const w = approxWidth(text, size, mono) + 6;
      const n = text.split('\n').length;
      const h = n * (size + 2.5) + 2;
      labels.push(
        `<rect x="${f(p.x - w / 2)}" y="${f(p.y + dy - h / 2)}" width="${f(w)}" height="${f(h)}" rx="3" fill="${pal['--label-bg']}" fill-opacity="0.85"/>`,
        textLines(
          p.x,
          p.y + dy - h / 2 + size,
          text,
          `font-size="${size}" text-anchor="middle" fill="${mono ? pal['--text-muted'] : pal['--text']}"${mono ? ' font-family="Menlo, Consolas, monospace"' : ' font-weight="500"'}`,
          size + 2.5,
        ),
      );
    };
    label(anchors.a, l.labelA, true);
    label(anchors.b, l.labelB, true);
    label(anchors.mid, l.labelMid, false, -10);
  }
  out.push(...labels);

  // Devices (top layer).
  for (const dv of model.devices) {
    const { x, y } = dv.center;
    const style = doc.settings.iconStyle;
    const color = style === 'classic' ? pal['--device'] : pal['--device-line'];
    const s = ICON / 64;
    const url = customIconUrl(doc, dv.device.iconOverride);
    const icon = url
      ? `<image x="${f(x - ICON / 2)}" y="${f(y - ICON / 2)}" width="${ICON}" height="${ICON}" href="${url}" preserveAspectRatio="xMidYMid meet"/>`
      : `<g transform="translate(${f(x - ICON / 2)} ${f(y - ICON / 2)}) scale(${s})" color="${color}" style="color:${color}">${iconMarkup(iconRole(dv.device.role, dv.device.iconOverride), style).replace(/currentColor/g, color ?? '#1f6fb2')}</g>`;
    const lb = labelBox(dv);
    const tx = lb.anchor === 'middle' ? lb.x + lb.w / 2 : lb.anchor === 'start' ? lb.x + 4 : lb.x + lb.w - 4;
    out.push(
      `<g data-device="${escapeXml(dv.device.hostname)}">${icon}`,
      textLines(
        tx,
        lb.y + 12,
        dv.label,
        `font-size="12" font-weight="500" text-anchor="${lb.anchor}" fill="${pal['--text']}"`,
        14,
      ),
    );
    if (dv.badges.length) {
      out.push(
        textLines(
          tx,
          lb.y + 12 + dv.label.split('\n').length * 14,
          dv.badges.join(' · '),
          `font-size="9" text-anchor="${lb.anchor}" fill="${pal['--accent']}" font-family="Menlo, Consolas, monospace"`,
        ),
      );
    }
    if (dv.device.colorTag)
      out.push(
        `<circle cx="${f(x + ICON / 2)}" cy="${f(y + ICON / 2)}" r="5" fill="${escapeXml(dv.device.colorTag)}" stroke="${pal['--canvas']}" stroke-width="2"/>`,
      );
    out.push('</g>');
  }

  // Off-page references (FR-CAN-12).
  for (const o of model.offPage) {
    const r = offPageBox(o);
    out.push(
      `<g data-offpage="${escapeXml(o.hostname)}"><rect x="${f(r.x)}" y="${f(r.y)}" width="${f(r.w)}" height="${f(r.h)}" rx="${f(r.h / 2)}" fill="${pal['--canvas']}" stroke="${pal['--border-strong']}"/>`,
      `<text x="${f(r.x + 10)}" y="${f(r.y + 15)}" font-size="11" fill="${pal['--text']}">↗ <tspan font-weight="600">${escapeXml(o.hostname)}</tspan><tspan fill="${pal['--text-muted']}"> · ${escapeXml(o.pageName)}</tspan></text></g>`,
    );
  }

  if (opts.titleBlock) {
    const tb = opts.titleBlock;
    const ty = b.y + b.h;
    const cells = [
      ['Diagram', tb.name],
      ['Page', tb.page],
      ['Author', tb.author || '—'],
      ['Date', tb.date],
      ['Revision', tb.revision],
    ];
    const cw = width / cells.length;
    out.push(
      `<g data-title-block=""><rect x="${f(b.x)}" y="${f(ty)}" width="${width}" height="${titleH}" fill="${pal['--canvas']}" stroke="${pal['--border-strong']}"/>`,
    );
    cells.forEach(([k, v], i) => {
      const cx = b.x + i * cw;
      if (i)
        out.push(
          `<line x1="${f(cx)}" y1="${f(ty)}" x2="${f(cx)}" y2="${f(ty + titleH)}" stroke="${pal['--border-strong']}"/>`,
        );
      out.push(
        `<text x="${f(cx + 10)}" y="${f(ty + 20)}" font-size="9" fill="${pal['--text-muted']}" letter-spacing="0.5">${escapeXml((k as string).toUpperCase())}</text>`,
        `<text x="${f(cx + 10)}" y="${f(ty + 40)}" font-size="13" font-weight="600" fill="${pal['--text']}">${escapeXml(v as string)}</text>`,
      );
    });
    out.push('</g>');
  }
  out.push('</svg>');
  return { svg: out.join(''), width, height };
}
