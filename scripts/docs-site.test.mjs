// SPDX-License-Identifier: Apache-2.0
// The documentation site (DOC-01, DOC-02, BRD-04): every guide topic has a page in the sidebar,
// links to repo files outside the site go to GitHub, and the site carries the brand.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { siteHref } from '../docs/.vitepress/repoLinks.ts';

const ROOT = join(import.meta.dirname, '..');
const DOCS = join(ROOT, 'docs');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const config = read('docs/.vitepress/config.mts');
/** The page file a site link points to. */
const pageFile = (link) => {
  const path = link.replace(/^\//, '');
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
    assert.equal(read('docs/public/lockup-light.svg'), brand('lockup-light-subline.svg'));
    assert.equal(read('docs/public/lockup-dark.svg'), brand('lockup-dark-subline.svg'));
    assert.match(config, /rel: 'icon', type: 'image\/svg\+xml', href: `\$\{base\}favicon\.svg`/);
    assert.match(config, /logo: \{ src: '\/logo-mark\.svg'/);
    assert.match(read('docs/index.md'), /light: \/lockup-light\.svg\n\s+dark: \/lockup-dark\.svg/);
  });
  it('the site is published to GitHub Pages from main', () => {
    const wf = read('.github/workflows/docs.yml');
    assert.match(wf, /pnpm docs:build/);
    assert.match(wf, /actions\/deploy-pages@/);
    assert.match(wf, /github\.ref == 'refs\/heads\/main'/);
  });
});
