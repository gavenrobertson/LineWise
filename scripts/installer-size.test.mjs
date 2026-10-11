// SPDX-License-Identifier: Apache-2.0
// NFR-PERF-06: release installers stay under 25 MB, and release.yml checks every one.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkSizes, LIMIT } from './installer-size.mjs';

test('installers at or over 25 MB fail; other release assets are ignored', () => {
  const r = checkSizes([
    ['LineWise_1.0.0_x64-setup.exe', 9_000_000],
    ['LineWise_1.0.0_x64_en-US.msi', LIMIT],
    ['LineWise_1.0.0_universal.dmg', LIMIT - 1],
    ['LineWise_universal.app.tar.gz', 90_000_000],
    ['linewise-v1.0.0-sbom.cdx.json', 1_000],
  ]);
  assert.equal(r.count, 3);
  assert.deepEqual(r.over, ['LineWise_1.0.0_x64_en-US.msi']);
  assert.match(r.rows[0], /^ {3}8\.6 MB {2}LineWise_1\.0\.0_x64-setup\.exe$/);
});

test('the release workflow checks the size of the installers it uploads', () => {
  const wf = readFileSync(join(import.meta.dirname, '../.github/workflows/release.yml'), 'utf8');
  assert.match(wf, /WORKFLOW_SHA: \$\{\{ github\.sha \}\}/);
  assert.match(wf, /git show "\$WORKFLOW_SHA:scripts\/installer-size\.mjs"/);
  assert.match(wf, /node "\$RUNNER_TEMP\/installer-size\.mjs" dist-release/);
});
