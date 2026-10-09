// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  addDevice,
  connect,
  createDocument,
  Editor,
  migrate,
  parseDocument,
  registerMigration,
  migrations,
  serializeDocument,
  stableStringify,
  upsertVlan,
} from '../src/index.ts';
import { routerTemplate, switchTemplate, useDeterminism } from './helpers.ts';

useDeterminism();

function sampleDoc() {
  const ed = new Editor(createDocument('Campus'));
  const pageId = ed.doc.pages[0]?.id as string;
  const r = addDevice({ role: 'router', pageId, position: { x: 0, y: 0 }, template: routerTemplate });
  const s = addDevice({ role: 'l2-switch', pageId, position: { x: 0, y: 120 }, template: switchTemplate });
  ed.execute(r);
  ed.execute(s);
  ed.execute(connect({ deviceId: r.deviceId }, { deviceId: s.deviceId }));
  ed.execute(upsertVlan({ number: 10, name: 'Users' }));
  return ed.doc;
}

describe('stable JSON [FR-FMT-01]', () => {
  it('sorts keys recursively and indents with 2 spaces', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: [3] } })).toBe(
      '{\n  "a": {\n    "c": [\n      3\n    ],\n    "d": 2\n  },\n  "b": 1\n}\n',
    );
  });

  it('sorts entity arrays by id regardless of insertion order', () => {
    const doc = sampleDoc();
    const reversed = { ...doc, devices: [...doc.devices].reverse() };
    expect(serializeDocument(reversed)).toBe(serializeDocument(doc));
  });

  it('includes the format header and schema reference [FR-FMT-02]', () => {
    const json = JSON.parse(serializeDocument(sampleDoc()));
    expect(json.format).toBe('LineWise');
    expect(json.schemaVersion).toBe(1);
    expect(json.$schema).toMatch(/schema\/v1\.json$/);
  });
});

describe('load [FR-FMT-03, FR-FMT-05]', () => {
  it('round-trips byte-identically', () => {
    const text = serializeDocument(sampleDoc());
    const r = parseDocument(text);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(serializeDocument(r.doc)).toBe(text);
  });

  it('rejects non-JSON and foreign JSON', () => {
    expect(parseDocument('{nope').status).toBe('unreadable');
    expect(parseDocument('{"hello":1}')).toMatchObject({
      status: 'unreadable',
      message: 'This is not a LineWise diagram.',
    });
  });

  it('opens newer files read-only', () => {
    const json = JSON.parse(serializeDocument(sampleDoc()));
    json.schemaVersion = 99;
    const r = parseDocument(JSON.stringify(json));
    expect(r.status).toBe('newer');
    if (r.status === 'newer') {
      expect(r.readOnly).toBe(true);
      expect(r.warnings[0]).toMatch(/newer version/);
    }
  });

  it('recovers valid parts of an invalid file', () => {
    const json = JSON.parse(serializeDocument(sampleDoc()));
    json.devices[0].role = 'toaster';
    const r = parseDocument(JSON.stringify(json));
    expect(r.status).toBe('invalid');
    if (r.status !== 'invalid') return;
    expect(r.issues[0]?.path).toMatch(/^devices\.0\.role/);
    expect(r.recovered?.devices).toHaveLength(1);
    expect(r.recovered?.links).toHaveLength(0);
  });

  it('runs ordered migrations without touching the input', () => {
    const before = { ...migrations };
    try {
      registerMigration(0, (raw) => ({ ...raw, name: `${String(raw.name)} (migrated)` }));
      const raw = { schemaVersion: 0, name: 'Old' };
      const m = migrate(raw);
      expect(m.applied).toEqual([0]);
      expect(m.raw).toMatchObject({ schemaVersion: 1, name: 'Old (migrated)' });
      expect(raw.name).toBe('Old');
      const json = JSON.parse(serializeDocument(sampleDoc()));
      json.schemaVersion = 0;
      const r = parseDocument(JSON.stringify(json));
      expect(r).toMatchObject({ status: 'ok', migratedFrom: 0 });
      expect(() => migrate({ schemaVersion: -5 })).toThrow(/No migration/);
    } finally {
      for (const k of Object.keys(migrations)) delete migrations[Number(k)];
      Object.assign(migrations, before);
    }
  });
});
