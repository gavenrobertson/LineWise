#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * Builds the Tauri config overlay for a release build from the secrets that exist (REL-01,
 * REL-02, NFR-SEC-06). Missing secrets never fail the build: the matching step is skipped and
 * reported, so a fork or an unconfigured repo still gets clearly unsigned installers.
 *
 *   node scripts/release-config.mjs <out.json>     (reads process.env)
 *
 * Secrets and variables (see docs/dev/release.md):
 *   TAURI_SIGNING_PRIVATE_KEY (+ _PASSWORD)  updater signatures and latest.json
 *   TAURI_UPDATER_PUBKEY (repo variable)     public key baked into the app
 *   AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID,
 *   TRUSTED_SIGNING_ENDPOINT, TRUSTED_SIGNING_ACCOUNT, TRUSTED_SIGNING_PROFILE
 *                                            Windows signing via Azure Trusted Signing
 *   APPLE_CERTIFICATE, APPLE_SIGNING_IDENTITY, APPLE_API_KEY, APPLE_API_ISSUER, APPLE_API_KEY_PATH
 *                                            read by the Tauri CLI directly on macOS
 */
import { writeFileSync } from 'node:fs';

const has = (env, ...keys) => keys.every((k) => typeof env[k] === 'string' && env[k].trim() !== '');

/** Pure: env → { config, notes }. */
export function releaseConfig(env) {
  const config = { bundle: { createUpdaterArtifacts: false }, plugins: {} };
  const notes = [];

  if (has(env, 'TAURI_SIGNING_PRIVATE_KEY')) {
    config.bundle.createUpdaterArtifacts = true;
    if (has(env, 'TAURI_UPDATER_PUBKEY'))
      config.plugins.updater = { pubkey: env.TAURI_UPDATER_PUBKEY.trim() };
    else notes.push('TAURI_UPDATER_PUBKEY is not set: the app keeps the pubkey from tauri.conf.json.');
    notes.push('Updater artifacts: signed.');
  } else {
    notes.push(
      'Updater artifacts: SKIPPED (no TAURI_SIGNING_PRIVATE_KEY). Installed apps cannot auto-update to this build.',
    );
  }

  if (
    has(
      env,
      'AZURE_CLIENT_ID',
      'AZURE_CLIENT_SECRET',
      'AZURE_TENANT_ID',
      'TRUSTED_SIGNING_ENDPOINT',
      'TRUSTED_SIGNING_ACCOUNT',
      'TRUSTED_SIGNING_PROFILE',
    )
  ) {
    config.bundle.windows = {
      signCommand: `trusted-signing-cli -e ${env.TRUSTED_SIGNING_ENDPOINT} -a ${env.TRUSTED_SIGNING_ACCOUNT} -c ${env.TRUSTED_SIGNING_PROFILE} -d LineWise %1`,
    };
    notes.push('Windows code signing: Azure Trusted Signing.');
  } else {
    notes.push('Windows code signing: SKIPPED (no Trusted Signing secrets). SmartScreen will warn.');
  }

  if (has(env, 'APPLE_CERTIFICATE', 'APPLE_SIGNING_IDENTITY')) {
    notes.push(
      has(env, 'APPLE_API_KEY', 'APPLE_API_ISSUER', 'APPLE_API_KEY_PATH')
        ? 'macOS: signed with Developer ID and notarized.'
        : 'macOS: signed with Developer ID, NOT notarized (no App Store Connect API key). Gatekeeper will warn.',
    );
  } else {
    notes.push(
      'macOS: ad-hoc signed only (no Developer ID). Gatekeeper will block it until a maintainer signs it.',
    );
  }
  return { config, notes };
}

if (process.argv[1]?.endsWith('release-config.mjs')) {
  const out = process.argv[2];
  if (!out) {
    console.error('Usage: node scripts/release-config.mjs <out.json>');
    process.exit(2);
  }
  const { config, notes } = releaseConfig(process.env);
  writeFileSync(out, `${JSON.stringify(config, null, 2)}\n`);
  for (const n of notes) console.log(`::notice::${n}`);
}
