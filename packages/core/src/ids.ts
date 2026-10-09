// SPDX-License-Identifier: Apache-2.0
/**
 * UUID v7 generation (time-ordered), with an injectable source so tests and
 * golden files can be deterministic.
 */

export type IdSource = () => string;

function randomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

/** RFC 9562 UUID version 7. */
export function uuidv7(now: number = Date.now()): string {
  const bytes = randomBytes(16);
  const ts = BigInt(now);
  for (let i = 0; i < 6; i++) {
    bytes[i] = Number((ts >> BigInt(8 * (5 - i))) & 0xffn);
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70; // version 7
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // variant 10
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

let source: IdSource = () => uuidv7();

export function newId(): string {
  return source();
}

/** Replace the ID source (tests). Returns a function that restores the previous source. */
export function setIdSource(next: IdSource): () => void {
  const prev = source;
  source = next;
  return () => {
    source = prev;
  };
}

/** Deterministic sequential IDs for tests: `prefix-0001`, `prefix-0002`, … */
export function sequentialIds(prefix = 'id'): IdSource {
  let n = 0;
  return () => `${prefix}-${String(++n).padStart(4, '0')}`;
}

let clock: () => string = () => new Date().toISOString();

export function nowIso(): string {
  return clock();
}

export function setClock(next: () => string): () => void {
  const prev = clock;
  clock = next;
  return () => {
    clock = prev;
  };
}
