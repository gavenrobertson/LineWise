// SPDX-License-Identifier: Apache-2.0
/** Find (FR-CAN-15): search hostname, IP, interface, VLAN or label; the results list pans to each hit. */
import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { canvasApi } from '../canvas/Canvas.tsx';
import { cx, IconButton } from '../components/ui.tsx';
import { searchDocument, type Hit } from '../lib/search.ts';
import { useEditor } from '../store/editor.ts';
import { useUi } from '../store/ui.ts';

export function revealHit(h: Hit): void {
  const ed = useEditor.getState();
  if (h.kind === 'vlan' && h.vlan) {
    ed.setHighlight({ kind: 'vlan', vlan: h.vlan });
    ed.setLayer('l2');
    return;
  }
  if (h.pageId && h.pageId !== ed.pageId) ed.setPage(h.pageId);
  const st = useEditor.getState();
  if (h.kind === 'device' || h.kind === 'interface') st.setSelection({ devices: [h.deviceId as string] });
  else if (h.kind === 'link') st.setSelection({ links: [h.id] });
  else if (h.kind === 'zone') st.setSelection({ zones: [h.id] });
  else if (h.kind === 'annotation') st.setSelection({ annotations: [h.id] });
  requestAnimationFrame(() =>
    canvasApi.focusOn([h.kind === 'link' || h.kind === 'interface' ? (h.deviceId ?? h.id) : h.id]),
  );
}

const KIND_LABEL: Record<Hit['kind'], string> = {
  device: 'Device',
  interface: 'Interface',
  link: 'Link',
  vlan: 'VLAN',
  zone: 'Zone',
  annotation: 'Note',
};

export function FindPanel() {
  const { t } = useTranslation();
  const setFind = useUi((s) => s.setFind);
  const doc = useEditor((s) => s.doc);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const [started, setStarted] = useState(false);
  const hits = useMemo(() => searchDocument(doc, q), [doc, q]);
  useEffect(() => {
    setIdx(0);
    setStarted(false);
  }, [q]);
  const go = (i: number) => {
    if (!hits.length) return;
    setStarted(true);
    const n = (i + hits.length) % hits.length;
    setIdx(n);
    revealHit(hits[n] as Hit);
  };
  return (
    <div
      role="search"
      className="lw-no-print absolute right-3 top-3 z-20 flex w-80 flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-[var(--shadow)]"
    >
      <div className="flex items-center gap-1 px-2">
        <Search size={14} className="text-subtle" />
        <input
          autoFocus
          aria-label={t('find.input', 'Find hostname, IP, interface, VLAN or label')}
          placeholder={t('find.input', 'Find hostname, IP, interface, VLAN or label')}
          className="h-9 min-w-0 flex-1 bg-transparent text-[13px] outline-none"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') go(!started ? 0 : e.shiftKey ? idx - 1 : idx + 1);
            if (e.key === 'Escape') setFind(false);
            if (e.key === 'ArrowDown') go(idx + 1);
            if (e.key === 'ArrowUp') go(idx - 1);
          }}
        />
        <span className="text-[11px] text-subtle" aria-live="polite">
          {q ? (hits.length ? `${idx + 1}/${hits.length}` : t('find.none', 'No results')) : ''}
        </span>
        <IconButton
          label={t('find.close', 'Close find')}
          className="h-7 min-w-7"
          onClick={() => setFind(false)}
        >
          <X size={14} />
        </IconButton>
      </div>
      {hits.length > 0 && (
        <ul
          className="max-h-72 overflow-y-auto border-t border-line"
          aria-label={t('find.results', 'Results')}
        >
          {hits.map((h, i) => (
            <li key={`${h.kind}-${h.id}`}>
              <button
                type="button"
                onClick={() => go(i)}
                className={cx(
                  'flex w-full flex-col px-3 py-1.5 text-left hover:bg-surface-3',
                  i === idx && 'bg-accent-soft',
                )}
              >
                <span className="flex items-center gap-2 text-[12.5px] text-ink">
                  <span className="rounded bg-surface-3 px-1 text-[10px] uppercase tracking-wide text-muted">
                    {t(`find.kind.${h.kind}`, KIND_LABEL[h.kind])}
                  </span>
                  <span className="truncate">{h.title}</span>
                </span>
                {h.detail && (
                  <span className="truncate pl-1 font-mono text-[11px] text-subtle">{h.detail}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
