// SPDX-License-Identifier: Apache-2.0
/** Page tabs at the bottom of the canvas (FR-CAN-12): switch, add, rename, reorder, delete. */
import { removePage, reorderPages, updatePage } from '@linewise/core';
import { Plus, X } from 'lucide-react';
import { useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton, Tooltip, cx } from '../components/ui.tsx';
import { newPage } from '../lib/actions.ts';
import { platform } from '../platform/index.ts';
import { useEditor } from '../store/editor.ts';

export function PagesBar() {
  const { t } = useTranslation();
  const pages = useEditor((s) => s.doc.pages);
  const pageId = useEditor((s) => s.pageId);
  const setPage = useEditor((s) => s.setPage);
  const execute = useEditor((s) => s.execute);
  const readOnly = useEditor((s) => s.readOnly);
  const [editing, setEditing] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const sorted = [...pages].sort((a, b) => a.order - b.order);

  const onDrop = (e: DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) return;
    const ids = sorted.map((p) => p.id).filter((id) => id !== dragId);
    ids.splice(ids.indexOf(targetId), 0, dragId);
    execute(reorderPages(ids));
    setDragId(null);
  };

  const remove = async (id: string, name: string) => {
    const ok = await platform().confirm(
      t(
        'pages.confirmDelete',
        'Delete page “{{name}}”? Devices placed only on this page are deleted too. You can undo this.',
        { name },
      ),
      t('pages.delete', 'Delete page'),
    );
    if (ok) execute(removePage(id));
  };

  return (
    <nav
      aria-label={t('pages.label', 'Pages')}
      className="lw-no-print flex h-8 shrink-0 items-stretch gap-0.5 overflow-x-auto border-t border-line bg-surface-2 px-1"
    >
      <div role="tablist" aria-label={t('pages.label', 'Pages')} className="flex items-stretch gap-0.5">
        {sorted.map((p) => {
          const active = p.id === pageId;
          return (
            <div
              key={p.id}
              draggable={!readOnly && editing !== p.id}
              onDragStart={() => setDragId(p.id)}
              onDragOver={(e) => dragId && e.preventDefault()}
              onDrop={(e) => onDrop(e, p.id)}
              className={cx(
                'group flex items-center rounded-b-md border-x border-b text-[12px]',
                active ? 'border-line bg-surface text-ink' : 'border-transparent text-muted hover:text-ink',
              )}
            >
              {editing === p.id ? (
                <input
                  autoFocus
                  aria-label={t('pages.rename', 'Page name')}
                  defaultValue={p.name}
                  className="h-6 w-28 rounded border border-accent bg-surface px-1 text-[12px]"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== p.name) execute(updatePage(p.id, { name: v }));
                    setEditing(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setEditing(null);
                  }}
                />
              ) : (
                <Tooltip
                  text={p.name}
                  description={t('pages.hint', 'Double-click or F2 to rename; drag to reorder')}
                  side="top"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setPage(p.id)}
                    onDoubleClick={() => !readOnly && setEditing(p.id)}
                    onKeyDown={(e) => e.key === 'F2' && !readOnly && setEditing(p.id)}
                    className="h-full px-3"
                  >
                    {p.name}
                  </button>
                </Tooltip>
              )}
              {sorted.length > 1 && !readOnly && (
                <button
                  type="button"
                  aria-label={t('pages.deleteX', 'Delete page {{name}}', { name: p.name })}
                  onClick={() => void remove(p.id, p.name)}
                  className="mr-1 rounded p-0.5 text-subtle opacity-0 hover:bg-surface-3 hover:text-ink focus:opacity-100 group-hover:opacity-100"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {!readOnly && (
        <IconButton label={t('cmd.page', 'New page')} className="h-7 min-w-7 self-center" onClick={newPage}>
          <Plus size={14} />
        </IconButton>
      )}
    </nav>
  );
}
