#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * Checks TRACEABILITY.md against docs/SPEC.md (DOC-06, prompt rule 6):
 *  - every requirement ID in the spec has exactly one row;
 *  - every listed module and test path exists;
 *  - a `done` row lists at least one test, and at least one listed test file mentions the ID,
 *    so "done" always points at a test that names the requirement.
 *
 *   node scripts/traceability.mjs                 check
 *   node scripts/traceability.mjs --summary       also print counts per status and priority
 *   node scripts/traceability.mjs --require-must  fail unless every MUST row is done (v1.0 gate)
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const STATUSES = new Set(['todo', 'in-progress', 'partial', 'done', 'deferred']);

export function specIds(spec) {
  const ids = new Set(spec.match(/\b(?:FR|NFR|REL|OSS|DOC|BRD|VAL)-[A-Z0-9]+(?:-[0-9]+)?\b/g) ?? []);
  return [...ids].filter((id) => /-\d+$/.test(id)).sort();
}

export function parseRows(markdown) {
  const rows = [];
  for (const line of markdown.split('\n')) {
    const m = line.match(/^\|\s*((?:FR|NFR|REL|OSS|DOC|BRD|VAL)-[A-Z0-9-]+)\s*\|(.*)\|\s*$/);
    if (!m) continue;
    const cells = m[2].split('|').map((c) => c.trim());
    const [priority = '', modules = '', tests = '', status = ''] = cells;
    const paths = (s) =>
      [...s.matchAll(/`([^`]+)`/g)].map((x) => x[1]).filter((p) => /[/.]/.test(p) && !p.includes(' '));
    rows.push({
      id: m[1],
      priority,
      modules: paths(modules),
      tests: paths(tests),
      status: status.toLowerCase(),
      line,
    });
  }
  return rows;
}

export function check({ spec, markdown, exists, read, requireMust = false }) {
  const problems = [];
  const rows = parseRows(markdown);
  const byId = new Map();
  for (const r of rows) {
    if (byId.has(r.id)) problems.push(`${r.id}: duplicate row`);
    byId.set(r.id, r);
  }
  for (const id of specIds(spec)) if (!byId.has(id)) problems.push(`${id}: missing from TRACEABILITY.md`);
  for (const r of rows) {
    if (!STATUSES.has(r.status)) problems.push(`${r.id}: unknown status "${r.status}"`);
    for (const p of [...r.modules, ...r.tests])
      if (!exists(p)) problems.push(`${r.id}: path does not exist: ${p}`);
    if (r.status === 'done') {
      if (!r.tests.length) problems.push(`${r.id}: done but lists no test`);
      else if (!r.tests.some((t) => exists(t) && read(t).includes(r.id)))
        problems.push(`${r.id}: done but none of its tests mention ${r.id}`);
    }
    if (requireMust && r.priority === 'MUST' && r.status !== 'done')
      problems.push(`${r.id}: MUST is ${r.status}`);
  }
  return { rows, problems };
}

if (process.argv[1]?.endsWith('traceability.mjs')) {
  const file = (p) => join(ROOT, p);
  const { rows, problems } = check({
    spec: readFileSync(file('docs/SPEC.md'), 'utf8'),
    markdown: readFileSync(file('TRACEABILITY.md'), 'utf8'),
    exists: (p) => existsSync(file(p)),
    read: (p) => readFileSync(file(p), 'utf8'),
    requireMust: process.argv.includes('--require-must'),
  });
  if (process.argv.includes('--summary')) {
    const counts = {};
    for (const r of rows) {
      const k = `${r.priority} ${r.status}`;
      counts[k] = (counts[k] ?? 0) + 1;
    }
    console.log(
      Object.entries(counts)
        .sort()
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n'),
    );
  }
  if (problems.length) {
    console.error(`Traceability check failed (${problems.length}):\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`Traceability OK: ${rows.length} requirements.`);
}
