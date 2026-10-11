// SPDX-License-Identifier: Apache-2.0
// Export options per format (FR-EXP-01, 03, 05, 07, 08) and print (FR-EXP-10). Journey 6
// (06-exports.spec.ts) checks that each format is a valid file.
import { expect, test, type Page } from '@playwright/test';
import { exportAs, exportsList, MOD, openApp, startFrom } from './helpers.ts';

async function lastExport(page: Page) {
  const files = await exportsList(page);
  return files.at(-1)!;
}

/** Width and height from a PNG's IHDR chunk. */
function pngSize(bytes: number[]): { w: number; h: number } {
  const u32 = (o: number) =>
    ((bytes[o]! << 24) | (bytes[o + 1]! << 16) | (bytes[o + 2]! << 8) | bytes[o + 3]!) >>> 0;
  return { w: u32(16), h: u32(20) };
}

/** Alpha of the top-left pixel, which is always background (the export has padding). */
async function cornerAlpha(page: Page, bytes: number[]): Promise<number> {
  return page.evaluate(async (b) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(b)], { type: 'image/png' }));
    const c = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = c.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(1, 1, 1, 1).data[3]!;
  }, bytes);
}

test('FR-EXP-01 PNG of the page or the selection, at 1×–4×, transparent or not, with or without grid', async ({
  page,
}) => {
  await openApp(page);
  await startFrom(page, /Small office/);

  const png = async (opts: { scale: string; transparent: boolean; grid: boolean; selection?: boolean }) => {
    await exportAs(page, 'PNG image', async (d) => {
      if (opts.selection) await d.getByRole('radio', { name: /^Selection/ }).click();
      await d.getByRole('radio', { name: `${opts.scale}×` }).click();
      await d.getByLabel('Transparent background').setChecked(opts.transparent);
      await d.getByLabel('Include grid').setChecked(opts.grid);
    });
    return (await lastExport(page)).bytes!;
  };

  const one = await png({ scale: '1', transparent: false, grid: false });
  const two = await png({ scale: '2', transparent: false, grid: false });
  const four = await png({ scale: '4', transparent: false, grid: false });
  const s1 = pngSize(one);
  expect(pngSize(two).w).toBeCloseTo(s1.w * 2, -1);
  expect(pngSize(two).h).toBeCloseTo(s1.h * 2, -1);
  expect(pngSize(four).w).toBeCloseTo(s1.w * 4, -1);
  expect(await cornerAlpha(page, one)).toBe(255);

  const clear = await png({ scale: '1', transparent: true, grid: false });
  expect(await cornerAlpha(page, clear)).toBe(0);

  const grid = await png({ scale: '1', transparent: false, grid: true });
  expect(pngSize(grid)).toEqual(s1);
  expect(grid).not.toEqual(one);

  // One selected device exports a smaller image than the page.
  await page.locator('.react-flow__node-device').first().click();
  const sel = await png({ scale: '1', transparent: false, grid: false, selection: true });
  expect(pngSize(sel).w).toBeLessThan(s1.w);
  expect(pngSize(sel).h).toBeLessThanOrEqual(s1.h);
});

