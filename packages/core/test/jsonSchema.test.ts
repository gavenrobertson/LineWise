// SPDX-License-Identifier: Apache-2.0
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { documentJsonSchema, SCHEMA_VERSION, stableStringify } from '../src/index.ts';

const file = resolve(dirname(fileURLToPath(import.meta.url)), `../../../schema/v${SCHEMA_VERSION}.json`);

describe('published JSON Schema', () => {
  it('matches the Zod schemas (run `pnpm schema` to regenerate)', () => {
    const generated = stableStringify(documentJsonSchema());
    if (process.env.UPDATE_SCHEMA || !existsSync(file)) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, generated);
    }
    expect(readFileSync(file, 'utf8')).toBe(generated);
  });

  it('describes the required top-level fields', () => {
    const s = documentJsonSchema() as { required: string[]; properties: Record<string, unknown> };
    expect(s.required).toEqual(expect.arrayContaining(['format', 'schemaVersion', 'id', 'pages']));
    expect(Object.keys(s.properties)).toEqual(
      expect.arrayContaining(['devices', 'links', 'vlans', 'subnets', 'settings']),
    );
  });

  it('has no place to store a credential [NFR-SEC-07]', () => {
    const keys: string[] = [];
    const walk = (v: unknown) => {
      if (!v || typeof v !== 'object') return;
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        if (k === 'properties' && x && typeof x === 'object') keys.push(...Object.keys(x));
        walk(x);
      }
    };
    walk(documentJsonSchema());
    expect(keys.length).toBeGreaterThan(50);
    expect(
      keys.filter((k) => /pass(word)?|secret|community|credential|token|private.?key|snmp|ssh/i.test(k)),
    ).toEqual([]);
  });
});
