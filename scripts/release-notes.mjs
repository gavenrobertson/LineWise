#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * Prints the CHANGELOG.md section for a version (REL-20), followed by the install and
 * verification notes every release carries. Usage: node scripts/release-notes.mjs 1.2.3
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export function sectionFor(changelog, version) {
  const lines = changelog.split('\n');
  const start = lines.findIndex((l) =>
    new RegExp(`^## \\[?v?${version.replace(/\./g, '\\.')}(\\]|\\s|$)`).test(l),
  );
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  return lines
    .slice(start + 1, end < 0 ? undefined : end)
    .join('\n')
    .trim();
}

if (process.argv[1]?.endsWith('release-notes.mjs')) {
  const version = process.argv[2];
  const changelog = readFileSync(join(resolve(import.meta.dirname, '..'), 'CHANGELOG.md'), 'utf8');
  const body = sectionFor(changelog, version) ?? `No changelog entry was found for ${version}.`;
  console.log(`${body}

---

**Downloads.** Windows x64: \`.exe\` (per-user, no admin) or \`.msi\` (per-machine, for IT; silent: \`msiexec /i LineWise_${version}_x64_en-US.msi /qn\`). Windows ARM64: \`.exe\` (silent: \`/S\`). macOS 12+ (Apple Silicon and Intel): universal \`.dmg\`.

**Verify.** Compare the file's SHA-256 with \`SHA256SUMS.txt\`. The CycloneDX SBOM and third-party notices are attached. Signing status for this build is shown in the release workflow summary; see docs/dev/release.md.`);
}
