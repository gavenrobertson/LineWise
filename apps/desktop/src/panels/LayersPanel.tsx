// SPDX-License-Identifier: Apache-2.0
/**
 * Layers (FR-CAN-13): user layers for annotations (show, hide, lock,
 * reorder, rename) plus the built-in network views L1/L2/L3 (FR-NET-30).
 */
import { newId, setPageLayers, type Layer, type ViewLayer } from '@linewise/core';
import { ArrowDown, ArrowUp, Eye, EyeOff, Lock, LockOpen, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, cx, IconButton } from '../components/ui.tsx';
import { selectPage, useEditor } from '../store/editor.ts';

export function LayersPanel() {
  const { t } = useTranslation();
  const page = useEditor(selectPage);
  const layer = useEditor((s) => s.layer);
  const setLayer = useEditor((s) => s.setLayer);
  const execute = useEditor((s) => s.execute);
  const readOnly = useEditor((s) => s.readOnly);
  if (!page) return null;
  const layers = [...page.layers].sort((a, b) => a.order - b.order);
  const save = (next: Layer[]) => execute(setPageLayers(page.id, next));
  const patch = (id: string, p: Partial<Layer>) =>
    save(layers.map((l) => (l.id === id ? { ...l, ...p } : l)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...layers];
    const [x] = next.splice(i, 1);
    if (x) next.splice(i + d, 0, x);
    save(next);
  };
  const views: { id: ViewLayer; name: string; hint: string }[] = [
    {
      id: 'l1',
      name: t('cmd.l1', 'Physical view (L1)'),
      hint: t('layers.l1', 'All links, media styles and interface names'),
    },
    {
      id: 'l2',
      name: t('cmd.l2', 'Data link view (L2)'),
      hint: t('layers.l2', 'VLAN colors, trunks and port-channels'),
    },
    {
      id: 'l3',
      name: t('cmd.l3', 'Network view (L3)'),
      hint: t('layers.l3', 'Routed devices, IPs and routing badges'),
    },
  ];
  return (
    <div className="flex h-full flex-col overflow-y-auto px-3 pb-3 pt-1">
      <h3 className="py-1 text-[11px] font-semibold uppercase tracking-wide text-subtle">
        {t('layers.network', 'Network views')}
      </h3>
      <div
        role="radiogroup"
        aria-label={t('layers.network', 'Network views')}
        className="mb-3 flex flex-col gap-0.5"
      >
        {views.map((v) => (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={layer === v.id}
            onClick={() => setLayer(v.id)}
            className={cx(
              'rounded-md px-2 py-1.5 text-left',
              layer === v.id ? 'bg-accent-soft' : 'hover:bg-surface-3',
            )}
          >
            <span className="block text-[12.5px] font-medium text-ink">{v.name}</span>
            <span className="block text-[11px] text-subtle">{v.hint}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between py-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-subtle">
          {t('layers.user', 'Annotation layers')}
        </h3>
        {!readOnly && (
          <IconButton
            label={t('layers.add', 'Add layer')}
            className="h-6 min-w-6"
            onClick={() =>
              save([
                ...layers,
                {
                  id: newId(),
                  name: t('layers.default', 'Layer {{n}}', { n: layers.length + 1 }),
                  visible: true,
                  locked: false,
                  order: layers.length,
                },
              ])
            }
          >
            <Plus size={14} />
          </IconButton>
        )}
      </div>
      {layers.length === 0 && (
        <div className="rounded-md border border-dashed border-line p-3 text-[11.5px] text-muted">
          {t('layers.empty', 'Layers group notes, shapes and images so you can hide or lock them together.')}
          {!readOnly && (
            <Button
              size="sm"
              className="mt-2"
              onClick={() =>
                save([
                  {
                    id: newId(),
                    name: t('layers.default', 'Layer {{n}}', { n: 1 }),
                    visible: true,
                    locked: false,
                    order: 0,
                  },
                ])
              }
            >
              {t('layers.add', 'Add layer')}
            </Button>
          )}
        </div>
      )}
      <ul className="flex flex-col gap-0.5">
        {layers.map((l, i) => (
          <li key={l.id} className="flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-surface-3">
            <IconButton
              label={l.visible ? t('layers.hide', 'Hide layer') : t('layers.show', 'Show layer')}
              className="h-6 min-w-6"
              onClick={() => patch(l.id, { visible: !l.visible })}
            >
              {l.visible ? <Eye size={13} /> : <EyeOff size={13} />}
            </IconButton>
            <IconButton
              label={l.locked ? t('layers.unlock', 'Unlock layer') : t('layers.lock', 'Lock layer')}
              className="h-6 min-w-6"
              onClick={() => patch(l.id, { locked: !l.locked })}
            >
              {l.locked ? <Lock size={13} /> : <LockOpen size={13} />}
            </IconButton>
            <input
              aria-label={t('layers.name', 'Layer name')}
              defaultValue={l.name}
              key={l.name}
              className="h-6 min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 text-[12.5px] hover:border-line focus:border-accent"
              onBlur={(e) =>
                e.target.value.trim() &&
                e.target.value !== l.name &&
                patch(l.id, { name: e.target.value.trim() })
              }
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
            <IconButton
              label={t('layers.up', 'Move up')}
              className="h-6 min-w-6"
              disabled={i === 0}
              onClick={() => move(i, -1)}
            >
              <ArrowUp size={12} />
            </IconButton>
            <IconButton
              label={t('layers.down', 'Move down')}
              className="h-6 min-w-6"
              disabled={i === layers.length - 1}
              onClick={() => move(i, 1)}
            >
              <ArrowDown size={12} />
            </IconButton>
            <IconButton
              label={t('layers.delete', 'Delete layer')}
              className="h-6 min-w-6"
              onClick={() => save(layers.filter((x) => x.id !== l.id))}
            >
              <Trash2 size={12} />
            </IconButton>
          </li>
        ))}
      </ul>
    </div>
  );
}
