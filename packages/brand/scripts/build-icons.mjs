// SPDX-License-Identifier: Apache-2.0
/**
 * App icons, the .lwise document icon and installer images from the brand masters
 * (BRD-02, BRD-03, BRD-04). Run with `pnpm --filter @linewise/brand icons` after changing a master;
 * the outputs are checked in, and brand-manifest.json records the hashes the repo tests compare.
 *
 * - `tauri icon` makes the platform set from a 1024 px render of app-icon.svg. The macOS .icns
 *   comes from a second render with the body at 824 px, centred, as in Apple's template.
 * - The size rules of spec section 15 then apply to every PNG and to the Windows .ico: 32 px and
 *   below use app-icon-small.svg, under 96 px the grid layer is removed, larger sizes use the full mark.
 * - The document icon is doc-icon-shipped.svg (label as paths), as a .ico for Windows and a .icns
 *   for macOS; the installers register it for .lwise files (FR-APP-09).
 *
 * Rendering uses Chromium through playwright-core (set PW_CHROMIUM_PATH to use a preinstalled one).
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(root, '../..');
const tauriDir = join(repo, 'apps/desktop/src-tauri');
const iconsDir = join(tauriDir, 'icons');
const installerDir = join(tauriDir, 'installer');
const svg = (name) => readFileSync(join(root, 'svg', name), 'utf8');

const INK = '#0E1726';
const PANEL = '#F4F6F8';
const MUTED = '#4B5563';

const SOURCES = [
  'app-icon.svg',
  'app-icon-small.svg',
  'doc-icon-shipped.svg',
  'lockup-light.svg',
  'lockup-dark.svg',
];
const full = svg('app-icon.svg');
const noGrid = full.replace(/\s*<rect id="grid-layer"[^>]*\/>/, '');
const small = svg('app-icon-small.svg');
const doc = svg('doc-icon-shipped.svg');
const lockupLight = svg('lockup-light.svg');
const lockupDark = svg('lockup-dark.svg');
if (noGrid === full) throw new Error('app-icon.svg has no grid-layer to remove');

/** The master for a rendered size (spec section 15, size rules). */
const appMaster = (size) => (size <= 32 ? small : size < 96 ? noGrid : full);

/** The same SVG with a new viewBox, to cut a part out of a lockup. */
const crop = (text, box) =>
  text.replace(/<svg[^>]*>/, (tag) =>
    tag.replace(/viewBox="[^"]*"/, `viewBox="${box}"`).replace(/\s(width|height)="[^"]*"/g, ''),
  );
