// SPDX-License-Identifier: Apache-2.0
/**
 * Fuzz tests (NFR-SEC-05, M4 acceptance): every parser gets FUZZ_RUNS inputs of its own (CI runs
 * a few hundred, the nightly job 10,000). Inputs are built from that parser's fixtures — real
 * lines, mutated lines and random text — so they reach deep into the parser instead of being
 * rejected on the first line.
 *
 * Each parser is called directly (parseText would hide a throw behind a warning). Text parsers
 * must never throw; structured formats (XML, JSON, YAML) may refuse a malformed document with an
 * ordinary Error, but never with a TypeError or RangeError, which would mean a bug. Every call
 * must finish within a second and return a well-formed ParseResult.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  detectKind,
  parseCdp,
  parseContainerlab,
  parseCsv,
  parseDrawio,
  parseEtherchannelSummary,
  parseGns3,
  parseInterfacesStatus,
  parseIpInterfaceBrief,
  parseLldp,
  parseNmapXml,
  parseRunningConfig,
  parseText,
  parseVlanBrief,
  type ParseResult,
  type SourceKind,
} from '../src/index.ts';

const RUNS = Number(process.env.FUZZ_RUNS ?? 300);
const FIX = join(import.meta.dirname, '..', 'fixtures');

const PARSERS: Record<SourceKind, { parse: (text: string) => ParseResult; structured: boolean }> = {
  cdp: { parse: (t) => parseCdp(t), structured: false },
  lldp: { parse: (t) => parseLldp(t), structured: false },
  'running-config': { parse: (t) => parseRunningConfig(t), structured: false },
  'ip-interface-brief': { parse: (t) => parseIpInterfaceBrief(t), structured: false },
  'interfaces-status': { parse: (t) => parseInterfacesStatus(t), structured: false },
  'vlan-brief': { parse: (t) => parseVlanBrief(t), structured: false },
  'etherchannel-summary': { parse: (t) => parseEtherchannelSummary(t), structured: false },
  csv: { parse: (t) => parseCsv(t), structured: false },
  drawio: { parse: (t) => parseDrawio(t), structured: true },
  gns3: { parse: (t) => parseGns3(t), structured: true },
  containerlab: { parse: (t) => parseContainerlab(t), structured: true },
  nmap: { parse: (t) => parseNmapXml(t), structured: true },
};

function fixturesOf(kind: SourceKind): string[] {
  const dir = join(FIX, kind);
  return readdirSync(dir).map((f) => readFileSync(join(dir, f), 'utf8'));
}

/** Text built from a parser's fixtures: whole files, real lines, mutated lines and noise. */
function inputs(kind: SourceKind): fc.Arbitrary<string> {
  const files = fixturesOf(kind);
  const lines = [...new Set(files.flatMap((f) => f.split(/\r?\n/)))].filter(Boolean);
  const line = fc.constantFrom(...lines);
  const mutated = fc.tuple(line, fc.nat(), fc.nat(), fc.string({ maxLength: 12 })).map(([l, i, n, ins]) => {
    const at = i % (l.length + 1);
    return l.slice(0, at) + ins + l.slice(Math.min(l.length, at + (n % 8)));
  });
  const noise = fc.oneof(
    fc.string({ maxLength: 80 }),
    fc.constantFrom(
      '',
      ' ',
      '\t',
      '!',
      '#',
      '{',
      '}',
      '[',
      ']',
      '<',
      '>',
      '"',
      ',',
      ':',
      '---',
      '\u0000',
      '�',
    ),
  );
  const builtLines = fc
    .array(
      fc.oneof(
        { weight: 4, arbitrary: line },
        { weight: 3, arbitrary: mutated },
        { weight: 1, arbitrary: noise },
      ),
      {
        maxLength: 80,
      },
    )
    .chain((ls) => fc.constantFrom('\n', '\r\n').map((nl) => ls.join(nl)));
  // A whole fixture, cut short or with a slice duplicated or dropped.
  const editedFile = fc
    .tuple(fc.constantFrom(...files), fc.nat(), fc.nat(), fc.constantFrom('cut', 'dup', 'drop'))
    .map(([f, a, b, op]) => {
      const i = a % (f.length + 1);
      const j = Math.min(f.length, i + (b % 400));
      if (op === 'cut') return f.slice(0, i);
      if (op === 'dup') return f.slice(0, j) + f.slice(i, j) + f.slice(j);
      return f.slice(0, i) + f.slice(j);
    });
  return fc.oneof(builtLines, editedFile);
}

function wellFormed(r: ParseResult, kind: SourceKind): void {
  expect(r.kind).toBe(kind);
  for (const key of ['devices', 'links', 'vlans', 'vrfs', 'warnings', 'unparsedLines'] as const)
    expect(Array.isArray((r as unknown as Record<string, unknown>)[key]), key).toBe(true);
  for (const d of r.devices) {
    expect(typeof d.hostname).toBe('string');
    expect(Array.isArray(d.interfaces)).toBe(true);
  }
  for (const l of r.links) {
    expect(typeof l.a.hostname).toBe('string');
    expect(typeof l.b.hostname).toBe('string');
  }
  for (const v of r.vlans) expect(Number.isInteger(v.number)).toBe(true);
}

describe('fuzz [NFR-SEC-05, FR-IMP-22]', () => {
  for (const kind of Object.keys(PARSERS) as SourceKind[]) {
    it(`fuzz ${kind}: ${RUNS} inputs never crash or hang`, { timeout: 30 * 60_000 }, () => {
      const { parse, structured } = PARSERS[kind];
      fc.assert(
        fc.property(inputs(kind), (text) => {
          const t0 = performance.now();
          try {
            wellFormed(parse(text), kind);
          } catch (e) {
            // Assertion failures and bugs both fail the property; structured formats may refuse.
            if (
              !structured ||
              e instanceof TypeError ||
              e instanceof RangeError ||
              (e as Error).name === 'AssertionError'
            )
              throw e;
          }
          expect(performance.now() - t0).toBeLessThan(1000);
        }),
        { numRuns: RUNS },
      );
    });
  }

  it(`fuzz auto-detect: ${RUNS} mixed inputs always produce a result`, { timeout: 30 * 60_000 }, () => {
    const kinds = Object.keys(PARSERS) as SourceKind[];
    const any = fc.constantFrom(...kinds).chain((k) => inputs(k));
    fc.assert(
      fc.property(any, (text) => {
        const kind = detectKind(text);
        const r = parseText(text);
        expect(r).toBeTruthy();
        if (kind) expect(r.kind).toBe(kind);
        expect(Array.isArray(r.warnings)).toBe(true);
      }),
      { numRuns: RUNS },
    );
  });
});
