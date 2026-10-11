// SPDX-License-Identifier: Apache-2.0
// Brand assets (spec section 15): masters, generated icons, the .lwise document icon and
// installer images (BRD-01..05, FR-APP-09, REL-03).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(import.meta.dirname, '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const BRAND = 'packages/brand/svg';
const TAURI = 'apps/desktop/src-tauri';
const conf = JSON.parse(read(`${TAURI}/tauri.conf.json`));
const winConf = JSON.parse(read(`${TAURI}/tauri.windows.conf.json`));
const manifest = JSON.parse(read(`${TAURI}/icons/brand-manifest.json`));
const sha = (p) =>
  createHash('sha256')
    .update(readFileSync(join(ROOT, p)))
    .digest('hex');
const REGEN = 'run `pnpm --filter @linewise/brand icons`';

/** The ```xml block that follows the spec's heading for a master. */
function specMaster(name) {
  const spec = read('docs/SPEC.md');
  const at = spec.indexOf(`**\`${name}\`**`);
  assert.ok(at >= 0, `spec has no master ${name}`);
  const block = /```xml\n([\s\S]*?)```/.exec(spec.slice(at));
  return block[1];
}

/** Sizes of the entries in a .ico file. */
function icoSizes(p) {
  const b = readFileSync(join(ROOT, p));
  assert.equal(b.readUInt16LE(2), 1, `${p} is not an icon file`);
  return Array.from({ length: b.readUInt16LE(4) }, (_, i) => b[6 + i * 16] || 256);
}

/** Entry types in a .icns file. */
function icnsTypes(p) {
  const b = readFileSync(join(ROOT, p));
  assert.equal(b.toString('ascii', 0, 4), 'icns', `${p} is not an icns file`);
  const types = [];
  for (let i = 8; i < b.length; i += b.readUInt32BE(i + 4)) types.push(b.toString('ascii', i, i + 4));
  return types;
}

