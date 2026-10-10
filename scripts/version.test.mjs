// SPDX-License-Identifier: Apache-2.0
// REL-03: version single source of truth.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cargoTomlVersion, setCargoLockVersion, setCargoTomlVersion } from './version.mjs';

const toml = `[package]\nname = "linewise"\nversion = "0.0.1"\nedition = "2021"\n\n[dependencies]\nserde = { version = "1" }\n`;

test('reads and writes only the [package] version in Cargo.toml', () => {
  assert.equal(cargoTomlVersion(toml), '0.0.1');
  const next = setCargoTomlVersion(toml, '1.2.3-beta.1');
  assert.equal(cargoTomlVersion(next), '1.2.3-beta.1');
  assert.match(next, /serde = \{ version = "1" \}/);
});

test('updates the app entry in Cargo.lock without touching other crates', () => {
  const lock = `[[package]]\nname = "libc"\nversion = "0.2.1"\n\n[[package]]\nname = "linewise"\nversion = "0.0.1"\n`;
  const next = setCargoLockVersion(lock, 'linewise', '0.1.0');
  assert.match(next, /name = "linewise"\nversion = "0.1.0"/);
  assert.match(next, /name = "libc"\nversion = "0.2.1"/);
});
