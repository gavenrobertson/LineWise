// SPDX-License-Identifier: Apache-2.0
// Community files, ADRs, docs and governance (OSS-10..14, DOC-01..04, DOC-06, BRD-06, NFR-MNT-03, REL-20).
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const ROOT = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const has = (p) => existsSync(join(ROOT, p));

test('OSS-10: README has the pitch, screenshot, downloads, features, build steps, contributing and license', () => {
  const md = read('README.md');
  for (const s of [
    '## Download',
    '## Features',
    '## Build from source',
    '## Contributing',
    '## License',
    'docs/img/',
  ])
    assert.ok(md.includes(s), s);
  assert.match(md, /\*\*LineWise is a free, open-source/);
});

test('OSS-11: CONTRIBUTING covers setup on both OSes, standards, commits, extension points and tests', () => {
  const md = read('CONTRIBUTING.md');
  for (const s of [
    '### Windows 10/11',
    '### macOS 12+',
    '## Project structure',
    '## Coding standards',
    '## Commits and pull requests',
    '## Running the tests',
    '## Adding a device template',
    '## Adding an icon',
    '## Adding a validation rule',
    '## Adding an importer',
  ])
    assert.ok(md.includes(s), s);
});

test('OSS-12: code of conduct, security, privacy, governance and code owners exist', () => {
  for (const f of [
    'CODE_OF_CONDUCT.md',
    'SECURITY.md',
    'PRIVACY.md',
    'GOVERNANCE.md',
    '.github/CODEOWNERS',
    'LICENSE',
  ])
    assert.ok(has(f), f);
  assert.match(read('CODE_OF_CONDUCT.md'), /Contributor Covenant/);
  assert.match(read('SECURITY.md'), /security\/advisories\/new/);
  assert.match(read('LICENSE'), /Apache License\s+Version 2\.0/);
});

test('OSS-13: issue templates for bugs, features, templates and icons; PR checklist', () => {
  const dir = '.github/ISSUE_TEMPLATE';
  for (const f of ['bug_report.yml', 'feature_request.yml', 'device_template.yml', 'icon_request.yml'])
    assert.ok(has(`${dir}/${f}`), f);
  assert.match(read(`${dir}/bug_report.yml`), /Operating system[\s\S]*LineWise version[\s\S]*Diagnostics/);
  assert.match(read(`${dir}/device_template.yml`), /datasheet/i);
  const pr = read('.github/pull_request_template.md');
  for (const s of ['Tests', 'Docs', 'CHANGELOG', 'Screenshots']) assert.ok(pr.includes(s), s);
});

test('OSS-14: the required labels are defined', () => {
  const yml = read('.github/labels.yml');
  for (const l of [
    'good first issue',
    'help wanted',
    'device-template',
    'importer',
    'validation',
    'a11y',
    'platform:windows',
    'platform:macos',
  ])
    assert.ok(yml.includes(`name: ${l.includes(':') ? `'${l}'` : l}`), l);
});

test('DOC-04, NFR-MNT-03: ADRs 0001-0005 exist with status and decision', () => {
  const adrs = readdirSync(join(ROOT, 'docs/adr')).sort();
  const want = [
    '0001-tauri-over-electron',
    '0002-react-flow-over-maxgraph',
    '0003-command-patch-architecture',
    '0004-file-format',
    '0005-license',
  ];
  for (const w of want) {
    const f = adrs.find((a) => a.startsWith(w));
    assert.ok(f, w);
    const md = read(`docs/adr/${f}`);
    assert.match(md, /Status: Accepted/);
    assert.match(md, /## Decision/);
  }
});

test('DOC-06: TRACEABILITY.md lists requirement, module, test and status columns', () => {
  assert.match(
    read('TRACEABILITY.md'),
    /\| Requirement \| Priority \| Module\(s\) \| Test\(s\) \| Status \|/,
  );
});

test('REL-20: Conventional Commits are enforced and release-please manages versions and the changelog', () => {
  assert.match(read('commitlint.config.js'), /config-conventional/);
  assert.match(read('.husky/commit-msg'), /commitlint/);
  const cfg = JSON.parse(read('release-please-config.json'));
  assert.equal(cfg['changelog-path'], 'CHANGELOG.md');
  assert.ok(has('.github/workflows/release-please.yml'));
  assert.match(read('CHANGELOG.md'), /## \[Unreleased\]/);
});

test('BRD-06: docs/brand.md documents the mark, colors, fonts, sizes and files', () => {
  const md = read('docs/brand.md');
  for (const hex of ['#0E1726', '#1A2436', '#0D9488', '#FFFFFF', '#F4F6F8', '#4B5563', '#A3AEBF'])
    assert.ok(md.includes(hex), hex);
  for (const word of [
    'Sora',
    'IBM Plex Mono',
    'Lockup',
    'app-icon-small.svg',
    'logo-mark-mono.svg',
    'doc-icon.svg',
  ])
    assert.ok(md.includes(word), word);
  for (const f of ['app-icon.svg', 'app-icon-small.svg', 'logo-mark-mono.svg', 'doc-icon.svg'])
    assert.ok(has(`packages/brand/svg/${f}`), f);
});

test('DOC-01, DOC-02, DOC-03: user guide, developer guide and file-format spec exist and link up', () => {
  const user = read('docs/user/index.md');
  for (const topic of [
    'Getting started',
    'Drawing basics',
    'Views',
    'Importing',
    'Exporting',
    'Keyboard shortcuts',
  ])
    assert.ok(user.includes(topic), topic);
  const dev = read('docs/dev/index.md');
  for (const link of ['architecture.md', 'release.md', 'file-format.md']) assert.ok(dev.includes(link), link);
  assert.match(read('docs/dev/architecture.md'), /```mermaid/);
  const ff = read('docs/file-format.md');
  assert.ok(ff.includes('schema/v1.json') && ff.includes('examples/branch-office.lwise'));
  assert.ok(has('docs/examples/branch-office.lwise'));
  // Every docs link in the README resolves.
  for (const [, p] of read('README.md').matchAll(/\]\((docs\/[^)#]+)\)/g)) assert.ok(has(p), p);
});

test('OSS-04: icons and templates are project-original; contributions state source and license', () => {
  assert.match(
    read('CONTRIBUTING.md'),
    /## Licensing of icons and templates \(OSS-04\)[\s\S]*Apache-2\.0[\s\S]*source/,
  );
  for (const t of ['icon_request.yml', 'device_template.yml'])
    assert.match(read(`.github/ISSUE_TEMPLATE/${t}`), /id: license[\s\S]*required: true/, t);
  const dir = 'packages/device-library/templates';
  for (const vendor of readdirSync(join(ROOT, dir)))
    for (const f of readdirSync(join(ROOT, dir, vendor))) {
      const t = JSON.parse(read(`${dir}/${vendor}/${f}`));
      assert.ok(t.contributor, `${f} names its contributor`);
      if (!t.generic)
        assert.ok(t.sourceUrl || t.verified === false, `${f} cites a datasheet or is unverified`);
    }
  for (const style of ['classic', 'line'])
    for (const f of readdirSync(join(ROOT, 'packages/device-library/icons', style))) {
      const svg = read(`packages/device-library/icons/${style}/${f}`);
      assert.doesNotMatch(
        svg,
        /<image|href=|<script|cisco/i,
        `${style}/${f} is a self-contained original drawing`,
      );
    }
});
