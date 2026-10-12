// SPDX-License-Identifier: Apache-2.0
/**
 * Print (FR-EXP-10): every page rendered with the export pipeline into a
 * print-only container, then the native print dialog.
 */
import { useEditor } from '../store/editor.ts';
import { platform } from '../platform/index.ts';
import { renderPageSvg } from './svg.ts';
import { svgDataUrl } from './raster.ts';
import { linkTerms } from '../lib/labels.ts';

export async function printDiagram(): Promise<void> {
  const { doc, layer } = useEditor.getState();
  const root = document.createElement('div');
  root.id = 'lw-print-root';
  root.setAttribute('aria-hidden', 'true');
  const date = new Date().toISOString().slice(0, 10);
  for (const page of [...doc.pages].sort((a, b) => a.order - b.order)) {
    const r = renderPageSvg(doc, {
      pageId: page.id,
      layer,
      theme: 'light',
      terms: linkTerms(),
      titleBlock: { name: doc.name, author: doc.author, date, revision: '', page: page.name },
    });
    const img = document.createElement('img');
    img.src = svgDataUrl(r.svg);
    img.alt = page.name;
    img.className = 'lw-print-page';
    root.appendChild(img);
  }
  document.body.appendChild(root);
  document.body.classList.add('lw-printing');
  await Promise.all(
    [...root.querySelectorAll('img')].map((i) =>
      i.complete ? Promise.resolve() : new Promise((r) => (i.onload = r)),
    ),
  );
  const cleanup = () => {
    root.remove();
    document.body.classList.remove('lw-printing');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  try {
    await platform().print();
  } finally {
    // Some webviews never fire afterprint.
    setTimeout(cleanup, 1000);
  }
}
