// SPDX-License-Identifier: Apache-2.0
/** Keyboard shortcuts reference (FR-KEY-02). */
import { useTranslation } from 'react-i18next';
import { Button, Dialog, Kbd } from '../components/ui.tsx';
import { commandList, formatShortcut } from '../lib/actions.ts';
import { useUi } from '../store/ui.ts';

export function ShortcutsDialog() {
  const { t } = useTranslation();
  const close = useUi((s) => s.close);
  const groups = new Map<string, { label: string; keys: string }[]>();
  for (const c of commandList()) {
    if (!c.shortcut) continue;
    groups.set(c.group, [
      ...(groups.get(c.group) ?? []),
      { label: c.label, keys: formatShortcut(c.shortcut) },
    ]);
  }
  groups.set(t('shortcuts.canvas', 'Canvas'), [
    { label: t('shortcuts.pan', 'Pan'), keys: t('shortcuts.panKeys', 'Space + drag, or middle mouse') },
    { label: t('shortcuts.multi', 'Add to selection'), keys: `Shift / ${formatShortcut('mod')} + click` },
    { label: t('shortcuts.nudge', 'Nudge selection'), keys: '← ↑ → ↓ (Shift ×10)' },
    { label: t('shortcuts.focus', 'Move focus to nearest device'), keys: 'Alt + ← ↑ → ↓' },
    { label: t('shortcuts.edit', 'Edit hostname'), keys: 'Enter' },
    { label: t('shortcuts.link', 'Link from focused device'), keys: 'L' },
    { label: t('shortcuts.escape', 'Clear selection and highlight'), keys: 'Esc' },
  ]);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && close()}
      title={t('shortcuts.title', 'Keyboard shortcuts')}
      width={720}
      footer={<Button onClick={close}>{t('common.done', 'Done')}</Button>}
    >
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {[...groups.entries()].map(([g, items]) => (
          <section key={g}>
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-subtle">{g}</h3>
            <dl className="flex flex-col">
              {items.map((i) => (
                <div
                  key={i.label}
                  className="flex items-center justify-between gap-3 border-b border-line py-1 text-[13px]"
                >
                  <dt className="text-ink">{i.label}</dt>
                  <dd>
                    <Kbd>{i.keys}</Kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
