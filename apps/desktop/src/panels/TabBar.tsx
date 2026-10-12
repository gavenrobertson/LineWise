// SPDX-License-Identifier: Apache-2.0
/**
 * Open diagrams as tabs above the canvas (FR-APP-02). Each tab keeps its own document, undo
 * history, page and selection; a dot marks unsaved changes. Ctrl+Tab / Ctrl+Shift+Tab cycle.
 */
import { Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cx, Tooltip } from '../components/ui.tsx';
import { autosaveNow, closeActiveTab, formatShortcut } from '../lib/actions.ts';
import { selectDirty, useEditor } from '../store/editor.ts';
import { useUi } from '../store/ui.ts';

export function TabBar() {
  const { t } = useTranslation();
  const tabs = useEditor((s) => s.tabs);
  const activeId = useEditor((s) => s.activeTabId);
  const activeDirty = useEditor(selectDirty);
  const switchTab = useEditor((s) => s.switchTab);

  const select = (id: string) => {
    if (id === activeId) return;
    void autosaveNow();
    switchTab(id);
  };

  // Bring the tab forward first so any unsaved-changes prompt is about what the user sees.
  const close = async (id: string) => {
    select(id);
    await closeActiveTab();
  };

  return (
    <nav
      aria-label={t('tabs.label', 'Open diagrams')}
      className="lw-no-print flex h-8 shrink-0 items-end gap-0.5 overflow-x-auto border-b border-line bg-surface-2 px-1"
    >
      <ul className="flex min-w-0 items-end gap-0.5">
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          const dirty = active ? activeDirty : tab.dirty;
          const name = tab.fileName.replace(/\.lwise$/i, '') || t('doc.untitled', 'Untitled diagram');
          return (
            <li
              key={tab.id}
              className={cx(
                'group flex h-7 max-w-[220px] items-center rounded-t-md border border-b-0 text-[12.5px]',
                active
                  ? 'border-line bg-surface text-ink'
                  : 'border-transparent text-muted hover:bg-surface-3',
              )}
            >
              <Tooltip text={name} description={tab.path ?? undefined}>
                <button
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => select(tab.id)}
                  className="flex min-w-0 items-center gap-1.5 truncate py-1 pl-2.5 pr-1"
                >
                  {dirty && (
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-fill"
                      aria-label={t('tabs.unsaved', 'unsaved changes')}
                      role="img"
                    />
                  )}
                  <span className="truncate">{name}</span>
                </button>
              </Tooltip>
              <button
                type="button"
                aria-label={t('tabs.close', 'Close {{name}}', { name })}
                onClick={() => void close(tab.id)}
                className="mr-1 rounded p-0.5 text-subtle opacity-70 hover:bg-surface-3 hover:text-ink group-hover:opacity-100"
              >
                <X size={12} />
              </button>
            </li>
          );
        })}
      </ul>
      <Tooltip text={t('tabs.new', 'New diagram')} shortcut={formatShortcut('mod+N')}>
        <button
          type="button"
          aria-label={t('tabs.new', 'New diagram')}
          onClick={() => useUi.getState().open({ kind: 'welcome' })}
          className="mb-1 ml-1 rounded p-1 text-muted hover:bg-surface-3 hover:text-ink"
        >
          <Plus size={14} />
        </button>
      </Tooltip>
    </nav>
  );
}
