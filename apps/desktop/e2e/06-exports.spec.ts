// SPDX-License-Identifier: Apache-2.0
// Journey 6: export PNG, SVG, PDF, CSV and draw.io; check each file is valid. The options of each
// format are covered in 16-export-options.spec.ts.
import { expect, test } from '@playwright/test';
import { exportAs, exportsList, openApp, startFrom } from './helpers.ts';

test('FR-EXP-02, FR-EXP-04, FR-EXP-06 exports are valid files', async ({ page }) => {
  await openApp(page);
  await startFrom(page, /Small office/);
  await exportAs(page, 'PNG image');
  await exportAs(page, 'SVG image');
  await exportAs(page, 'PDF document');
  await exportAs(page, 'CSV table', async (d) => {
    await d.getByLabel('Table').selectOption('interfaces');
  });
  await exportAs(page, 'draw.io diagram');

  const files = await exportsList(page);
  expect(files.map((f) => f.name.split('.').slice(1).join('.'))).toEqual([
    'png',
    'svg',
    'pdf',
    'csv',
    'drawio',
  ]);
  const [png, svg, pdf, csv, drawio] = files;

  // PNG: signature and a non-trivial size.
  expect(png?.bytes?.slice(0, 8)).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect(png?.bytes?.length ?? 0).toBeGreaterThan(5_000);

  // SVG: parses, text is text, no external references.
  const svgText = svg?.text ?? '';
  const svgCheck = await page.evaluate((s) => {
    const d = new DOMParser().parseFromString(s, 'image/svg+xml');
    const refs = [...d.querySelectorAll('*')]
      .flatMap((el) => [el.getAttribute('href'), el.getAttribute('xlink:href')])
      .filter((v): v is string => !!v);
    return {
      error: !!d.querySelector('parsererror'),
      external: refs.filter((r) => !r.startsWith('data:') && !r.startsWith('#')),
      texts: d.querySelectorAll('text').length,
    };
  }, svgText);
  expect(svgCheck.error).toBe(false);
  expect(svgCheck.external).toEqual([]);
  expect(svgCheck.texts).toBeGreaterThan(3);
  expect(svgText).not.toMatch(/<script|foreignObject|url\(http/i);

  // PDF: header, at least one page, trailer.
  const pdfText = String.fromCharCode(...(pdf?.bytes ?? []));
  expect(pdfText.startsWith('%PDF-1.')).toBe(true);
  expect(pdfText).toMatch(/\/Type\s*\/Page\b/);
  expect(pdfText.trimEnd().endsWith('%%EOF')).toBe(true);

  // CSV: header plus rows.
  const lines = (csv?.text ?? '').trim().split(/\r?\n/);
  expect(lines[0]).toMatch(/^hostname,interface,/);
  expect(lines.length).toBeGreaterThan(5);

  // draw.io: well-formed XML with cells for devices and edges.
  const drawCheck = await page.evaluate((s) => {
    const d = new DOMParser().parseFromString(s, 'application/xml');
    return {
      error: !!d.querySelector('parsererror'),
      vertices: d.querySelectorAll('mxCell[vertex="1"]').length,
      edges: d.querySelectorAll('mxCell[edge="1"]').length,
    };
  }, drawio?.text ?? '');
  expect(drawCheck.error).toBe(false);
  expect(drawCheck.vertices).toBeGreaterThan(3);
  expect(drawCheck.edges).toBeGreaterThan(2);
});
