// SPDX-License-Identifier: Apache-2.0
// DOC-06: the traceability checker itself.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { check, parseRows, specIds } from './traceability.mjs';

const spec = '- **FR-A-01 (MUST)** one\n- **FR-A-02 (SHOULD)** two\nsee FR-A-01..02 and section FR-A';
const files = { 'src/a.ts': 'code', 'test/a.test.ts': "it('FR-A-01 works')", 'test/b.test.ts': 'nothing' };
const io = { exists: (p) => p in files, read: (p) => files[p] };
const table = (rows) =>
  `| Requirement | Priority | Module(s) | Test(s) | Status |\n| --- | --- | --- | --- | --- |\n${rows.join('\n')}`;

test('collects numbered requirement ids only', () => {
  assert.deepEqual(specIds(spec), ['FR-A-01', 'FR-A-02']);
});

test('parses backticked paths from module and test cells', () => {
  const [r] = parseRows(table(['| FR-A-01 | MUST | `src/a.ts` (canvas) | `test/a.test.ts` | done |']));
  assert.deepEqual(r.modules, ['src/a.ts']);
  assert.deepEqual(r.tests, ['test/a.test.ts']);
  assert.equal(r.status, 'done');
});

test('a done row must point at a test that names the requirement', () => {
  const ok = check({
    spec,
    markdown: table([
      '| FR-A-01 | MUST | `src/a.ts` | `test/a.test.ts` | done |',
      '| FR-A-02 | SHOULD | | | todo |',
    ]),
    ...io,
  });
  assert.deepEqual(ok.problems, []);
  const bad = check({
    spec,
    markdown: table([
      '| FR-A-01 | MUST | `src/a.ts` | `test/b.test.ts` | done |',
      '| FR-A-02 | SHOULD | | | done |',
    ]),
    ...io,
  });
  assert.ok(bad.problems.some((p) => p.startsWith('FR-A-01: done but none of its tests mention')));
  assert.ok(bad.problems.includes('FR-A-02: done but lists no test'));
});

test('missing rows, missing paths and the MUST gate are reported', () => {
  const r = check({
    spec,
    markdown: table(['| FR-A-01 | MUST | `src/nope.ts` | | partial |']),
    ...io,
    requireMust: true,
  });
  assert.ok(r.problems.includes('FR-A-02: missing from TRACEABILITY.md'));
  assert.ok(r.problems.includes('FR-A-01: path does not exist: src/nope.ts'));
  assert.ok(r.problems.includes('FR-A-01: MUST is partial'));
});
