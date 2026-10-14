// SPDX-License-Identifier: Apache-2.0
// OSS-05: contributor commits must be signed off (DCO), checked on every pull request.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { unsigned } from './dco.mjs';

const commit = (sha, message, email = 'ada@example.com', parents = 1) => ({
  sha,
  parents: Array.from({ length: parents }, () => ({})),
  commit: { message, author: { email } },
});

test('a commit passes only with a Signed-off-by line for its author', () => {
  const r = unsigned([
    commit('a1', 'feat: x\n\nSigned-off-by: Ada Lovelace <ada@example.com>'),
    commit('b2', 'feat: y'),
    commit('c3', 'feat: z\n\nSigned-off-by: Someone Else <else@example.com>'),
    commit('d4', 'fix: w\n\nsigned-off-by: Ada <ADA@example.com>'),
    commit('e5', "Merge branch 'main'", 'ada@example.com', 2),
  ]);
  assert.deepEqual(
    r.map((f) => f.sha),
    ['b2', 'c3'],
  );
  assert.match(r[1].reason, /does not match the author/);
});

test('the DCO workflow runs on pull requests from contributors who are not maintainers or bots', () => {
  const wf = readFileSync(join(import.meta.dirname, '../.github/workflows/dco.yml'), 'utf8');
  assert.match(wf, /pull_request/);
  assert.match(wf, /author_association/);
  assert.match(wf, /github\.event\.pull_request\.user\.type != 'Bot'/);
  assert.match(wf, /node scripts\/dco\.mjs/);
  assert.match(readFileSync(join(import.meta.dirname, '../CONTRIBUTING.md'), 'utf8'), /git commit -s|`-s`/);
});
