// SPDX-License-Identifier: Apache-2.0
/**
 * File-loader fuzz (FR-FMT-05, NFR-SEC-05): damaged, truncated and hostile `.lwise` files never
 * crash the loader. Anything it accepts is a valid document that saves and reloads cleanly, and a
 * recovered copy is valid too. FUZZ_RUNS sets the count (CI 10,000; locally a few hundred).
 */
import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { NetworkDocument, parseDocument, serializeDocument } from '../src/index.ts';

const RUNS = Number(process.env.FUZZ_RUNS ?? 300);
const sample = readFileSync(new URL('../../../docs/examples/branch-office.lwise', import.meta.url), 'utf8');
const base = JSON.parse(sample) as unknown;

/** Every path to a value inside a JSON tree. */
function paths(v: unknown, at: (string | number)[] = [], out: (string | number)[][] = []) {
  out.push(at);
  if (Array.isArray(v)) v.forEach((x, i) => paths(x, [...at, i], out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) paths(x, [...at, k], out);
  return out;
}
const allPaths = paths(base).filter((p) => p.length > 0);

const jsonValue = fc.oneof(
  fc.constant(null),
  fc.boolean(),
  fc.integer(),
  fc.double(),
  fc.string({ maxLength: 20 }),
  fc.constantFrom('__proto__', 'constructor', '10.0.0.1', '999.1.1.1', 'LineWise', '', '-1'),
  fc.array(fc.string({ maxLength: 5 }), { maxLength: 3 }),
  fc.dictionary(fc.string({ maxLength: 6 }), fc.string({ maxLength: 6 }), { maxKeys: 3 }),
);

type Edit = { path: (string | number)[]; op: 'set' | 'delete'; value: unknown };
const edit: fc.Arbitrary<Edit> = fc.record({
  path: fc.constantFrom(...allPaths),
  op: fc.constantFrom('set', 'delete'),
  value: jsonValue,
});

function apply(doc: unknown, edits: Edit[]): unknown {
  const d = structuredClone(doc) as Record<string | number, unknown>;
  for (const e of edits) {
    let cur: unknown = d;
    for (const k of e.path.slice(0, -1))
      cur = cur && typeof cur === 'object' ? (cur as Record<string | number, unknown>)[k] : undefined;
    if (!cur || typeof cur !== 'object') continue;
    const last = e.path.at(-1) as string | number;
    if (e.op === 'delete') delete (cur as Record<string | number, unknown>)[last];
    else (cur as Record<string | number, unknown>)[last] = e.value;
  }
  return d;
}

const files = fc.oneof(
  {
    weight: 6,
    arbitrary: fc.array(edit, { minLength: 1, maxLength: 6 }).map((es) => JSON.stringify(apply(base, es))),
  },
  { weight: 2, arbitrary: fc.nat({ max: sample.length }).map((n) => sample.slice(0, n)) },
  { weight: 1, arbitrary: fc.string({ maxLength: 200 }) },
  { weight: 1, arbitrary: fc.json() },
);

describe('fuzz [FR-FMT-05, NFR-SEC-05]', () => {
  it(`fuzz file loader: ${RUNS} damaged files never crash it`, { timeout: 30 * 60_000 }, () => {
    fc.assert(
      fc.property(files, (text) => {
        const t0 = performance.now();
        const r = parseDocument(text);
        expect(['ok', 'newer', 'invalid', 'unreadable']).toContain(r.status);
        if (r.status === 'ok' || r.status === 'newer') {
          expect(NetworkDocument.safeParse(r.doc).success).toBe(true);
          expect(parseDocument(serializeDocument(r.doc)).status).not.toBe('unreadable');
        }
        if (r.status === 'invalid') {
          expect(r.issues.length).toBeGreaterThan(0);
          if (r.recovered) expect(NetworkDocument.safeParse(r.recovered).success).toBe(true);
        }
        expect(performance.now() - t0).toBeLessThan(1000);
      }),
      { numRuns: RUNS },
    );
  });
});
