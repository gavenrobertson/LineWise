// SPDX-License-Identifier: Apache-2.0
/** Multi-document tabs (FR-APP-02) with per-tab undo history (FR-CAN-07). */
import { addDevice, createDocument } from '@linewise/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { dirtyTabIds, selectDirty, useEditor } from '../src/store/editor.ts';

const ed = () => useEditor.getState();

function addRouter(): void {
  ed().execute(addDevice({ role: 'router', pageId: ed().pageId, position: { x: 0, y: 0 } }));
}

beforeEach(() => {
  // Back to a single blank tab.
  for (const t of [...ed().tabs]) ed().closeTab(t.id);
  ed().loadDocument(createDocument('Blank'));
});

describe('FR-APP-02 diagram tabs', () => {
  it('reuses an untouched blank tab and opens a new tab otherwise', () => {
    const first = ed().activeTabId;
    ed().openTab(createDocument('A'), { path: '/d/a.lwise', name: 'a.lwise' });
    expect(ed().tabs).toHaveLength(1);
    expect(ed().activeTabId).toBe(first);
    ed().openTab(createDocument('B'), { path: '/d/b.lwise', name: 'b.lwise' });
    expect(ed().tabs.map((t) => t.fileName)).toEqual(['a.lwise', 'b.lwise']);
    expect(ed().doc.name).toBe('B');
  });

  it('keeps each tab’s document, history and dirty state across switches (FR-CAN-07)', () => {
    ed().openTab(createDocument('A'), { path: '/d/a.lwise', name: 'a.lwise' });
    const a = ed().activeTabId;
    addRouter();
    addRouter();
    const b = ed().openTab(createDocument('B'), { path: '/d/b.lwise', name: 'b.lwise' });
    addRouter();
    expect(ed().doc.devices).toHaveLength(1);

    ed().switchTab(a);
    expect(ed().doc.name).toBe('A');
    expect(ed().doc.devices).toHaveLength(2);
    expect(selectDirty(ed())).toBe(true);
    expect(ed().canUndo).toBe(true);
    ed().undo();
    expect(ed().doc.devices).toHaveLength(1);

    ed().switchTab(b);
    expect(ed().doc.devices).toHaveLength(1);
    ed().undo();
    expect(ed().doc.devices).toHaveLength(0);
    expect(ed().canUndo).toBe(false);
    expect(new Set(dirtyTabIds())).toEqual(new Set([a, b]));
  });

  it('marks only the saved tab clean and shows the dot on the others', () => {
    ed().openTab(createDocument('A'), { path: '/d/a.lwise', name: 'a.lwise' });
    const a = ed().activeTabId;
    addRouter();
    const b = ed().openTab(createDocument('B'), { path: '/d/b.lwise', name: 'b.lwise' });
    addRouter();
    ed().markSaved('/d/b.lwise', 'b.lwise');
    expect(ed().tabs.find((t) => t.id === a)?.dirty).toBe(true);
    expect(ed().tabs.find((t) => t.id === b)?.dirty).toBe(false);
    expect(dirtyTabIds()).toEqual([a]);
  });

  it('closing a tab drops its history and activates a neighbour; the last tab becomes blank', () => {
    ed().openTab(createDocument('A'), { path: '/d/a.lwise', name: 'a.lwise' });
    addRouter();
    const b = ed().openTab(createDocument('B'), { path: '/d/b.lwise', name: 'b.lwise' });
    ed().closeTab(b);
    expect(ed().tabs).toHaveLength(1);
    expect(ed().doc.name).toBe('A');
    ed().closeTab(ed().activeTabId);
    expect(ed().tabs).toHaveLength(1);
    expect(ed().doc.devices).toHaveLength(0);
    expect(ed().canUndo).toBe(false);
  });

  it('revisions stay unique across tabs so stale validation results are ignored', () => {
    ed().openTab(createDocument('A'), { path: '/d/a.lwise', name: 'a.lwise' });
    const a = ed().activeTabId;
    const revA = ed().rev;
    ed().openTab(createDocument('B'), { path: '/d/b.lwise', name: 'b.lwise' });
    ed().switchTab(a);
    expect(ed().rev).toBeGreaterThan(revA);
    ed().setIssues(
      revA,
      [{ ruleId: 'VAL-016', severity: 'info', message: 'stale', objectIds: [], fixes: [] }],
      [],
    );
    expect(ed().issues).toEqual([]);
  });
});
