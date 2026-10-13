// SPDX-License-Identifier: Apache-2.0
/** Left sidebar: device library, outline and layers in tabs. */
import * as Tabs from '@radix-ui/react-tabs';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayersPanel } from './LayersPanel.tsx';
import { LibraryBody } from './LibraryPanel.tsx';
import { OutlinePanel } from './OutlinePanel.tsx';
import { presenceProps, useClosing } from '../components/Presence.tsx';

const tabCls =
  'lw-btn relative h-8 flex-1 text-[12px] font-medium text-muted hover:text-ink data-[state=active]:text-ink';
const TABS = ['library', 'outline', 'layers'];

export function SidePanel() {
  const { t } = useTranslation();
  const closing = useClosing();
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
      {...presenceProps(closing)}
      className="lw-no-print lw-panel-left flex h-full w-64 shrink-0 flex-col border-r border-line bg-surface"
    >
      <Tabs.Root value={tab} onValueChange={change} className="flex min-h-0 flex-1 flex-col">
        <Tabs.List
          aria-label={t('side.label', 'Sidebar')}
          className="relative flex shrink-0 border-b border-line px-2"
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
          {/* The active tab's underline glides to the new tab (FR-UX-02). */}
          <span
            aria-hidden="true"
            className="lw-thumb bottom-[-1px] left-2 h-0.5 rounded-full bg-accent"
            style={{
              width: 'calc((100% - 16px) / 3)',
              transform: `translateX(${Math.max(0, TABS.indexOf(tab)) * 100}%)`,
            }}
          />
        </Tabs.List>
        <Tabs.Content value="library" className="min-h-0 flex-1 focus-visible:outline-offset-[-2px]">
          <LibraryBody />
        </Tabs.Content>
        <Tabs.Content value="outline" className="min-h-0 flex-1 pt-2 focus-visible:outline-offset-[-2px]">
          <OutlinePanel />
        </Tabs.Content>
        <Tabs.Content value="layers" className="min-h-0 flex-1 pt-2 focus-visible:outline-offset-[-2px]">
          <LayersPanel />
        </Tabs.Content>
      </Tabs.Root>
    </aside>
  );
}
