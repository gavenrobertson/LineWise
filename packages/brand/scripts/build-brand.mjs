// SPDX-License-Identifier: Apache-2.0
// Builds brand outputs from the masters (BRD-01): bundled fonts, lockups with
// the wordmark converted to paths, and the shipped doc icon with its label as paths.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fs = (p) => join(root, 'node_modules/@fontsource', p);

const INK = '#0E1726';
const TEAL = '#0D9488';
const RAISED = '#1A2436';
const RAISED_BORDER = '#2C3A52';
const MUTED_LIGHT = '#4B5563';
const MUTED_DARK = '#A3AEBF';

// 1. Fonts (OFL-1.1) — bundled, never loaded from a CDN (NFR-SEC-02, NFR-PRIV-01).
mkdirSync(join(root, 'fonts'), { recursive: true });
const fontFiles = [
  ['sora/files/sora-latin-400-normal.woff2', 'sora-400.woff2'],
  ['sora/files/sora-latin-600-normal.woff2', 'sora-600.woff2'],
  ['sora/files/sora-latin-700-normal.woff2', 'sora-700.woff2'],
  ['ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2', 'ibm-plex-mono-400.woff2'],
  ['ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2', 'ibm-plex-mono-500.woff2'],
];
for (const [src, dest] of fontFiles) copyFileSync(fs(src), join(root, 'fonts', dest));
copyFileSync(fs('sora/LICENSE'), join(root, 'fonts', 'Sora-OFL.txt'));
copyFileSync(fs('ibm-plex-mono/LICENSE'), join(root, 'fonts', 'IBMPlexMono-OFL.txt'));
writeFileSync(
  join(root, 'fonts', 'fonts.css'),
  `/* SPDX-License-Identifier: OFL-1.1 (fonts) — bundled locally, see *-OFL.txt */
@font-face { font-family: 'Sora'; font-weight: 400; font-display: swap; src: url('./sora-400.woff2') format('woff2'); }
@font-face { font-family: 'Sora'; font-weight: 600; font-display: swap; src: url('./sora-600.woff2') format('woff2'); }
@font-face { font-family: 'Sora'; font-weight: 700; font-display: swap; src: url('./sora-700.woff2') format('woff2'); }
@font-face { font-family: 'IBM Plex Mono'; font-weight: 400; font-display: swap; src: url('./ibm-plex-mono-400.woff2') format('woff2'); }
@font-face { font-family: 'IBM Plex Mono'; font-weight: 500; font-display: swap; src: url('./ibm-plex-mono-500.woff2') format('woff2'); }
`,
);

// 2. Outline helpers (opentype.js reads WOFF).
const load = (p) => {
  const buf = readFileSync(fs(p));
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
};
const sora = load('sora/files/sora-latin-600-normal.woff');
const plex = load('ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff');
const TRACK = -0.03;

function textPath(font, text, x, y, size, fill, tracking = 0) {
  const d = font.getPath(text, x, y, size, { letterSpacing: tracking, kerning: true }).toPathData(2);
  return `<path fill="${fill}" d="${d}"/>`;
}
const advance = (font, text, size, tracking = 0) =>
  font.getAdvanceWidth(text, size, { letterSpacing: tracking, kerning: true });
const capHeight = (font, size) =>
  ((font.tables.os2?.sCapHeight ?? font.unitsPerEm * 0.7) / font.unitsPerEm) * size;

// 3. Lockups (spec section 15: icon, 22-unit gap, wordmark at 0.6× icon height, subline 10 below at 0.15×).
const master = readFileSync(join(root, 'svg/app-icon.svg'), 'utf8');
const iconInner = master
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .replace(/id="grid"/, 'id="lw-grid"')
  .replace('url(#grid)', 'url(#lw-grid)');

function lockup({ dark, subline }) {
  const icon = 96;
  const gap = 22;
  const size = icon * 0.6;
  const subSize = icon * 0.15;
  const inner = dark
    ? iconInner
        .replace(
          '<rect width="64" height="64" rx="14" fill="#0E1726"/>',
          `<rect x="0.5" y="0.5" width="63" height="63" rx="14" fill="${RAISED}" stroke="${RAISED_BORDER}"/>`,
        )
        .replaceAll('fill="#0E1726"', `fill="${RAISED}"`)
    : iconInner;
  const x0 = icon + gap;
  const cap = capHeight(sora, size);
  const blockH = subline ? cap + 10 + subSize : cap;
  const baseline = (icon - blockH) / 2 + cap;
  const lineW = advance(sora, 'Line', size, TRACK);
  const wiseW = advance(sora, 'Wise', size, TRACK);
  const parts = [
    textPath(sora, 'Line', x0, baseline, size, dark ? '#FFFFFF' : INK, TRACK),
    textPath(sora, 'Wise', x0 + lineW, baseline, size, TEAL, TRACK),
  ];
  let width = x0 + lineW + wiseW;
  if (subline) {
    const subText = 'network architecture diagrams';
    parts.push(
      textPath(plex, subText, x0, baseline + 10 + subSize, subSize, dark ? MUTED_DARK : MUTED_LIGHT, 0.02),
    );
    width = Math.max(width, x0 + advance(plex, subText, subSize, 0.02));
  }
  const pad = 21; // clear space ≈ port-node width at this size
  const W = Math.ceil(width + pad * 2);
  const H = icon + pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="LineWise">
  <g transform="translate(${pad} ${pad})"><svg x="0" y="0" width="${icon}" height="${icon}" viewBox="0 0 64 64">${inner}</svg>${parts.join('')}</g>
</svg>
`;
}

writeFileSync(join(root, 'svg/lockup-light.svg'), lockup({ dark: false, subline: false }));
writeFileSync(join(root, 'svg/lockup-dark.svg'), lockup({ dark: true, subline: false }));
writeFileSync(join(root, 'svg/lockup-light-subline.svg'), lockup({ dark: false, subline: true }));
writeFileSync(join(root, 'svg/lockup-dark-subline.svg'), lockup({ dark: true, subline: true }));

// 4. Shipped doc icon: the .lwise label as outlines (spec section 15).
const doc = readFileSync(join(root, 'svg/doc-icon.svg'), 'utf8');
const label = '.lwise';
const lw = advance(plex, label, 12);
const shipped = doc.replace(/<text[\s\S]*?<\/text>/, textPath(plex, label, 60 - lw / 2, 127, 12, '#FFFFFF'));
writeFileSync(join(root, 'svg/doc-icon-shipped.svg'), shipped);

console.log('Brand outputs written');
