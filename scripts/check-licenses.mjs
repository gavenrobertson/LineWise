#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * Dependency license gate (OSS-02). Fails when a shipped npm package or Rust crate uses a
 * license outside the allowlist, or when any package (including dev tooling) is GPL/AGPL/SSPL
 * or has no license. Pass --no-cargo to skip Rust (e.g. when cargo is not installed).
 */
import { ALLOWED, BLOCKED, DEV_ONLY_EXTRA, cargoPackages, npmPackages, satisfies } from './licenses.mjs';

const skipCargo = process.argv.includes('--no-cargo');
const problems = [];

const prod = npmPackages({ prod: true });
const prodKeys = new Set(prod.map((p) => `${p.name}@${p.version}`));
for (const p of prod) {
  if (!satisfies(p.license, (id) => ALLOWED.has(id)))
    problems.push(`${p.name}@${p.version} (npm, shipped): ${p.license}`);
}

for (const p of npmPackages({ prod: false })) {
  if (prodKeys.has(`${p.name}@${p.version}`)) continue;
  const ok = satisfies(p.license, (id) => (ALLOWED.has(id) || DEV_ONLY_EXTRA.has(id)) && !BLOCKED.test(id));
  if (!ok) problems.push(`${p.name}@${p.version} (npm, dev only): ${p.license || 'UNKNOWN'}`);
}

let crates = 0;
if (!skipCargo) {
  const list = cargoPackages();
  crates = list.length;
  for (const p of list) {
    if (!satisfies(p.license, (id) => ALLOWED.has(id)))
      problems.push(`${p.name}@${p.version} (cargo): ${p.license || 'UNKNOWN'}`);
  }
}

if (problems.length) {
  console.error(`License check failed for ${problems.length} package(s):\n  ${problems.join('\n  ')}`);
  console.error('\nSee OSS-02 in docs/SPEC.md. Add an exception only with a decisions-log entry.');
  process.exit(1);
}
console.log(
  `License check passed: ${prod.length} shipped npm packages${skipCargo ? '' : `, ${crates} Rust crates`}.`,
);
