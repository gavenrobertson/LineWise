// SPDX-License-Identifier: Apache-2.0
/**
 * Welcome screen (FR-APP-05/06): new blank diagram, starter templates, recent
 * files (last 10), open, and recovered work after a crash (NFR-REL-02).
 */
import { parseDocument, type NetworkDocument } from '@linewise/core';
import { STARTERS } from '@linewise/device-library';
import { FilePlus, FolderOpen, History, LifeBuoy, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrandMark, Wordmark } from '../components/BrandMark.tsx';
import { Button, Dialog } from '../components/ui.tsx';
import i18n, { formatDate } from '../i18n/index.ts';
import { newDocument, openFile } from '../lib/actions.ts';
import { platform, type RecentFile, type RecoveryEntry } from '../platform/index.ts';
import { useEditor } from '../store/editor.ts';
import { useUi } from '../store/ui.ts';

export function restoreRecovery(r: RecoveryEntry): void {
  const res = parseDocument(r.text);
  if (res.status !== 'ok' && res.status !== 'newer') {
    useUi.getState().toast(
      i18n.t('welcome.damaged', {
        defaultValue: 'That recovery copy is damaged and could not be restored.',
      }),
      'error',
    );
    return;
  }
  const ed = useEditor.getState();
  ed.openTab(res.doc as NetworkDocument, {
    path: r.path,
    name: r.name,
    readOnly: res.status === 'newer',
  });
  // A restored copy has unsaved changes relative to the file on disk.
  useEditor.setState({ savedRev: -1 });
  useUi.getState().close();
}

export function WelcomeDialog() {
  const { t } = useTranslation();
  const close = useUi((s) => s.close);
  const open = useUi((s) => s.open);
  const [recent, setRecent] = useState<RecentFile[]>([]);
  const [recovery, setRecovery] = useState<RecoveryEntry[]>([]);
  useEffect(() => {
    void platform()
      .recentFiles()
      .then(setRecent)
      .catch(() => setRecent([]));
    void platform()
      .listRecovery()
      .then(setRecovery)
      .catch(() => setRecovery([]));
  }, []);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && close()}
      title={t('welcome.title', 'Welcome to LineWise')}
      width={820}
    >
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <div className="flex flex-col gap-2">
          <div className="mb-2 flex items-center gap-2">
            <BrandMark size={36} />
            <Wordmark className="text-[22px] text-ink" />
          </div>
          <p className="mb-2 text-xs text-muted">
            {t('welcome.tagline', 'Network diagrams that know what a trunk is.')}
          </p>
          <Button variant="primary" className="justify-start" onClick={() => void newDocument()}>
            <FilePlus size={15} />
            {t('welcome.blank', 'New blank diagram')}
          </Button>
          <Button className="justify-start" onClick={() => void openFile()}>
            <FolderOpen size={15} />
            {t('welcome.open', 'Open file…')}
          </Button>
          <Button className="justify-start" onClick={() => open({ kind: 'import' })}>
            <Upload size={15} />
            {t('welcome.import', 'Import from CLI output…')}
          </Button>
          {recovery.length > 0 && (
            <div className="mt-3 rounded-lg border border-warning/40 bg-warning-soft p-2">
              <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-warning">
                <LifeBuoy size={13} />
                {t('welcome.recovered', 'Recovered work')}
              </p>
              <ul className="flex flex-col gap-1">
                {recovery.map((r) => (
                  <li key={r.docId} className="flex items-center gap-1 text-xs">
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left text-ink underline"
                      onClick={() => restoreRecovery(r)}
                      title={t('welcome.restore', 'Restore this copy')}
                    >
                      {r.name}
                    </button>
                    <span className="shrink-0 text-subtle">{formatDate(r.savedAt)}</span>
                    <button
                      type="button"
                      className="shrink-0 text-subtle hover:text-danger"
                      aria-label={t('welcome.discard', 'Discard recovered copy of {{n}}', { n: r.name })}
                      onClick={async () => {
                        await platform().clearRecovery(r.docId);
                        setRecovery((x) => x.filter((y) => y.docId !== r.docId));
                      }}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-subtle">
              {t('welcome.starters', 'Start from a template')}
            </h3>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {STARTERS.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => void newDocument(s.build())}
                    className="flex h-full w-full flex-col items-start rounded-lg border border-line bg-surface p-3 text-left transition-colors hover:border-accent hover:bg-accent-soft"
                  >
                    <span className="text-[13px] font-semibold text-ink">
                      {t(`starter.${s.id}.name`, s.name)}
                    </span>
                    <span className="mt-0.5 text-xs text-muted">
                      {t(`starter.${s.id}.desc`, s.description)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-subtle">
              <History size={12} />
              {t('welcome.recent', 'Recent')}
            </h3>
            {recent.length === 0 ? (
              <p className="text-xs text-muted">
                {t('welcome.noRecent', 'Files you open or save appear here.')}
              </p>
            ) : (
              <ul className="flex flex-col">
                {recent.slice(0, 10).map((r) => (
                  <li key={r.path}>
                    <button
                      type="button"
                      onClick={() => void openFile(r.path)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-surface-3"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-ink">{r.name}</span>
                        <span className="block truncate text-[11px] text-subtle">{r.path}</span>
                      </span>
                      <span className="shrink-0 text-[11px] text-subtle">{formatDate(r.openedAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </Dialog>
  );
}
