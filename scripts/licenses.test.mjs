// SPDX-License-Identifier: Apache-2.0
// Run with `node --test scripts/` (OSS-02).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALLOWED, satisfies } from './licenses.mjs';

const ok = (id) => ALLOWED.has(id);

test('simple identifiers', () => {
  assert.equal(satisfies('MIT', ok), true);
  assert.equal(satisfies('GPL-3.0', ok), false);
  assert.equal(satisfies('', ok), false);
  assert.equal(satisfies(undefined, ok), false);
});

test('OR needs one allowed side, AND needs both', () => {
  assert.equal(satisfies('EPL-2.0 OR GPL-3.0-or-later', ok), true);
  assert.equal(satisfies('MIT AND GPL-2.0', ok), false);
  assert.equal(satisfies('(MIT OR Apache-2.0) AND Unicode-3.0', ok), true);
  assert.equal(satisfies('(MIT AND Zlib)', ok), true);
});

test('legacy slash syntax and WITH exceptions', () => {
  assert.equal(satisfies('MIT/Apache-2.0', ok), true);
  assert.equal(satisfies('Apache-2.0 / MIT', ok), true);
  assert.equal(satisfies('Apache-2.0 WITH LLVM-exception', ok), true);
  assert.equal(satisfies('GPL-2.0 WITH Classpath-exception-2.0', ok), false);
});
