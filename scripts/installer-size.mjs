#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * Installers must stay under 25 MB (NFR-PERF-06). release.yml runs this on the draft's assets.
 *
 *   node scripts/installer-size.mjs <dir>
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const LIMIT = 25 * 1024 * 1024;
const INSTALLER = /\.(exe|msi|dmg)$/i;

/** Pure: [name, bytes] pairs → report rows and the installers over the limit. */
export function checkSizes(files) {
  const installers = files.filter(([name]) => INSTALLER.test(name));
  const rows = installers.map(
    ([name, bytes]) => `${(bytes / 1024 / 1024).toFixed(1).padStart(6)} MB  ${name}`,
  );
  const over = installers.filter(([, bytes]) => bytes >= LIMIT).map(([name]) => name);
  return { rows, over, count: installers.length };
}

if (process.argv[1]?.endsWith('installer-size.mjs')) {
  const dir = process.argv[2] ?? '.';
  const files = readdirSync(dir).map((f) => [f, statSync(join(dir, f)).size]);
  const { rows, over, count } = checkSizes(files);
  console.log(rows.join('\n'));
  if (count === 0) {
    console.error(`No installers in ${dir}.`);
    process.exit(1);
  }
  if (over.length) {
    console.error(`Over the 25 MB limit (NFR-PERF-06): ${over.join(', ')}`);
    process.exit(1);
  }
}