test('FR-EXP-03 PDF with paper size, orientation, every page in one file, and tiling', async ({ page }) => {
  await openApp(page);
  await startFrom(page, /Three-tier campus/);
  const pages = page.getByRole('navigation', { name: 'Pages' });
  await pages.getByRole('button', { name: 'New page' }).click();
  await expect(pages.getByRole('tab')).toHaveCount(2);
  await pages.getByRole('tab').first().click();

  const pdf = async (configure: (d: ReturnType<Page['getByRole']>) => Promise<void>) => {
    await exportAs(page, 'PDF document', configure);
    const text = String.fromCharCode(...(await lastExport(page)).bytes!);
    expect(text.startsWith('%PDF-1.')).toBe(true);
    return {
      pages: text.match(/\/Type\s*\/Page\b/g)?.length ?? 0,
      boxes: [...text.matchAll(/\/MediaBox\s*\[([^\]]+)\]/g)].map((m) =>
        m[1]!.trim().split(/\s+/).map(Number).map(Math.round),
      ),
    };
  };

  // A4 landscape, both diagram pages in one PDF.
  const a4 = await pdf(async (d) => {
    await d.getByLabel('Paper').selectOption('a4');
    await d.getByLabel('Orientation').selectOption('landscape');
    await d.getByRole('radio', { name: 'Fit to page' }).click();
    await d.getByLabel(/^All diagram pages/).setChecked(true);
  });
  expect(a4.pages).toBe(2);
  expect(a4.boxes.every(([, , w, h]) => w === 842 && h === 595)).toBe(true);

  // Letter portrait, this page only.
  const letter = await pdf(async (d) => {
    await d.getByLabel('Paper').selectOption('letter');
    await d.getByLabel('Orientation').selectOption('portrait');
    await d.getByLabel(/^All diagram pages/).setChecked(false);
  });
  expect(letter.pages).toBe(1);
  expect(letter.boxes[0]?.slice(2)).toEqual([612, 792]);

  // Tiling the campus at full size needs more than one sheet.
  const tiled = await pdf(async (d) => {
    await d.getByLabel('Paper').selectOption('letter');
    await d.getByRole('radio', { name: 'Tile across pages' }).click();
  });
  expect(tiled.pages).toBeGreaterThan(1);
});

test('FR-EXP-05 HTML and Markdown reports carry the diagram, inventory, IP plan, VLANs and validation', async ({
  page,
}) => {
  await openApp(page);
  await startFrom(page, /Small office/);
  for (const format of ['HTML report', 'Markdown report']) {
    await exportAs(page, format, async (d) => {
      await d.getByLabel('Include diagram image of this page').setChecked(true);
    });
    const text = (await lastExport(page)).text!;
    expect(text).toContain('data:image/png;base64,');
    for (const heading of ['Device inventory', 'IP plan', 'VLANs', 'Validation'])
      expect(text).toContain(heading);
  }
  const html = (await exportsList(page)).at(-2)!.text!;
  // Self-contained: nothing is fetched when the report is opened.
  expect(html).not.toMatch(/<script|<link|src="http/i);
});

test('FR-EXP-07, FR-EXP-08 Containerlab, Mermaid and DOT topologies', async ({ page }) => {
  await openApp(page);
  await startFrom(page, /CCNA lab/);
  await exportAs(page, 'Containerlab topology');
  const clab = await lastExport(page);
  expect(clab.name).toMatch(/\.clab\.yml$/);
  expect(clab.text).toMatch(/^topology:/m);
  expect(clab.text).toMatch(/endpoints:/);

  await exportAs(page, 'Mermaid');
  expect((await lastExport(page)).text).toMatch(/^(graph|flowchart) /m);
  await exportAs(page, 'Graphviz DOT');
  expect((await lastExport(page)).text).toMatch(/^graph .*\{[\s\S]*--[\s\S]*\}\s*$/);
});

test('FR-EXP-10 print renders every page with the export pipeline and opens the print dialog', async ({
  page,
}) => {
  await openApp(page);
  await startFrom(page, /CCNA lab/);
  const pages = page.getByRole('navigation', { name: 'Pages' });
  await pages.getByRole('button', { name: 'New page' }).click();
  await expect(pages.getByRole('tab')).toHaveCount(2);
  // Stand in for the native dialog and record what it would print.
  await page.evaluate(() => {
    const w = window as unknown as { __printed?: string[] };
    window.print = () => {
      w.__printed = [...document.querySelectorAll<HTMLImageElement>('#lw-print-root img')].map((i) =>
        i.src.slice(0, 32),
      );
    };
  });
  await page.locator('body').press(`${MOD}+p`);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __printed?: string[] }).__printed))
    .toEqual(['data:image/svg+xml;charset=utf-8', 'data:image/svg+xml;charset=utf-8']);
  // The print-only copy is removed again.
  await expect(page.locator('#lw-print-root')).toHaveCount(0, { timeout: 3000 });
});
