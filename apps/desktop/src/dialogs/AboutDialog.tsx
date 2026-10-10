// SPDX-License-Identifier: Apache-2.0
/** About LineWise: version, license, credits (NFR-LIC-03). */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrandMark, Wordmark } from '../components/BrandMark.tsx';
import { Button, Dialog } from '../components/ui.tsx';
import { platform } from '../platform/index.ts';
import { useUi } from '../store/ui.ts';

const REPO = 'https://github.com/gavenrobertson/linewise';

export function AboutDialog() {
  const { t } = useTranslation();
  const close = useUi((s) => s.close);
  const [version, setVersion] = useState('');
  useEffect(() => {
    void platform().appVersion().then(setVersion);
  }, []);
  const link = (href: string, text: string) => (
    <button
      type="button"
      className="text-accent underline"
      onClick={() => void platform().openExternal(href)}
    >
      {text}
    </button>
  );
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && close()}
      title={t('about.title', 'About LineWise')}
      width={440}
      footer={<Button onClick={close}>{t('common.done', 'Done')}</Button>}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <BrandMark size={64} />
        <Wordmark className="text-[26px] text-ink" />
        <p className="font-mono text-xs text-muted">{t('about.version', 'Version {{v}}', { v: version })}</p>
        <p className="text-[13px] text-ink">
          {t(
            'about.desc',
            'An open-source network diagramming app that understands interfaces, VLANs and subnets.',
          )}
        </p>
        <p className="text-xs text-muted">
          {t('about.license', 'Licensed under the Apache License 2.0.')}{' '}
          {link(`${REPO}/blob/main/LICENSE`, t('about.licenseLink', 'Read the license'))} ·{' '}
          {link(`${REPO}/blob/main/THIRD_PARTY_NOTICES.md`, t('about.notices', 'Third-party notices'))}
        </p>
        <p className="text-xs text-muted">
          {t(
            'about.trademarks',
            'Cisco and other vendor names are trademarks of their owners. LineWise is not affiliated with or endorsed by any vendor; all device icons are original.',
          )}
        </p>
        <p className="text-xs text-muted">{link(REPO, 'github.com/gavenrobertson/linewise')}</p>
      </div>
    </Dialog>
  );
}
