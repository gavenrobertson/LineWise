// SPDX-License-Identifier: Apache-2.0
// NFR-PERF-07: the benchmark fixtures are valid, deterministic files of the advertised size.
import { parseDocument, serializeDocument, validate } from '@linewise/core';
import { describe, expect, it } from 'vitest';
import { generateNetwork } from '../src/generate.ts';

describe('NFR-PERF-07 benchmark generator', () => {
  it('builds about 1.6 links per device and loads cleanly', () => {
    const g = generateNetwork(500);
    expect(g.devices).toBe(500);
    expect(g.links).toBeGreaterThanOrEqual(750);
    expect(g.links).toBeLessThanOrEqual(850);
    const text = serializeDocument(g.doc);
    const r = parseDocument(text);
    expect(r.status).toBe('ok');
    if (r.status === 'ok') expect(serializeDocument(r.doc)).toBe(text);
  });

  it('is deterministic', () => {
    expect(serializeDocument(generateNetwork(100).doc)).toBe(serializeDocument(generateNetwork(100).doc));
  });

  it('produces a network without addressing errors', () => {
    const { issues } = validate(generateNetwork(100).doc);
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  });
});
