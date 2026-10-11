// SPDX-License-Identifier: Apache-2.0
// NFR-PERF-07: the benchmark gate uses medians, the NFR targets and a 20% regression budget.
import { describe, expect, it } from 'vitest';
import { combine, gate, median, TARGETS } from '../src/gate.ts';

describe('NFR-PERF-07 benchmark gate', () => {
  it('takes the median of each metric across runs', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(combine([{ a: 10, b: 1 }, { a: 30 }, { a: 20, b: 3 }])).toEqual({ a: 20, b: 2 });
  });

  it('fails a metric that misses its NFR target, in either direction', () => {
    const g = gate([{ open500Ms: 2500, pan500Fps: 40, edit500Ms: 20 }], 'm', null);
    expect(g.failures).toHaveLength(2);
    expect(g.failures.join()).toMatch(/open500Ms.*NFR-PERF-02/);
    expect(g.failures.join()).toMatch(/pan500Fps.*NFR-PERF-03/);
    expect(g.notes[0]).toMatch(/No baseline/);
  });

  it('fails a regression over 20% against a baseline from the same kind of machine only', () => {
    const base = { machine: 'ci', results: { open500Ms: 500, pan500Fps: 60 } };
    const runs = [{ open500Ms: 650, pan500Fps: 59 }];
    expect(gate(runs, 'ci', base).failures).toEqual(['open500Ms regressed 30% (500.0 → 650.0, NFR-PERF-07)']);
    expect(gate([{ open500Ms: 590, pan500Fps: 47 }], 'ci', base).failures.join()).toMatch(
      /pan500Fps regressed 22%/,
    );
    const other = gate(runs, 'laptop', base);
    expect(other.failures).toEqual([]);
    expect(other.notes[0]).toMatch(/regression check skipped/);
  });

  it('has a target for every NFR-PERF requirement with one', () => {
    expect(new Set(Object.values(TARGETS).map((t) => t.req))).toEqual(
      new Set(['NFR-PERF-01', 'NFR-PERF-02', 'NFR-PERF-03', 'NFR-PERF-04', 'NFR-PERF-05', 'NFR-PERF-06']),
    );
  });
});
