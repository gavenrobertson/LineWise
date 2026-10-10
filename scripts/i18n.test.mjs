// SPDX-License-Identifier: Apache-2.0
// NFR-I18N-01: every UI string is in the English resource file, and en.json is up to date.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { test } from 'node:test';

test('NFR-I18N-01: en.json is generated from the code and no UI text bypasses i18next', () => {
  const r = spawnSync(
    process.execPath,
    ['--experimental-transform-types', '--no-warnings', 'scripts/i18n.ts', '--check'],
    {
      cwd: join(import.meta.dirname, '..'),
      encoding: 'utf8',
    },
  );
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /up to date \(\d{3,} strings\)/);
});