// Lockup geometry from build-brand.mjs: 21 clear space, 96 icon, 22 gap, then the wordmark.
const lockupIcon = (text) => crop(text, '21 21 96 96');
const wordmark = (text) => {
  const w = Number(/viewBox="0 0 (\d+)/.exec(text)[1]);
  return crop(text, `139 41 ${w - 139 - 21} 56`);
};
const dataUrl = (text) => `data:image/svg+xml;base64,${Buffer.from(text).toString('base64')}`;

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
const page = await browser.newPage();

/**
 * Draws SVG layers onto a canvas and returns PNG bytes, or raw RGBA for BMP output.
 * Each layer is { svg, x, y, w, h }; the SVG is rasterized at its drawn size.
 */
async function render(width, height, layers, { background, rgba = false } = {}) {
  const items = layers.map((l) => ({ ...l, src: dataUrl(l.svg) }));
  const out = await page.evaluate(
    async ({ width, height, items, background, rgba }) => {
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      if (background) {
        g.fillStyle = background;
        g.fillRect(0, 0, width, height);
      }
      for (const it of items) {
        const img = new Image(Math.round(it.w), Math.round(it.h));
        img.src = it.src;
        await img.decode();
        g.drawImage(img, it.x, it.y, it.w, it.h);
      }
      if (rgba) {
        const px = g.getImageData(0, 0, width, height).data;
        let bin = '';
        for (let i = 0; i < px.length; i += 0x8000) bin += String.fromCharCode(...px.subarray(i, i + 0x8000));
        return { rgba: btoa(bin) };
      }
      return { png: c.toDataURL('image/png').split(',')[1] };
    },
    { width, height, items, background, rgba },
  );
  return Buffer.from(out.png ?? out.rgba, 'base64');
}

/** Sizes the SVG's root to the drawn size so the browser rasterizes it there, not scaled up. */
const sized = (text, w, h) =>
  text.replace(/<svg[^>]*>/, (tag) =>
    tag.replace(/\s(width|height)="[^"]*"/g, '').replace('<svg', `<svg width="${w}" height="${h}"`),
  );
const layer = (text, x, y, w, h) => ({ svg: sized(text, w, h), x, y, w, h });

const square = (text, size, body = size) =>
  render(size, size, [layer(text, (size - body) / 2, (size - body) / 2, body, body)]);
/** The document icon (120 × 152) centred on a square canvas, `body` tall. */
const docSquare = (size, body = size) => {
  const w = (body * 120) / 152;
  return render(size, size, [layer(doc, (size - w) / 2, (size - body) / 2, w, body)]);
};

/** A Windows .ico with PNG entries (Windows Vista and later). */
function ico(entries) {
  const head = Buffer.alloc(6 + entries.length * 16);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(entries.length, 4);
  let offset = head.length;
  entries.forEach(({ size, png }, i) => {
    const e = 6 + i * 16;
    head.writeUInt8(size >= 256 ? 0 : size, e);
    head.writeUInt8(size >= 256 ? 0 : size, e + 1);
    head.writeUInt16LE(1, e + 4);
    head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(png.length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });
  return Buffer.concat([head, ...entries.map((e) => e.png)]);
}

/** A 24-bit bottom-up BMP, the format NSIS and WiX installer images need. */
function bmp(width, height, rgba) {
  const row = Math.ceil((width * 3) / 4) * 4;
  const out = Buffer.alloc(54 + row * height);
  out.write('BM', 0, 'ascii');
  out.writeUInt32LE(out.length, 2);
  out.writeUInt32LE(54, 10);
  out.writeUInt32LE(40, 14);
  out.writeInt32LE(width, 18);
  out.writeInt32LE(height, 22);
  out.writeUInt16LE(1, 26);
  out.writeUInt16LE(24, 28);
  out.writeUInt32LE(row * height, 34);
  out.writeInt32LE(2835, 38);
  out.writeInt32LE(2835, 42);
  for (let y = 0; y < height; y++) {
    const dst = 54 + (height - 1 - y) * row;
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4;
      out[dst + x * 3] = rgba[s + 2];
      out[dst + x * 3 + 1] = rgba[s + 1];
      out[dst + x * 3 + 2] = rgba[s];
    }
  }
  return out;
}

const pngSize = (buf) => buf.readUInt32BE(16);
const tmp = mkdtempSync(join(tmpdir(), 'lw-icons-'));
function tauriIcon(png, out) {
  const src = join(tmp, `${out}.png`);
  writeFileSync(src, png);
  const r = spawnSync(
    'pnpm',
    ['--filter', '@linewise/desktop', 'exec', 'tauri', 'icon', src, '-o', join(tmp, out)],
    {
      cwd: repo,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    },
  );
  if (r.status !== 0) throw new Error(`tauri icon failed for ${out}`);
  return join(tmp, out);
}

try {
  // 1. The platform set from `tauri icon` (BRD-02). Mobile icons are not shipped.
  const set = tauriIcon(await square(full, 1024), 'app');
  const mac = tauriIcon(await square(full, 1024, 824), 'mac');
  rmSync(iconsDir, { recursive: true, force: true });
  mkdirSync(iconsDir, { recursive: true });
  for (const f of readdirSync(set)) if (f.endsWith('.png')) copyFileSync(join(set, f), join(iconsDir, f));
  copyFileSync(join(mac, 'icon.icns'), join(iconsDir, 'icon.icns'));

  // 2. Size rules on every PNG, rendered at its own size rather than scaled from 1024.
  for (const f of readdirSync(iconsDir).filter((n) => n.endsWith('.png'))) {
    const size = pngSize(readFileSync(join(iconsDir, f)));
    writeFileSync(join(iconsDir, f), await square(appMaster(size), size));
  }
  const ICO_SIZES = [16, 24, 32, 48, 64, 256];
  const appIco = [];
  for (const size of ICO_SIZES) appIco.push({ size, png: await square(appMaster(size), size) });
  writeFileSync(join(iconsDir, 'icon.ico'), ico(appIco));

  // 3. The .lwise document icon (BRD-03).
  const docIco = [];
  for (const size of ICO_SIZES) docIco.push({ size, png: await docSquare(size) });
  writeFileSync(join(iconsDir, 'document.ico'), ico(docIco));
  const docMac = tauriIcon(await docSquare(1024, 824), 'doc');
  copyFileSync(join(docMac, 'icon.icns'), join(iconsDir, 'document.icns'));

  // 4. Installer images (BRD-04).
  mkdirSync(installerDir, { recursive: true });
  const icon = (text) => lockupIcon(text);
  const writeBmp = async (name, w, h, layers, background) =>
    writeFileSync(
      join(installerDir, name),
      bmp(w, h, await render(w, h, layers, { background, rgba: true })),
    );
  // NSIS header (150 × 57) and welcome sidebar (164 × 314).
  await writeBmp('nsis-header.bmp', 150, 57, [layer(lockupLight, 6, 5, (47 * 417) / 138, 47)], '#FFFFFF');
  const side = (h) => [
    layer(icon(lockupDark), 34, h / 2 - 84, 96, 96),
    layer(wordmark(lockupDark), 22, h / 2 + 30, 120, 26),
  ];
  await writeBmp('nsis-sidebar.bmp', 164, 314, side(314), INK);
  // WiX banner (493 × 58, icon on the right; WiX draws the text) and dialog (493 × 312, art on the left 164 px).
  await writeBmp('wix-banner.bmp', 493, 58, [layer(icon(lockupLight), 493 - 48, 9, 40, 40)], '#FFFFFF');
  await writeBmp(
    'wix-dialog.bmp',
    493,
    312,
    [
      layer(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 164 312"><rect width="164" height="312" fill="${INK}"/></svg>`,
        0,
        0,
        164,
        312,
      ),
      ...side(312),
    ],
    '#FFFFFF',
  );
  // macOS disk image background (660 × 400): the lockup and an arrow from the app to Applications,
  // whose icons sit at (180, 230) and (480, 230) (tauri.conf.json, bundle.macOS.dmg).
  const arrow = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 40"><path d="M8 20H146M132 8L148 20L132 32" fill="none" stroke="${MUTED}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  writeFileSync(
    join(installerDir, 'dmg-background.png'),
    await render(
      660,
      400,
      [
        layer(lockupLight, (660 - (64 * 417) / 138) / 2, 28, (64 * 417) / 138, 64),
        layer(arrow, 250, 210, 160, 40),
      ],
      {
        background: PANEL,
      },
    ),
  );

  // 5. The manifest the repo tests read.
  const hash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
  const outputs = {};
  for (const dir of [iconsDir, installerDir])
    for (const f of readdirSync(dir).sort())
      if (f !== 'brand-manifest.json')
        outputs[relative(tauriDir, join(dir, f)).replaceAll('\\', '/')] = hash(join(dir, f));
  const sources = Object.fromEntries(SOURCES.map((s) => [s, hash(join(root, 'svg', s))]));
  writeFileSync(join(iconsDir, 'brand-manifest.json'), `${JSON.stringify({ sources, outputs }, null, 2)}\n`);
  console.log(`Icons and installer images written (${Object.keys(outputs).length} files)`);
} finally {
  await browser.close();
  rmSync(tmp, { recursive: true, force: true });
}
