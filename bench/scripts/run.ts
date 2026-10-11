// SPDX-License-Identifier: Apache-2.0
/**
 * Run the benchmark suite BENCH_RUNS times (default 3) and gate the medians (NFR-PERF-01..07).
 *
 *   pnpm bench                      measure and gate
 *   pnpm bench -- --update-baseline also write bench/baseline.json from these medians
 *
 * BENCH_MACHINE names the kind of machine (CI sets it for its runner); the regression check only
 * compares against a baseline from the same kind. Writes bench/results/summary.json.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, platform } from 'node:os';
import { join } from 'node:path';
import { gate, type Baseline } from '../src/gate.ts';

const ROOT = join(import.meta.dirname, '..');
const RESULTS = join(ROOT, 'results');
const BASELINE = join(ROOT, 'baseline.json');
const runs = Math.max(1, Number(process.env.BENCH_RUNS ?? 3));
const machine = process.env.BENCH_MACHINE || `${platform()}-${cpus().length}cpu`;

rmSync(RESULTS, { recursive: true, force: true });
mkdirSync(RESULTS, { recursive: true });
let crashed = false;
for (let i = 1; i <= runs; i++) {
  console.log(`\n=== Benchmark run ${i} of ${runs} on ${machine} ===`);
  const r = spawnSync('pnpm', ['exec', 'playwright', 'test', '-c', 'playwright.config.ts'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, BENCH_RUN: String(i), ...(i > 1 ? { BENCH_BUILT: '1' } : {}) },
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) crashed = true;
}

const measured = Array.from({ length: runs }, (_, i) => join(RESULTS, `run-${i + 1}.json`))
  .filter((f) => existsSync(f))
  .map((f) => (JSON.parse(readFileSync(f, 'utf8')) as { results: Record<string, number> }).results);
const baseline = existsSync(BASELINE) ? (JSON.parse(readFileSync(BASELINE, 'utf8')) as Baseline) : null;
const g = gate(measured, machine, baseline);
console.log(`\nMedians of ${measured.length} run(s) on ${machine}\n${g.rows.join('\n')}`);
for (const n of g.notes) console.log(n);
writeFileSync(
  join(RESULTS, 'summary.json'),
  `${JSON.stringify({ date: new Date().toISOString(), machine, runs: measured.length, ...g }, null, 2)}\n`,
);
if (process.argv.includes('--update-baseline')) {
  writeFileSync(BASELINE, `${JSON.stringify({ machine, results: g.results }, null, 2)}\n`);
  console.log(`Wrote ${BASELINE}.`);
}
if (crashed) console.error('A benchmark run failed; see its output above.');
if (g.failures.length) console.error(`\nFailed:\n  ${g.failures.join('\n  ')}`);
process.exit(crashed || g.failures.length || measured.length === 0 ? 1 : 0);
