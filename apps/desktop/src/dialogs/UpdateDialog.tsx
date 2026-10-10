// SPDX-License-Identifier: Apache-2.0
/** Update available (NFR-UPD-01): notes, then download, verify and restart. */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dialog } from '../components/ui.tsx';
import { save } from '../lib/actions.ts';
import type { UpdateInfo } from '../platform/index.ts';
import { selectDirty, useEditor } from '../store/editor.ts';
import { useUi } from '../store/ui.ts';

export function UpdateDialog({ info }: { info: UpdateInfo }) {
  const { t } = useTranslation();
  const close = useUi((s) => s.close);
  const toast = useUi((s) => s.toast);
  const [busy, setBusy] = useState(false);
  const install = async () => {
    if (selectDirty(useEditor.getState()) && !(await save(false))) return;
    setBusy(true);
    try {
      await info.install();
    } catch (e) {
      toast(t('update.installFailed', 'Update failed: {{msg}}', { msg: (e as Error).message }), 'error');
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !busy && close()}
      title={t('update.title', 'LineWise {{v}} is available', { v: info.version })}
      width={520}
      footer={
        <>
          <Button onClick={close} disabled={busy}>
            {t('update.later', 'Later')}
          </Button>
          <Button variant="primary" onClick={() => void install()} disabled={busy}>
            {busy ? t('update.installing', 'Installing…') : t('update.install', 'Install and restart')}
          </Button>
        </>
      }
    >
      <p className="mb-2 text-xs text-muted">
        {t(
          'update.signed',
          'Updates are signed and verified before they install. Unsaved work is saved first.',
        )}
      </p>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-surface-2 p-3 font-sans text-[13px] text-ink">
        {info.notes || t('update.noNotes', 'No release notes.')}
      </pre>
    </Dialog>
  );
}
