// SPDX-License-Identifier: Apache-2.0
// The documentation site (DOC-01, DOC-02, BRD-04): every guide topic has a page in the sidebar,
// links to repo files outside the site go to GitHub, and the site carries the brand.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { siteHref } from '../docs/.vitepress/repoLinks.ts';
import {
  detectPlatform,
  formatSize,
  installers,
  pickRelease,
  recommended,
} from '../docs/.vitepress/theme/releases.ts';

const ROOT = join(import.meta.dirname, '..');
const DOCS = join(ROOT, 'docs');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const config = read('docs/.vitepress/config.mts');
/** The page file a site link points to. */
const pageFile = (link) => {
  const path = link.replace(/^\//, '').replace(/#.*$/, '');
  return path === '' || path.endsWith('/') ? `docs/${path}index.md` : `docs/${path}.md`;
};

describe('DOC-01 user guide', () => {
  const topics = [
    ['getting started', '/user/getting-started'],
    ['drawing basics', '/user/drawing'],
    ['devices and interfaces', '/user/devices'],
    ['links', '/user/links'],
    ['VLANs and IPAM', '/user/vlans-ipam'],
    ['views', '/user/views'],
    ['validation', '/user/validation'],
    ['importing from Cisco CLI', '/user/import'],
    ['exporting', '/user/export'],
    ['shortcuts', '/user/shortcuts'],
    ['FAQ', '/user/faq'],
  ];
  for (const [topic, link] of topics)
    it(`has a page for ${topic}, in the sidebar and linked from the overview`, () => {
      assert.ok(existsSync(join(ROOT, pageFile(link))), pageFile(link));
      assert.ok(config.includes(`link: '${link}'`), `${link} in the sidebar`);
      assert.match(read('docs/user/index.md'), new RegExp(`\\]\\(${link.split('/').pop()}\\.md\\)`));
      assert.match(read(pageFile(link)), /^# \S/m, 'has a title');
    });
});

describe('DOC-02 developer guide', () => {
  it('covers the architecture with a diagram, commands, adding a feature, releases and signing', () => {
    const arch = read('docs/dev/architecture.md');
    assert.match(arch, /```mermaid/);
    assert.match(arch, /^## Commands/m);
    assert.match(read('docs/dev/index.md'), /^## Adding a feature end to end/m);
    const release = read('docs/dev/release.md');
    for (const h of [
      '## Cutting a release',
      '### Updater signing',
      '### macOS (Developer ID + notarization',
      '### Windows',
    ])
      assert.ok(release.includes(h), h);
  });
  it('every sidebar and nav link points to a page that exists', () => {
    for (const [, link] of config.matchAll(/link: '(\/[^']*)'/g))
      assert.ok(existsSync(join(ROOT, pageFile(link))), `${link} → ${pageFile(link)}`);
  });
  it('the release checklist covers every check the spec lists', () => {
    const list = read('docs/release-checklist.md');
    for (const s of [
      'Windows 10',
      'Windows 11 ARM64',
      'macOS Intel',
      'macOS Apple Silicon',
      'SmartScreen',
      'Gatekeeper',
      'File association',
      'Auto-update',
      'Dark mode',
      '200%',
      'VoiceOver',
      'Narrator',
      'Uninstall',
    ])
      assert.ok(list.includes(s), s);
  });
});

describe('docs site links', () => {
  it('keeps links to site pages and points everything else at GitHub', () => {
    const gh = 'https://github.com/gavenrobertson/linewise';
    assert.equal(siteHref('architecture.md#commands', 'dev/index.md', DOCS), 'architecture.md#commands');
    assert.equal(siteHref('../file-format.md', 'dev/index.md', DOCS), '../file-format.md');
    assert.equal(siteHref('../../CONTRIBUTING.md', 'dev/index.md', DOCS), `${gh}/blob/main/CONTRIBUTING.md`);
    assert.equal(siteHref('../SPEC.md#11', 'dev/index.md', DOCS), `${gh}/blob/main/docs/SPEC.md#11`);
    assert.equal(siteHref('../adr/', 'dev/index.md', DOCS), `${gh}/tree/main/docs/adr`);
    assert.equal(siteHref('../../bench', 'dev/architecture.md', DOCS), `${gh}/tree/main/bench`);
    assert.equal(siteHref('../schema/v1.json', 'file-format.md', DOCS), `${gh}/blob/main/schema/v1.json`);
    for (const keep of ['https://example.com', '#anchor', '/user/'])
      assert.equal(siteHref(keep, 'index.md', DOCS), keep);
  });
  it('working documents are not published', () => {
    for (const f of ['SPEC.md', 'AGENT_PROMPT.md', 'HUMAN-TODO.md', 'reports/**'])
      assert.ok(read('docs/.vitepress/repoLinks.ts').includes(`'${f}'`), f);
  });
});

describe('BRD-04 docs-site logo and favicon', () => {
  it('are the brand masters, unchanged', () => {
    const brand = (f) => read(`packages/brand/svg/${f}`);
    assert.equal(read('docs/public/favicon.svg'), brand('app-icon-small.svg'));
    assert.equal(read('docs/public/logo-mark.svg'), brand('app-icon-small.svg'));
    assert.equal(read('docs/public/app-icon.svg'), brand('app-icon.svg'));
    assert.match(config, /rel: 'icon', type: 'image\/svg\+xml', href: `\$\{base\}favicon\.svg`/);
    assert.match(config, /logo: \{ src: '\/logo-mark\.svg'/);
    // The download page (the site's home) leads with the full mark.
    assert.match(read('docs/index.md'), /<LandingPage \/>/);
    assert.match(read('docs/.vitepress/theme/LandingPage.vue'), /withBase\('\/app-icon\.svg'\)/);
  });
  it('moves to a custom domain only when the DOCS_DOMAIN repository variable is set', () => {
    assert.match(config, /const base = domain \? '\/' : '\/LineWise\/';/);
    assert.match(config, /process\.env\.DOCS_DOMAIN/);
    assert.match(read('.github/workflows/docs.yml'), /DOCS_DOMAIN: \$\{\{ vars\.DOCS_DOMAIN \}\}/);
    // The app links to the github.io address, which GitHub redirects to the custom domain.
    assert.match(
      read('apps/desktop/src/lib/actions.ts'),
      /DOCS_URL = 'https:\/\/gavenrobertson\.github\.io\/LineWise\/'/,
    );
  });
  it('the site is published to GitHub Pages from main', () => {
    const wf = read('.github/workflows/docs.yml');
    assert.match(wf, /pnpm docs:build/);
    assert.match(wf, /actions\/deploy-pages@/);
    assert.match(wf, /github\.ref == 'refs\/heads\/main'/);
  });
});

describe('docs site look and feel', () => {
  const landing = read('docs/.vitepress/theme/LandingPage.vue');
  it('opens dark like the app, and the theme switch spreads the new theme from the switch', () => {
    assert.match(config, /appearance: 'dark'/);
    const layout = read('docs/.vitepress/theme/Layout.vue');
    assert.match(layout, /provide\('toggle-appearance'/);
    assert.match(layout, /startViewTransition/);
    assert.match(layout, /prefers-reduced-motion: no-preference/);
    assert.match(read('docs/.vitepress/theme/index.ts'), /Layout,/);
  });
  it('holds the reveal on its last frame, so switching to dark does not flash the light page', () => {
    const layout = read('docs/.vitepress/theme/Layout.vue');
    const animate = layout.slice(layout.indexOf('.animate('));
    assert.match(animate.slice(0, animate.indexOf(');')), /fill: 'forwards'/);
  });
  it('follows the theme on the landing page, down to the screenshot', () => {
    assert.match(landing, /screenshot-dark\.png/);
    assert.match(landing, /screenshot-light\.png/);
    assert.match(landing, /html:not\(\.dark\) \.shot-light/);
    assert.ok(existsSync(join(ROOT, 'docs/img/screenshot-light.png')));
  });
  it('makes the feature cards links to the guide, and every one of them exists', () => {
    const links = [...landing.matchAll(/link: '(\/[^']+)'/g)].map((m) => m[1]);
    assert.equal(links.length, 6);
    for (const l of links) assert.ok(existsSync(join(ROOT, pageFile(l))), l);
    assert.match(landing, /<a v-for="f in features"[^>]*class="feature"/);
  });
  it('stills every animation under reduced motion', () => {
    assert.match(landing, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none/);
    assert.match(read('docs/.vitepress/theme/brand.css'), /@media \(prefers-reduced-motion: reduce\)/);
  });
});

describe('download page', () => {
  const v = '1.2.0';
  const asset = (name, size = 8_000_000) => ({
    name: `LineWise_${v}_${name}`,
    size,
    browser_download_url: `https://example.com/${name}`,
  });
  const release = (tag, prerelease, published_at, draft = false) => ({
    tag_name: tag,
    html_url: `https://example.com/${tag}`,
    draft,
    prerelease,
    published_at,
    assets: [],
  });

  it('offers the newest stable release, or the newest beta while there is none; never a draft', () => {
    const beta = release('v1.3.0-beta', true, '2026-12-01T00:00:00Z');
    const stable = release('v1.2.0', false, '2026-11-01T00:00:00Z');
    const draft = release('v2.0.0', false, null, true);
    assert.deepEqual(pickRelease([draft, beta, stable]), { release: stable, beta });
    assert.deepEqual(pickRelease([draft, beta]), { release: beta, beta: null });
    assert.deepEqual(pickRelease([draft]), { release: null, beta: null });
    const oldBeta = release('v1.1.0-beta', true, '2026-10-01T00:00:00Z');
    assert.deepEqual(pickRelease([stable, oldBeta]), { release: stable, beta: null });
  });

  it('finds each installer the release workflow builds and skips signatures and updater archives', () => {
    const r = release(`v${v}`, false, '2026-11-01T00:00:00Z');
    r.assets = [
      asset('x64-setup.exe.sig', 400),
      asset('x64-setup.exe', 8_074_035),
      asset('arm64-setup.exe'),
      asset('x64_en-US.msi'),
      asset('universal.app.tar.gz'),
      asset('universal.dmg', 13_841_203),
      { name: 'SHA256SUMS.txt', size: 900, browser_download_url: 'https://example.com/sums' },
    ];
    const found = installers(r);
    assert.deepEqual(Object.keys(found).sort(), ['macos', 'windows-arm64', 'windows-msi', 'windows-x64']);
    assert.equal(found['windows-x64'].name, `LineWise_${v}_x64-setup.exe`);
    assert.equal(formatSize(found['windows-x64'].size), '7.7 MB');
    assert.equal(formatSize(found.macos.size), '13.2 MB');
  });

  it('matches the installer names the release workflow produced for 0.9.0-beta', () => {
    const names = [
      'LineWise_0.9.0-beta_arm64-setup.exe',
      'LineWise_0.9.0-beta_universal.dmg',
      'LineWise_0.9.0-beta_x64-setup.exe',
      'LineWise_0.9.0-beta_x64_en-US.msi',
    ];
    const r = release('v0.9.0-beta', true, '2026-10-12T00:00:00Z');
    r.assets = names.map((name) => ({ name, size: 1, browser_download_url: name }));
    assert.equal(Object.keys(installers(r)).length, 4);
  });

  it("recommends the installer for the visitor's computer", () => {
    const win = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0';
    const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15 Safari/605.1.15';
    assert.equal(detectPlatform(win, 'Win32'), 'windows-x64');
    assert.equal(detectPlatform(win, 'Windows', 'arm'), 'windows-arm64');
    assert.equal(detectPlatform(mac, 'MacIntel'), 'macos');
    assert.equal(detectPlatform('Mozilla/5.0 (X11; Linux x86_64)', 'Linux x86_64'), 'linux');
    assert.equal(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 'iPhone'), 'other');
    assert.equal(recommended('windows-arm64'), 'windows-arm64');
    assert.equal(recommended('macos'), 'macos');
    assert.equal(recommended('linux'), null);
  });
});