function imageSize(p) {
  const b = readFileSync(join(ROOT, p));
  if (b.toString('ascii', 0, 2) === 'BM') return [b.readInt32LE(18), Math.abs(b.readInt32LE(22))];
  assert.equal(b.toString('ascii', 1, 4), 'PNG', `${p} is not a PNG or BMP`);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe('BRD-01 brand masters and lockups', () => {
  for (const name of ['app-icon.svg', 'app-icon-small.svg', 'logo-mark-mono.svg', 'doc-icon.svg']) {
    it(`${name} is the spec master, verbatim`, () => {
      assert.equal(read(`${BRAND}/${name}`).trim(), specMaster(name).trim());
    });
  }
  for (const name of ['lockup-light.svg', 'lockup-dark.svg', 'doc-icon-shipped.svg']) {
    it(`${name} draws its text as paths, so it needs no installed font`, () => {
      const svg = read(`${BRAND}/${name}`);
      assert.doesNotMatch(svg, /<text|font-family/);
      assert.match(svg, /<path fill="#(FFFFFF|0E1726)" d="M/);
    });
  }
  it('lockups pair the full mark with "Line" and a teal "Wise"', () => {
    for (const [name, line] of [
      ['lockup-light.svg', '#0E1726'],
      ['lockup-dark.svg', '#FFFFFF'],
    ]) {
      const svg = read(`${BRAND}/${name}`);
      assert.match(svg, /id="grid-layer"/, `${name} uses the full mark`);
      assert.match(svg, new RegExp(`<path fill="${line}" d=`), `${name}: "Line"`);
      assert.match(svg, /<path fill="#0D9488" d=/, `${name}: "Wise"`);
    }
  });
});

describe('BRD-02 app icons from the masters', () => {
  it(`were generated from the current masters (${REGEN} after changing one)`, () => {
    for (const [file, hash] of Object.entries(manifest.sources))
      assert.equal(sha(`${BRAND}/${file}`), hash, file);
    for (const [file, hash] of Object.entries(manifest.outputs))
      assert.equal(sha(`${TAURI}/${file}`), hash, `${file} differs from the generated file; ${REGEN}`);
  });
  it('every bundle icon exists, and the macOS icon set goes up to 1024 px', () => {
    for (const icon of conf.bundle.icon) assert.ok(manifest.outputs[icon], `${icon} is generated`);
    assert.ok(icnsTypes(`${TAURI}/icons/icon.icns`).includes('ic10'), '1024 px entry');
  });
  it('the Windows icon has 16–256 px entries, and the script draws 32 px and below from app-icon-small.svg', () => {
    assert.deepEqual(icoSizes(`${TAURI}/icons/icon.ico`), [16, 24, 32, 48, 64, 256]);
    const script = read('packages/brand/scripts/build-icons.mjs');
    assert.match(script, /size <= 32 \? small : size < 96 \? noGrid : full/);
    assert.match(script, /square\(full, 1024, 824\)/, 'macOS body at 824 of 1024 px');
    assert.match(script, /'tauri', 'icon'/);
  });
});

describe('BRD-03, FR-APP-09 the .lwise document icon is registered on both OSes', () => {
  const assoc = conf.bundle.fileAssociations[0];
  it('is generated from the shipped document icon for Windows and macOS', () => {
    assert.ok(manifest.sources['doc-icon-shipped.svg']);
    assert.deepEqual(icoSizes(`${TAURI}/icons/document.ico`), [16, 24, 32, 48, 64, 256]);
    assert.ok(icnsTypes(`${TAURI}/icons/document.icns`).includes('ic10'));
  });
  it('Windows: both installers give the file class document.ico, copied next to the app', () => {
    assert.equal(winConf.bundle.resources['icons/document.ico'], 'document.ico');
    // NSIS (Tauri's template names the class after the association).
    const nsis = conf.bundle.windows.nsis;
    const hooks = read(`${TAURI}/${nsis.installerHooks}`);
    assert.ok(
      hooks.includes(`"Software\\Classes\\${assoc.name}\\DefaultIcon" "" "$INSTDIR\\document.ico"`),
      'NSIS hook writes the DefaultIcon',
    );
    assert.match(hooks, /!macro NSIS_HOOK_POSTINSTALL/);
    // MSI (Tauri's template advertises the ProgId "<product>.<ext>").
    const wix = conf.bundle.windows.wix;
    const wxs = read(`${TAURI}/${wix.fragmentPaths[0]}`);
    assert.ok(wxs.includes(`Key="Software\\Classes\\${conf.productName}.${assoc.ext[0]}\\DefaultIcon"`));
    assert.ok(wxs.includes('Value="[INSTALLDIR]document.ico"'));
    for (const id of wix.componentRefs) assert.ok(wxs.includes(`<Component Id="${id}"`), id);
  });
  it('macOS: the Info.plist declares the type with document.icns, which the bundle copies', () => {
    const mac = conf.bundle.macOS;
    assert.equal(mac.files['Resources/document.icns'], 'icons/document.icns');
    const plist = read(`${TAURI}/${mac.infoPlist}`);
    const types = plist.slice(
      plist.indexOf('CFBundleDocumentTypes'),
      plist.indexOf('UTExportedTypeDeclarations'),
    );
    for (const value of [assoc.name, assoc.role, assoc.ext[0], 'document.icns', `${conf.identifier}.diagram`])
      assert.ok(types.includes(`<string>${value}</string>`), `CFBundleDocumentTypes has ${value}`);
    const uti = plist.slice(plist.indexOf('UTExportedTypeDeclarations'));
    for (const value of [`${conf.identifier}.diagram`, 'document.icns', assoc.mimeType, assoc.ext[0]])
      assert.ok(uti.includes(`<string>${value}</string>`), `UTExportedTypeDeclarations has ${value}`);
  });
});

describe('BRD-04 brand in the installers and the README', () => {
  it('NSIS, WiX and DMG images exist at the sizes the installers expect', () => {
    const { nsis, wix } = conf.bundle.windows;
    const { dmg } = conf.bundle.macOS;
    const want = [
      [nsis.headerImage, 150, 57],
      [nsis.sidebarImage, 164, 314],
      [wix.bannerPath, 493, 58],
      [wix.dialogImagePath, 493, 312],
      [dmg.background, dmg.windowSize.width, dmg.windowSize.height],
    ];
    for (const [file, w, h] of want) {
      assert.ok(manifest.outputs[file], `${file} is generated`);
      assert.deepEqual(imageSize(`${TAURI}/${file}`), [w, h], file);
    }
    assert.match(read('packages/brand/scripts/build-icons.mjs'), /\(180, 230\) and \(480, 230\)/);
    assert.deepEqual(dmg.appPosition, { x: 180, y: 230 });
    assert.deepEqual(dmg.applicationFolderPosition, { x: 480, y: 230 });
  });
  it('the README header is the lockup, and the welcome screen and About dialog show the mark', () => {
    assert.match(read('README.md').slice(0, 300), /packages\/brand\/svg\/lockup-light-subline\.svg/);
    for (const f of ['WelcomeDialog.tsx', 'AboutDialog.tsx'])
      assert.match(read(`apps/desktop/src/dialogs/${f}`), /<BrandMark size=\{\d+\} \/>[\s\S]*<Wordmark/);
    const mark = read('apps/desktop/src/components/BrandMark.tsx');
    assert.match(mark, /@linewise\/brand\/svg\/app-icon\.svg\?raw/);
    assert.match(mark, /@linewise\/brand\/svg\/app-icon-small\.svg\?raw/);
  });
});

describe('BRD-05 app theme colors', () => {
  const css = read('apps/desktop/src/styles.css');
  const block = (selector) => {
    const at = css.indexOf(selector);
    return css.slice(at, css.indexOf('\n}', at));
  };
  it('the accent is Link teal in both themes and the dark base surface is Ink', () => {
    assert.match(block(':root {'), /--accent: #0d9488;/);
    for (const dark of [":root:not([data-theme='light'])", ":root[data-theme='dark']"]) {
      assert.match(block(dark), /--accent: #0d9488;/, dark);
      assert.match(block(dark), /--bg: #0e1726;/, dark);
    }
  });
  it('every text color meets 4.5:1 on every surface in both themes (NFR-A11Y-04)', () => {
    const lum = (hex) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a, b) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    for (const theme of [':root {', ":root[data-theme='dark']"]) {
      const v = Object.fromEntries(
        [...block(theme).matchAll(/--([\w-]+): (#[0-9a-f]{6});/g)].map((m) => [m[1], m[2]]),
      );
      const pairs = [['accent-contrast', 'accent-fill']];
      for (const text of ['text', 'text-muted', 'text-subtle', 'accent-ink'])
        for (const bg of ['bg', 'surface', 'surface-2', 'surface-3']) pairs.push([text, bg]);
      for (const [fg, bg] of pairs)
        assert.ok(
          ratio(v[fg], v[bg]) >= 4.5,
          `${theme} --${fg} on --${bg}: ${ratio(v[fg], v[bg]).toFixed(2)}`,
        );
    }
  });
});
