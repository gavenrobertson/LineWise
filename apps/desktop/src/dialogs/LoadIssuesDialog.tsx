// SPDX-License-Identifier: Apache-2.0
/** A file that failed validation (NFR-REL-03): explain, and offer to open a recovered copy. */
import { useTranslation } from 'react-i18next';
import { Button, Dialog } from '../components/ui.tsx';
import { useUi } from '../store/ui.ts';

export function LoadIssuesDialog({
  issues,
  onRecover,
}: {
  issues: { path: string; message: string }[];
  onRecover: (() => void) | null;
}) {
  const { t } = useTranslation();
  const close = useUi((s) => s.close);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && close()}
      title={t('load.title', 'This file has problems')}
      description={t(
        'load.desc',
        'LineWise did not change the file. You can open a recovered copy with the readable parts.',
      )}
      width={600}
      footer={
        <>
          <Button onClick={close}>{t('common.cancel', 'Cancel')}</Button>
          {onRecover && (
            <Button variant="primary" onClick={onRecover}>
              {t('load.recover', 'Open recovered copy')}
            </Button>
          )}
        </>
      }
    >
      <ul className="max-h-72 overflow-auto rounded-md bg-surface-2 p-3 font-mono text-[12px]">
        {issues.slice(0, 200).map((i, n) => (
          <li key={n} className="py-0.5">
            <span className="text-muted">{i.path || '(root)'}</span> —{' '}
            <span className="text-ink">{i.message}</span>
          </li>
        ))}
        {issues.length > 200 && (
          <li className="pt-1 text-muted">{t('load.more', '…and {{n}} more', { n: issues.length - 200 })}</li>
        )}
      </ul>
    </Dialog>
  );
}
