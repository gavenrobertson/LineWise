// SPDX-License-Identifier: Apache-2.0
/** Command palette (FR-APP-08): every menu action plus device search by hostname or IP. */
import * as RDialog from '@radix-ui/react-dialog';
import { Command as CmdIcon, Monitor } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cx, Keys } from '../components/ui.tsx';
import { commandList, formatShortcut, runCommand } from '../lib/actions.ts';
import { searchDocument } from '../lib/search.ts';
import { revealHit } from './FindPanel.tsx';
import { useEditor } from '../store/editor.ts';
import { useUi } from '../store/ui.ts';
import { useReleaseOnClose, usePresence } from '../components/Presence.tsx';

type Item = {
  key: string;
  label: string;
  detail: string;
  shortcut?: string;
  kind: 'command' | 'device';
  run: () => void;
};

export function CommandPalette() {
  const { t } = useTranslation();
  const open = useUi((s) => s.palette);
  const setPalette = useUi((s) => s.setPalette);
  const doc = useEditor((s) => s.doc);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  // The list keeps its results while the palette fades out; a fresh opening starts empty.
  const { mounted } = usePresence(open);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQ('');
      setActive(0);
    }
  }
  const content = useReleaseOnClose(open);
  const items: Item[] = useMemo(() => {
    if (!mounted) return [];
    const query = q.trim().toLowerCase();
    const cmds = commandList()
      .filter((c) => !query || `${c.group} ${c.label}`.toLowerCase().includes(query))
      .map<Item>((c) => ({
        key: c.id,
        label: c.label,
        detail: c.group,
        shortcut: c.shortcut,
        kind: 'command',
        run: () => runCommand(c.id),
      }));
    const devices = query
      ? searchDocument(doc, q, 30)
          .filter((h) => h.kind === 'device' || h.kind === 'interface')
          .slice(0, 12)
          .map<Item>((h) => ({
            key: `${h.kind}-${h.id}`,
            label: h.title,
            detail: h.detail,
            kind: 'device',
            run: () => revealHit(h),
          }))
      : [];
    return [...devices, ...cmds].slice(0, 60);
  }, [mounted, q, doc]);
  const run = (i: Item | undefined) => {
    if (!i) return;
    setPalette(false);
    i.run();
  };
  return (
    <RDialog.Root open={open} onOpenChange={setPalette}>
      <RDialog.Portal>
        <RDialog.Overlay className="lw-overlay fixed inset-0 z-40 bg-[rgba(14,23,38,0.24)]" />
        <RDialog.Content
          ref={content}
          className="lw-sheet lw-material fixed left-1/2 top-[14vh] z-50 w-[calc(100vw-32px)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-line shadow-elev-3"
          aria-describedby={undefined}
        >
          <RDialog.Title className="sr-only">{t('cmd.palette', 'Command palette')}</RDialog.Title>
          <div className="flex items-center gap-2 border-b border-line px-3">
            <CmdIcon size={15} className="text-subtle" />
            <input
              autoFocus
              role="combobox"
              aria-expanded="true"
              aria-controls="lw-palette-list"
              aria-activedescendant={items[active] ? `lw-pal-${active}` : undefined}
              aria-label={t('palette.input', 'Type a command, hostname or IP')}
              placeholder={t('palette.input', 'Type a command, hostname or IP')}
              className="h-11 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-subtle"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive((a) => Math.min(items.length - 1, a + 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((a) => Math.max(0, a - 1));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  run(items[active]);
                }
              }}
            />
          </div>
          <ul
            id="lw-palette-list"
            role="listbox"
            aria-label={t('palette.results', 'Results')}
            className="max-h-[50vh] overflow-y-auto p-1"
          >
            {items.map((i, n) => (
              <li
                key={i.key}
                id={`lw-pal-${n}`}
                role="option"
                aria-selected={n === active}
                onMouseMove={() => setActive(n)}
                onClick={() => run(i)}
                className={cx(
                  'lw-row flex items-center gap-2 rounded-md px-2 py-1.5',
                  n === active && 'bg-accent-soft',
                )}
              >
                {i.kind === 'device' && <Monitor size={14} className="text-subtle" />}
                <span className="text-[13px] text-ink">{i.label}</span>
                <span className="truncate text-[11.5px] text-subtle">{i.detail}</span>
                {i.shortcut && (
                  <span className="ml-auto">
                    <Keys shortcut={formatShortcut(i.shortcut)} />
                  </span>
                )}
              </li>
            ))}
            {items.length === 0 && (
              <li className="px-3 py-6 text-center text-xs text-muted">
                {t('palette.none', 'Nothing matches.')}
              </li>
            )}
          </ul>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
