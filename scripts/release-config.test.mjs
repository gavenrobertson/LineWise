// SPDX-License-Identifier: Apache-2.0
// REL-01/02, NFR-SEC-06: release builds sign what they can and say what they skipped.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { releaseConfig } from './release-config.mjs';

test('without secrets the build is unsigned and says so', () => {
  const { config, notes } = releaseConfig({});
  assert.equal(config.bundle.createUpdaterArtifacts, false);
  assert.equal(config.bundle.windows, undefined);
  assert.ok(notes.some((n) => n.includes('Updater artifacts: SKIPPED')));
  assert.ok(notes.some((n) => n.includes('Windows code signing: SKIPPED')));
  assert.ok(notes.some((n) => n.includes('ad-hoc')));
});

test('with every secret it signs updates, Windows and macOS', () => {
  const env = {
    TAURI_SIGNING_PRIVATE_KEY: 'k',
    TAURI_UPDATER_PUBKEY: 'pub\n',
    AZURE_CLIENT_ID: 'a',
    AZURE_CLIENT_SECRET: 'b',
    AZURE_TENANT_ID: 'c',
    TRUSTED_SIGNING_ENDPOINT: 'https://eus.codesigning.azure.net',
    TRUSTED_SIGNING_ACCOUNT: 'acct',
    TRUSTED_SIGNING_PROFILE: 'prof',
    APPLE_CERTIFICATE: 'x',
    APPLE_SIGNING_IDENTITY: 'Developer ID Application: X',
    APPLE_API_KEY: 'y',
    APPLE_API_ISSUER: 'z',
    APPLE_API_KEY_PATH: '/tmp/k.p8',
  };
  const { config, notes } = releaseConfig(env);
  assert.equal(config.bundle.createUpdaterArtifacts, true);
  assert.equal(config.plugins.updater.pubkey, 'pub');
  assert.match(
    config.bundle.windows.signCommand,
    /^trusted-signing-cli -e https:\/\/eus\.codesigning\.azure\.net -a acct -c prof -d LineWise %1$/,
  );
  assert.ok(notes.includes('macOS: signed with Developer ID and notarized.'));
});

test('blank secrets count as missing', () => {
  assert.equal(
    releaseConfig({ TAURI_SIGNING_PRIVATE_KEY: '  ' }).config.bundle.createUpdaterArtifacts,
    false,
  );
});
