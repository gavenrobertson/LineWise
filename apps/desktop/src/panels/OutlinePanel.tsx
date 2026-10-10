// SPDX-License-Identifier: Apache-2.0
/**
 * Outline: every device on the page grouped by zone, as a keyboard-friendly
 * alternative to the canvas (NFR-A11Y-01). Selecting an entry selects and
 * reveals the device.
 */
import { ROLE_LABELS } from '@linewise/device-library';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { canvasApi } from '../canvas/Canvas.tsx';
import { DeviceIcon } from '../canvas/nodes.tsx';
import { cx } from '../components/ui.tsx';
import { selectPage, useEditor } from '../store/editor.ts';

export function OutlinePanel() {
  const { t } = useTranslation();
  const doc = useEditor((s) => s.doc);
  const page = useEditor(selectPage);
  const sel = useEditor((s) => s.selection);
  const setSelection = useEditor((s) => s.setSelection);
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const onPage = doc.devices.filter((d) => page?.nodePositions[d.id]);
    const query = q.trim().toLowerCase();
    const match = onPage.filter(
      (d) => !query || `${d.hostname} ${d.mgmtIp} ${d.model} ${d.role}`.toLowerCase().includes(query),
    );
    const m = new Map<string, typeof match>();
    for (const d of match) m.set(d.zoneId ?? '', [...(m.get(d.zoneId ?? '') ?? []), d]);
    for (const list of m.values())
      list.sort((a, b) => a.hostname.localeCompare(b.hostname, undefined, { numeric: true }));
    return [...m.entries()].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : 0));
  }, [doc.devices, page, q]);
  const zoneName = (id: string) =>
    doc.zones.find((z) => z.id === id)?.name ?? t('outline.noZone', 'Not in a zone');
  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pb-2 pt-1">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('outline.search', 'Filter by hostname or IP')}
          aria-label={t('outline.search', 'Filter by hostname or IP')}
          className="h-8 w-full rounded-md border border-line bg-surface-2 px-2 text-[12.5px]"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {groups.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted">
            {t('outline.empty', 'No devices on this page.')}
          </p>
        )}
        {groups.map(([zoneId, list]) => (
          <section key={zoneId || 'none'} className="mb-2">
            <h3 className="px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-subtle">
              {zoneName(zoneId)} <span className="font-normal normal-case">({list.length})</span>
            </h3>
            <ul role="listbox" aria-label={zoneName(zoneId)} aria-multiselectable="true">
              {list.map((d) => {
                const selected = sel.devices.includes(d.id);
                return (
                  <li key={d.id} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={(e) => {
                        const add = e.metaKey || e.ctrlKey || e.shiftKey;
                        setSelection({
                          devices: add
                            ? selected
                              ? sel.devices.filter((x) => x !== d.id)
                              : [...sel.devices, d.id]
                            : [d.id],
                        });
                        canvasApi.focusOn([d.id]);
                      }}
                      className={cx(
                        'flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left',
                        selected ? 'bg-accent-soft' : 'hover:bg-surface-3',
                      )}
                    >
                      <DeviceIcon role={d.role} style={doc.settings.iconStyle} size={20} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium text-ink">
                          {d.hostname}
                        </span>
                        <span className="block truncate text-[11px] text-subtle">
                          {[ROLE_LABELS[d.role], d.mgmtIp].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
