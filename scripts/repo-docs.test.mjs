// SPDX-License-Identifier: Apache-2.0
// Community files, ADRs and governance (OSS-10..14, DOC-04, DOC-06, NFR-MNT-03, REL-20).
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
