// SPDX-License-Identifier: Apache-2.0
/** Left sidebar: device library, outline and layers in tabs. */
import * as Tabs from '@radix-ui/react-tabs';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayersPanel } from './LayersPanel.tsx';
import { LibraryBody } from './LibraryPanel.tsx';
import { OutlinePanel } from './OutlinePanel.tsx';

const tabCls =
  'h-8 flex-1 border-b-2 border-transparent text-[12px] font-medium text-muted hover:text-ink data-[state=active]:border-accent data-[state=active]:text-ink';

export function SidePanel() {
  const { t } = useTranslation();
  const [tab, setTab] = useState(() => {
    try {
      return localStorage.getItem('linewise.sidetab') ?? 'library';
    } catch {
      return 'library';
    }
  });
  useEffect(() => {
    const show = () => setTab('library');
    window.addEventListener('linewise:library', show);
    return () => window.removeEventListener('linewise:library', show);
  }, []);
  const change = (v: string) => {
    setTab(v);
    try {
      localStorage.setItem('linewise.sidetab', v);
    } catch {
      // per-session only
    }
  };
  return (
    <aside
      aria-label={t('side.label', 'Sidebar')}
      className="lw-no-print flex h-full w-64 shrink-0 flex-col border-r border-line bg-surface"
    >
      <Tabs.Root value={tab} onValueChange={change} className="flex min-h-0 flex-1 flex-col">
        <Tabs.List
          aria-label={t('side.label', 'Sidebar')}
          className="flex shrink-0 border-b border-line px-2"
        >
          <Tabs.Trigger value="library" className={tabCls}>
            {t('side.library', 'Library')}
          </Tabs.Trigger>
          <Tabs.Trigger value="outline" className={tabCls}>
            {t('side.outline', 'Outline')}
          </Tabs.Trigger>
          <Tabs.Trigger value="layers" className={tabCls}>
            {t('side.layers', 'Layers')}
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="library" className="min-h-0 flex-1 outline-none">
          <LibraryBody />
        </Tabs.Content>
        <Tabs.Content value="outline" className="min-h-0 flex-1 pt-2 outline-none">
          <OutlinePanel />
        </Tabs.Content>
        <Tabs.Content value="layers" className="min-h-0 flex-1 pt-2 outline-none">
          <LayersPanel />
        </Tabs.Content>
      </Tabs.Root>
    </aside>
  );
}
