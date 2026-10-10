// SPDX-License-Identifier: Apache-2.0
import { NetworkDocument, parseDocument, serializeDocument, validate } from '@linewise/core';
import { describe, expect, it } from 'vitest';
import { STARTERS } from '../src/index.ts';

describe('starter templates [FR-APP-06]', () => {
  it('provides the seven starters from the spec', () => {
    expect(STARTERS.map((s) => s.id)).toEqual([
      'small-office',
      'three-tier-campus',
      'collapsed-core',
      'spine-leaf',
      'hub-and-spoke',
      'dmvpn',
      'ccna-lab',
    ]);
  });

  for (const s of STARTERS) {
    it(`${s.name} builds a valid, error-free document`, () => {
      const doc = s.build();
      expect(() => NetworkDocument.parse(doc)).not.toThrow();
      expect(doc.devices.length).toBeGreaterThan(3);
      expect(doc.links.length).toBeGreaterThan(2);
      const errors = validate(doc).issues.filter((i) => i.severity !== 'info');
      expect(errors.map((e) => `${e.ruleId} ${e.message}`)).toEqual([]);
      const r = parseDocument(serializeDocument(doc));
      expect(r.status).toBe('ok');
      for (const d of doc.devices) expect(doc.pages[0]?.nodePositions[d.id], d.hostname).toBeTruthy();
    });
  }
});
