#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * Single source of truth for the app version (REL-03): apps/desktop/package.json.
 * tauri.conf.json reads it directly ("version": "../package.json"); this script keeps
 * Cargo.toml, Cargo.lock and the workspace packages in step, and the MSI installer version in
 * tauri.conf.json: MSI versions are numbers only (major.minor.patch), so a pre-release such as
 * 0.9.0-beta is installed as 0.9.0.
 *
 *   node scripts/version.mjs check [--tag v1.2.3]   fail if anything disagrees (or the tag does)
 *   node scripts/version.mjs set 1.2.3              write the version everywhere
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DESKTOP_PKG = join(ROOT, 'apps/desktop/package.json');
const CARGO_TOML = join(ROOT, 'apps/desktop/src-tauri/Cargo.toml');
const CARGO_LOCK = join(ROOT, 'apps/desktop/src-tauri/Cargo.lock');
const TAURI_CONF = join(ROOT, 'apps/desktop/src-tauri/tauri.conf.json');
const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

export function cargoTomlVersion(text) {
  const pkg = text.split(/^\[/m).find((s) => s.startsWith('package]'));
  return pkg?.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
}

export function setCargoTomlVersion(text, version) {
  return text.replace(/(\[package\][^[]*?^version\s*=\s*")[^"]+(")/ms, `$1${version}$2`);
}

export function setCargoLockVersion(text, name, version) {
  return text.replace(
    new RegExp(`(\\[\\[package\\]\\]\\nname = "${name}"\\nversion = ")[^"]+(")`),
    `$1${version}$2`,
  );
}

/** The MSI ProductVersion for an app version: the numeric core, without pre-release or build. */
export function msiVersion(version) {
  return version.split(/[-+]/)[0];
}

export function wixVersion(text) {
  return /"wix":\s*\{[^}]*"version":\s*"([^"]+)"/.exec(text)?.[1];
}

/** Set bundle.windows.wix.version in tauri.conf.json, keeping the file's formatting. */
export function setWixVersion(text, version) {
  const v = msiVersion(version);
  if (wixVersion(text) !== undefined)
    return text.replace(/("wix":\s*\{[^}]*"version":\s*")[^"]+(")/, `$1${v}$2`);
  return text.replace(/("wix":\s*\{[^}]*?)(\s*\})/, `$1, "version": "${v}"$2`);
}

function packageFiles() {
  const out = [DESKTOP_PKG];
  for (const dir of readdirSync(join(ROOT, 'packages')))
    out.push(join(ROOT, 'packages', dir, 'package.json'));
  return out;
}

function main() {
  const [cmd, arg, value] = process.argv.slice(2);
  const desktop = JSON.parse(readFileSync(DESKTOP_PKG, 'utf8')).version;
  if (cmd === 'set') {
    if (!SEMVER.test(arg ?? '')) throw new Error(`Not a semantic version: ${arg}`);
    for (const f of packageFiles()) {
      const json = JSON.parse(readFileSync(f, 'utf8'));
      json.version = arg;
      writeFileSync(f, `${JSON.stringify(json, null, 2)}\n`);
    }
    writeFileSync(CARGO_TOML, setCargoTomlVersion(readFileSync(CARGO_TOML, 'utf8'), arg));
    writeFileSync(CARGO_LOCK, setCargoLockVersion(readFileSync(CARGO_LOCK, 'utf8'), 'linewise', arg));
    writeFileSync(TAURI_CONF, setWixVersion(readFileSync(TAURI_CONF, 'utf8'), arg));
    console.log(`Version set to ${arg}.`);
    return;
  }
  if (cmd === 'check') {
    const problems = [];
    if (!SEMVER.test(desktop)) problems.push(`apps/desktop/package.json version "${desktop}" is not semver`);
    for (const f of packageFiles()) {
      const v = JSON.parse(readFileSync(f, 'utf8')).version;
      if (v !== desktop) problems.push(`${f.slice(ROOT.length + 1)} is ${v}, expected ${desktop}`);
    }
    const cargo = cargoTomlVersion(readFileSync(CARGO_TOML, 'utf8'));
    if (cargo !== desktop) problems.push(`Cargo.toml is ${cargo}, expected ${desktop}`);
    if (!readFileSync(CARGO_LOCK, 'utf8').includes(`name = "linewise"\nversion = "${desktop}"`))
      problems.push(`Cargo.lock does not record linewise ${desktop}`);
    const wix = wixVersion(readFileSync(TAURI_CONF, 'utf8'));
    if (wix !== msiVersion(desktop))
      problems.push(`tauri.conf.json bundle.windows.wix.version is ${wix}, expected ${msiVersion(desktop)}`);
    if (arg === '--tag' && value !== `v${desktop}`)
      problems.push(`tag ${value} does not match version v${desktop}`);
    if (problems.length) {
      console.error(
        `Version check failed:\n  ${problems.join('\n  ')}\nRun: node scripts/version.mjs set <version>`,
      );
      process.exit(1);
    }
    console.log(`Version ${desktop} is consistent.`);
    return;
  }
  console.error('Usage: node scripts/version.mjs check [--tag vX.Y.Z] | set X.Y.Z');
  process.exit(2);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('version.mjs')) main();
