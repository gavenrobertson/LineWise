// SPDX-License-Identifier: Apache-2.0
// Run with `node --test scripts/` (OSS-02).
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { ALLOWED, LICENSE_CORRECTIONS, licenseText, ROOT, satisfies } from './licenses.mjs';

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

test('OSS-02: each license correction matches the license file the package ships', () => {
  const texts = {
    MIT: /The MIT License|Permission is hereby granted/,
    'BSD-3-Clause': /BSD 3-Clause|Neither the name/,
  };
  for (const [id, license] of Object.entries(LICENSE_CORRECTIONS)) {
    const at = id.lastIndexOf('@');
    const dir = join(ROOT, 'node_modules/.pnpm', id.replace('/', '+'), 'node_modules', id.slice(0, at));
    assert.ok(texts[license], `${id}: no check for ${license}`);
    assert.match(licenseText(dir), texts[license], id);
  }
});
