// SPDX-License-Identifier: Apache-2.0
/** Auto-layout (FR-CAN-14): pick an algorithm and scope; runs in a worker with a cancel button; one undo step. */
import { applyLayout, batch, updateSettings } from '@linewise/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { canvasApi } from '../canvas/Canvas.tsx';
import { Button, Dialog, Field, Segmented } from '../components/ui.tsx';
import { LAYOUT_ALGORITHMS, type LayoutAlgorithm } from '../layout/layouts.ts';
import { selectPage, useEditor } from '../store/editor.ts';
import { useUi } from '../store/ui.ts';
import { startLayout, type LayoutJob } from '../workers/client.ts';

export function LayoutDialog() {
  const { t } = useTranslation();
  const close = useUi((s) => s.close);
  const toast = useUi((s) => s.toast);
  const sel = useEditor((s) => s.selection.devices);
  const [algorithm, setAlgorithm] = useState<LayoutAlgorithm>('hierarchical-down');
  const [scope, setScope] = useState<'page' | 'selection'>(sel.length >= 2 ? 'selection' : 'page');
  const [spacing, setSpacing] = useState(1);
  const [job, setJob] = useState<LayoutJob | null>(null);
  const names: Record<LayoutAlgorithm, [string, string]> = {
    'hierarchical-down': [
      t('layout.down', 'Hierarchical, top-down'),
      t('layout.downHint', 'WAN and edge at the top, access and endpoints below'),
    ],
    'hierarchical-right': [
      t('layout.right', 'Hierarchical, left-right'),
      t('layout.rightHint', 'Tiers from left to right'),
    ],
    orthogonal: [
      t('layout.ortho', 'Orthogonal'),
      t('layout.orthoHint', 'Tiered layout with right-angle links'),
    ],
    force: [t('layout.force', 'Force-directed'), t('layout.forceHint', 'Organic; good for meshes')],
    circular: [t('layout.circular', 'Circular'), t('layout.circularHint', 'Devices on a ring')],
    grid: [t('layout.grid', 'Grid'), t('layout.gridHint', 'Rows and columns, grouped by role')],
  };
  const run = async () => {
    const ed = useEditor.getState();
    const page = selectPage(ed);
    if (!page) return;
    const ids = new Set(scope === 'selection' ? ed.selection.devices : Object.keys(page.nodePositions));
    const nodes = ed.doc.devices
      .filter((d) => ids.has(d.id) && page.nodePositions[d.id])
      .map((d) => ({
        id: d.id,
        role: d.role,
        x: page.nodePositions[d.id]?.x ?? 0,
        y: page.nodePositions[d.id]?.y ?? 0,
      }));
    if (nodes.length < 2)
      return toast(t('layout.tooFew', 'Select at least two devices to lay out.'), 'error');
    const edges = ed.doc.links
      .filter((l) => ids.has(l.endpointA.deviceId) && ids.has(l.endpointB.deviceId))
      .map((l) => ({ source: l.endpointA.deviceId, target: l.endpointB.deviceId }));
    const j = startLayout({ algorithm, nodes, edges, spacing });
    setJob(j);
    try {
      const positions = await j.promise;
      const cmds = [applyLayout(page.id, positions)];
      if (algorithm === 'orthogonal' && ed.doc.settings.defaultLinkRouting !== 'orthogonal')
        cmds.push(updateSettings({ defaultLinkRouting: 'orthogonal' }));
      useEditor
        .getState()
        .execute(cmds.length > 1 ? batch('Auto-layout', cmds) : (cmds[0] as (typeof cmds)[number]));
      close();
      requestAnimationFrame(() => canvasApi.fit());
    } catch (e) {
      if ((e as Error).name !== 'AbortError')
        toast(t('layout.failed', 'Layout failed: {{msg}}', { msg: (e as Error).message }), 'error');
    } finally {
      setJob(null);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && (job?.cancel(), close())}
      title={t('layout.title', 'Auto-layout')}
      width={520}
      footer={
        job ? (
          <>
            <span role="status" className="mr-auto text-xs text-muted">
              {t('layout.running', 'Laying out…')}
            </span>
            <Button onClick={() => job.cancel()}>{t('common.cancel', 'Cancel')}</Button>
          </>
        ) : (
          <>
            <Button onClick={close}>{t('common.cancel', 'Cancel')}</Button>
            <Button variant="primary" onClick={() => void run()}>
              {t('layout.apply', 'Apply layout')}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <div
          role="radiogroup"
          aria-label={t('layout.algorithm', 'Algorithm')}
          className="grid gap-1 sm:grid-cols-2"
        >
          {LAYOUT_ALGORITHMS.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={algorithm === a}
              onClick={() => setAlgorithm(a)}
              className={`rounded-lg border p-2 text-left ${algorithm === a ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-2'}`}
            >
              <span className="block text-[13px] font-medium text-ink">{names[a][0]}</span>
              <span className="block text-[11.5px] text-muted">{names[a][1]}</span>
            </button>
          ))}
        </div>
        <Field label={t('layout.scope', 'Apply to')}>
          {() => (
            <Segmented
              label={t('layout.scope', 'Apply to')}
              value={scope}
              onChange={setScope}
              options={[
                { value: 'page', label: t('layout.page', 'Whole page') },
                {
                  value: 'selection',
                  label: t('layout.selection', 'Selected devices ({{n}})', { n: sel.length }),
                },
              ]}
            />
          )}
        </Field>
        <Field label={t('layout.spacing', 'Spacing')}>
          {(id) => (
            <div className="flex items-center gap-3">
              <input
                id={id}
                type="range"
                min={0.6}
                max={2}
                step={0.1}
                value={spacing}
                onChange={(e) => setSpacing(Number(e.target.value))}
                className="flex-1 accent-[var(--accent)]"
              />
              <span className="w-10 font-mono text-xs text-muted">{spacing.toFixed(1)}×</span>
            </div>
          )}
        </Field>
        <p className="text-xs text-muted">{t('layout.undo', 'You can undo the layout in one step.')}</p>
      </div>
    </Dialog>
  );
}
