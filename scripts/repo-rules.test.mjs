// SPDX-License-Identifier: Apache-2.0
// Repository-wide rules that lint cannot express (OSS-01, NFR-MNT-02, spec section 9).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const ROOT = resolve(import.meta.dirname, '..');
const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

test('every source file starts with an SPDX license identifier (OSS-01)', () => {
  const sources = tracked.filter(
    (f) => /\.(ts|tsx|mts|js|mjs|cjs|rs|css)$/.test(f) && !f.includes('/fixtures/'),
  );
  assert.ok(sources.length > 100);
  const missing = sources.filter(
    (f) => !/SPDX-License-Identifier: [\w.-]+/.test(read(f).split('\n').slice(0, 3).join('\n')),
  );
  assert.deepEqual(missing, []);
});

test('core and parsers depend on no UI, DOM or native packages (NFR-MNT-02)', () => {
  for (const pkg of ['packages/core', 'packages/parsers']) {
    const json = JSON.parse(read(`${pkg}/package.json`));
    const deps = Object.keys({ ...json.dependencies, ...json.peerDependencies });
    const banned = deps.filter((d) =>
      /^(react|react-dom|@tauri-apps\/|@xyflow\/|zustand|@radix-ui\/)/.test(d),
    );
    assert.deepEqual(banned, [], pkg);
  }
});

test('core and parsers never touch DOM or browser globals', () => {
  const files = tracked.filter((f) => /^packages\/(core|parsers)\/src\/.*\.ts$/.test(f));
  assert.ok(files.length > 10);
  const offenders = files.filter((f) =>
    /(?<![\w./'"])(document|window|localStorage|sessionStorage|navigator|DOMParser|XMLSerializer)\s*[.(]/.test(
      read(f).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''),
    ),
  );
  assert.deepEqual(offenders, []);
});

test('only apps/desktop/src/platform imports Tauri APIs (spec section 9)', () => {
  const files = tracked.filter(
    (f) => /^apps\/desktop\/src\/.*\.tsx?$/.test(f) && !f.startsWith('apps/desktop/src/platform/'),
  );
  const offenders = files.filter((f) => /from ['"]@tauri-apps\//.test(read(f)));
  assert.deepEqual(offenders, []);
});

test('NFR-MNT-01: TypeScript strict everywhere, explicit any is an error, clippy denies warnings in CI', () => {
  const base = JSON.parse(read('tsconfig.base.json'));
  assert.equal(base.compilerOptions.strict, true);
  for (const p of ['packages/core', 'packages/parsers', 'packages/device-library', 'apps/desktop']) {
    const ts = JSON.parse(read(`${p}/tsconfig.json`));
    assert.match(ts.extends ?? '', /tsconfig\.base\.json$/, p);
    assert.notEqual(ts.compilerOptions?.strict, false, p);
  }
  assert.match(read('eslint.config.js'), /'@typescript-eslint\/no-explicit-any': 'error'/);
  assert.match(read('.github/workflows/ci.yml'), /cargo clippy --all-targets --locked -- -D warnings/);
});

test('FR-ICO-08: no vendor logos; vendor names only describe compatibility', () => {
  const VENDORS = /cisco|juniper|aruba|fortinet|palo ?alto|arista|meraki|ubiquiti|mikrotik|huawei/i;
  const icons = tracked.filter((f) => f.startsWith('packages/device-library/icons/') && f.endsWith('.svg'));
  assert.ok(icons.length >= 20, 'icon set found');
  for (const f of icons) {
    const svg = read(f);
    assert.doesNotMatch(f, VENDORS, f);
    assert.doesNotMatch(svg, VENDORS, f);
    // Drawn shapes and generic lettering (like "MPLS") only: no embedded pictures that could carry a logo.
    assert.doesNotMatch(svg, /<(image|foreignObject)\b/i, f);
  }
  const brand = tracked.filter((f) =>
    /^(packages\/brand|apps\/desktop\/(public|src-tauri\/icons))\//.test(f),
  );
  for (const f of brand) assert.doesNotMatch(f, VENDORS, f);
  const conf = JSON.parse(read('apps/desktop/src-tauri/tauri.conf.json'));
  assert.equal(conf.productName, 'LineWise');
  assert.doesNotMatch(read('README.md').split('\n')[0], VENDORS);
});
