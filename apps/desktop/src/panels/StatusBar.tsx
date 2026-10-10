// SPDX-License-Identifier: Apache-2.0
/** Status bar: save state, selection, counts, problem badge (FR-VAL-02), view layer and zoom. */
import { CircleAlert, Lock, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../i18n/index.ts';
import { canvasApi } from '../canvas/Canvas.tsx';
import { selectDirty, useEditor } from '../store/editor.ts';
import { useUi } from '../store/ui.ts';

const LAYER_NAMES = { l1: 'Physical (L1)', l2: 'Data link (L2)', l3: 'Network (L3)' } as const;

export function StatusBar() {
  const { t } = useTranslation();
  const dirty = useEditor(selectDirty);
  const readOnly = useEditor((s) => s.readOnly);
  const issues = useEditor((s) => s.issues);
  const doc = useEditor((s) => s.doc);
  const sel = useEditor((s) => s.selection);
  const layer = useEditor((s) => s.layer);
  const highlight = useEditor((s) => s.highlightSpec);
  const zoom = useUi((s) => s.zoom);
  const autosavedAt = useUi((s) => s.autosavedAt);
  const toggle = useUi((s) => s.toggle);
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.length - errors;
  const selected = sel.devices.length + sel.links.length + sel.zones.length + sel.annotations.length;
  return (
    <footer
      className="lw-no-print flex h-6 shrink-0 items-center gap-3 border-t border-line bg-surface px-3 text-[11.5px] text-muted"
      aria-label={t('status.label', 'Status')}
    >
      <span role="status" aria-live="polite">
        {readOnly ? (
          <span className="inline-flex items-center gap-1 text-warning">
            <Lock size={11} />
            {t('status.readOnly', 'Read-only')}
          </span>
        ) : dirty ? (
          autosavedAt ? (
            t('status.autosaved', 'Unsaved · recovery copy {{t}}', { t: formatDate(autosavedAt) })
          ) : (
            t('status.unsaved', 'Unsaved changes')
          )
        ) : (
          t('status.saved', 'All changes saved')
        )}
      </span>
      <span>
        {t('status.counts', '{{d}} devices · {{l}} links', { d: doc.devices.length, l: doc.links.length })}
      </span>
      {selected > 0 && <span>{t('status.selected', '{{n}} selected', { n: selected })}</span>}
      {highlight?.kind === 'vlan' && (
        <span className="text-accent">
          {t('status.vlan', 'Highlighting VLAN {{v}}', { v: highlight.vlan })}
        </span>
      )}
      {highlight?.kind === 'path' && <PathHops />}
      <div className="flex-1" />
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded px-1 hover:bg-surface-3 hover:text-ink"
        onClick={() => toggle('problemsOpen')}
        aria-label={t('status.problems', '{{e}} errors, {{w}} warnings. Toggle problems panel.', {
          e: errors,
          w: warnings,
        })}
      >
        <span className="inline-flex items-center gap-0.5">
          <CircleAlert size={12} className={errors ? 'text-danger' : ''} />
          {errors}
        </span>
        <span className="inline-flex items-center gap-0.5">
          <TriangleAlert size={12} className={warnings ? 'text-warning' : ''} />
          {warnings}
        </span>
      </button>
      <span>{t(`layer.${layer}`, LAYER_NAMES[layer])}</span>
      <button
        type="button"
        className="w-12 rounded px-1 text-right font-mono hover:bg-surface-3 hover:text-ink"
        onClick={() => canvasApi.fit()}
        title={t('cmd.zoomFit', 'Zoom to fit')}
      >
        {Math.round(zoom * 100)}%
      </button>
    </footer>
  );
}

function PathHops() {
  const { t } = useTranslation();
  const hl = useEditor((s) => s.highlight);
  if (!hl) return null;
  const hops = hl.linkIds.size;
  return (
    <span className="text-accent">
      {hops ? t('status.hops', 'Path: {{n}} hops', { n: hops }) : t('status.noPath', 'No physical path')}
    </span>
  );
}
