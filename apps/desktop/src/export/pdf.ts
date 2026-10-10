// SPDX-License-Identifier: Apache-2.0
/**
 * Vector PDF export (FR-EXP-03): page size, orientation, fit-to-page or tile,
 * every diagram page into one PDF, and a title block.
 */
import type { NetworkDocument, ViewLayer } from '@linewise/core';
import { renderPageSvg, type ExportTheme } from './svg.ts';

import { PAPER, type PaperSize } from './paper.ts';

export { PAPER, type PaperSize };

export interface PdfOptions {
  paper: PaperSize;
  orientation: 'portrait' | 'landscape' | 'auto';
  mode: 'fit' | 'tile';
  pageIds: string[];
  layer: ViewLayer;
  theme: ExportTheme;
  titleBlock: boolean;
  revision: string;
  /** Scale for tiling: diagram px → pt. */
  tileScale?: number;
}

const MARGIN = 28;

export interface PlacedTile {
  pageId: string;
  orientation: 'portrait' | 'landscape';
  /** Offset into the diagram (in diagram px) and the scale. */
  dx: number;
  dy: number;
  scale: number;
}

/** Layout plan for the PDF; pure so it can be unit-tested. */
export function planPdf(
  sizes: { pageId: string; width: number; height: number }[],
  opts: Pick<PdfOptions, 'paper' | 'orientation' | 'mode' | 'tileScale'>,
): PlacedTile[] {
  const tiles: PlacedTile[] = [];
  for (const s of sizes) {
    const orient =
      opts.orientation === 'auto' ? (s.width >= s.height ? 'landscape' : 'portrait') : opts.orientation;
    const p = PAPER[opts.paper];
    const pw = (orient === 'landscape' ? p.h : p.w) - MARGIN * 2;
    const ph = (orient === 'landscape' ? p.w : p.h) - MARGIN * 2;
    if (opts.mode === 'fit') {
      tiles.push({
        pageId: s.pageId,
        orientation: orient,
        dx: 0,
        dy: 0,
        scale: Math.min(pw / s.width, ph / s.height),
      });
      continue;
    }
    const scale = opts.tileScale ?? 0.75;
    const cols = Math.max(1, Math.ceil((s.width * scale) / pw));
    const rows = Math.max(1, Math.ceil((s.height * scale) / ph));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        tiles.push({
          pageId: s.pageId,
          orientation: orient,
          dx: (c * pw) / scale,
          dy: (r * ph) / scale,
          scale,
        });
  }
  return tiles;
}

export async function exportPdf(doc: NetworkDocument, opts: PdfOptions): Promise<Uint8Array> {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const date = new Date().toISOString().slice(0, 10);
  const rendered = opts.pageIds.map((pageId) => {
    const page = doc.pages.find((p) => p.id === pageId);
    const r = renderPageSvg(doc, {
      pageId,
      layer: opts.layer,
      theme: opts.theme,
      titleBlock: opts.titleBlock
        ? { name: doc.name, author: doc.author, date, revision: opts.revision, page: page?.name ?? '' }
        : null,
    });
    return { pageId, ...r };
  });
  const tiles = planPdf(rendered, opts);
  const first = tiles[0];
  if (!first) throw new Error('Nothing to export');
  const pdf = new jsPDF({ unit: 'pt', format: opts.paper, orientation: first.orientation, compress: true });
  pdf.setProperties({ title: doc.name, author: doc.author, creator: 'LineWise', subject: 'Network diagram' });
  const parser = new DOMParser();
  for (const [i, tile] of tiles.entries()) {
    if (i > 0) pdf.addPage(opts.paper, tile.orientation);
    const r = rendered.find((x) => x.pageId === tile.pageId);
    if (!r) continue;
    const el = parser.parseFromString(r.svg, 'image/svg+xml').documentElement as unknown as SVGSVGElement;
    // svg2pdf needs the element attached to resolve styles.
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-100000px;top:0;visibility:hidden';
    host.appendChild(el);
    document.body.appendChild(host);
    try {
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const w = r.width * tile.scale;
      const h = r.height * tile.scale;
      const x = opts.mode === 'fit' ? (pageW - w) / 2 : MARGIN - tile.dx * tile.scale;
      const y = opts.mode === 'fit' ? (pageH - h) / 2 : MARGIN - tile.dy * tile.scale;
      await svg2pdf(el, pdf, { x, y, width: w, height: h });
    } finally {
      host.remove();
    }
  }
  return new Uint8Array(pdf.output('arraybuffer'));
}
