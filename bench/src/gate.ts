// SPDX-License-Identifier: Apache-2.0
/**
 * Benchmark gates (NFR-PERF-01..07). Each run of the suite writes one result file; the gate takes
 * the median of every metric across runs, then checks it against its NFR target and, when a
 * baseline exists for the same kind of machine, against the baseline with a 20% budget.
 * Pure, so it is unit-tested; scripts/run.ts reads and writes the files.
 */

export interface Target {
  limit: number;
  unit: string;
  better: 'lower' | 'higher';
  req: string;
}

/** NFR targets. Frame times allow 25% over one 60 Hz frame for timer jitter. */
export const TARGETS: Record<string, Target> = {
  coldStartMs: { limit: 2000, unit: 'ms', better: 'lower', req: 'NFR-PERF-01' },
  open500Ms: { limit: 2000, unit: 'ms', better: 'lower', req: 'NFR-PERF-02' },
  open2000Ms: { limit: 5000, unit: 'ms', better: 'lower', req: 'NFR-PERF-02' },
  pan500Fps: { limit: 60 * 0.9, unit: 'fps', better: 'higher', req: 'NFR-PERF-03' },
  pan2000Fps: { limit: 30, unit: 'fps', better: 'higher', req: 'NFR-PERF-03' },
  drag500FrameP95Ms: { limit: 16.7 * 1.25, unit: 'ms', better: 'lower', req: 'NFR-PERF-04' },
  edit500Ms: { limit: 50, unit: 'ms', better: 'lower', req: 'NFR-PERF-04' },
  layout500Ms: { limit: 3000, unit: 'ms', better: 'lower', req: 'NFR-PERF-05' },
  heap500Mb: { limit: 250, unit: 'MB', better: 'lower', req: 'NFR-PERF-06' },
};

/** The regression budget against the baseline (NFR-PERF-07). */
export const BUDGET = 0.2;

export interface Baseline {
  /** Which kind of machine recorded it (BENCH_MACHINE, else "<os>-<cores>cpu"). */
  machine: string;
  results: Record<string, number>;
}

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

/** Median of each metric over the runs that recorded it. */
export function combine(runs: Record<string, number>[]): Record<string, number> {
  const keys = new Set(runs.flatMap((r) => Object.keys(r)));
  return Object.fromEntries(
    [...keys].map((k) => [k, median(runs.map((r) => r[k]).filter((v): v is number => v !== undefined))]),
  );
}

export interface GateResult {
  results: Record<string, number>;
  failures: string[];
  notes: string[];
  rows: string[];
}

export function gate(
  runs: Record<string, number>[],
  machine: string,
  baseline: Baseline | null,
  targets: Record<string, Target> = TARGETS,
): GateResult {
  const results = combine(runs);
  const failures: string[] = [];
  const notes: string[] = [];
  const rows: string[] = [];
  for (const [k, v] of Object.entries(results)) {
    const t = targets[k];
    const ok = !t || (t.better === 'lower' ? v <= t.limit : v >= t.limit);
    if (!ok && t) failures.push(`${k} = ${v.toFixed(1)} ${t.unit}, target ${t.limit} (${t.req})`);
    rows.push(
      `${ok ? 'PASS' : 'FAIL'}  ${k.padEnd(20)} ${v.toFixed(1).padStart(9)} ${t ? `${t.better === 'lower' ? '≤' : '≥'} ${+t.limit.toFixed(2)} ${t.unit} (${t.req})` : '(recorded)'}`,
    );
  }
  if (!baseline) notes.push('No baseline for the regression check; record one with --update-baseline.');
  else if (baseline.machine !== machine)
    notes.push(`The baseline is from "${baseline.machine}", not "${machine}"; regression check skipped.`);
  else
    for (const [k, b] of Object.entries(baseline.results)) {
      const v = results[k];
      if (v === undefined || !b) continue;
      const worse = targets[k]?.better === 'higher' ? (b - v) / b : (v - b) / b;
      if (worse > BUDGET)
        failures.push(
          `${k} regressed ${(worse * 100).toFixed(0)}% (${b.toFixed(1)} → ${v.toFixed(1)}, NFR-PERF-07)`,
        );
    }
  return { results, failures, notes, rows };
}
