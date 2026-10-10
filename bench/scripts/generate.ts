// SPDX-License-Identifier: Apache-2.0
/** Writes bench/fixtures/bench-<n>.lwise for every benchmark size (NFR-PERF-07). */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { serializeDocument } from '@linewise/core';
import { generateNetwork, SIZES } from '../src/generate.ts';

const out = join(import.meta.dirname, '..', 'fixtures');
mkdirSync(out, { recursive: true });
const only = process.argv.slice(2).map(Number).filter(Boolean);
for (const n of only.length ? only : SIZES) {
  const t0 = performance.now();
  const g = generateNetwork(n);
  const text = serializeDocument(g.doc);
  writeFileSync(join(out, `bench-${n}.lwise`), text);
  console.log(
    `bench-${n}.lwise: ${g.devices} devices, ${g.links} links, ${(text.length / 1e6).toFixed(1)} MB in ${Math.round(performance.now() - t0)} ms`,
  );
}
