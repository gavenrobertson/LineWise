// SPDX-License-Identifier: Apache-2.0
/** JSON Schema for the file format, generated from the Zod schemas (FR-FMT-02). */
import { z } from 'zod';
import { NetworkDocument, SCHEMA_VERSION } from './schema.ts';
import { SCHEMA_URL } from './serialize.ts';

export function documentJsonSchema(): Record<string, unknown> {
  // "input" so fields with defaults are optional, matching what files may omit.
  const schema = z.toJSONSchema(NetworkDocument, { io: 'input', unrepresentable: 'any' }) as Record<
    string,
    unknown
  >;
  return {
    ...schema,
    $id: SCHEMA_URL,
    title: `LineWise diagram (schema version ${SCHEMA_VERSION})`,
    description: 'A LineWise network diagram (.lwise). See docs/file-format.md.',
  };
}
