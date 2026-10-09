// SPDX-License-Identifier: Apache-2.0
import { afterEach, beforeEach } from 'vitest';
import {
  createDocument,
  Editor,
  sequentialIds,
  setClock,
  setIdSource,
  validateTemplate,
  type DeviceTemplate,
} from '../src/index.ts';

/** Deterministic IDs and clock for every test in the file. */
export function useDeterminism(): void {
  let restoreIds: () => void = () => {};
  let restoreClock: () => void = () => {};
  beforeEach(() => {
    restoreIds = setIdSource(sequentialIds('t'));
    restoreClock = setClock(() => '2026-10-09T00:00:00.000Z');
  });
  afterEach(() => {
    restoreIds();
    restoreClock();
  });
}

export const routerTemplate: DeviceTemplate = validateTemplate({
  id: 'generic/router-4ge',
  name: 'Router – 4×GE',
  vendor: 'Generic',
  model: 'Router 4×GE',
  role: 'router',
  generic: true,
  interfaces: [{ range: 'Gi0/0-3' }],
});

export const switchTemplate: DeviceTemplate = validateTemplate({
  id: 'generic/access-switch-24ge-4sfp',
  name: 'Access switch – 24×GE + 4×SFP',
  vendor: 'Generic',
  model: 'Access switch 24',
  role: 'l2-switch',
  generic: true,
  interfaces: [
    { range: 'Gi1/0/1-24', poe: true },
    { range: 'Te1/1/1-4', media: 'fiber' },
  ],
});

export function newEditor(): { ed: Editor; pageId: string } {
  const doc = createDocument('Test');
  const pageId = doc.pages[0]?.id as string;
  return { ed: new Editor(doc), pageId };
}
