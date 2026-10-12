// SPDX-License-Identifier: Apache-2.0
/** Top toolbar (FR-APP-03): file, history, insert, arrange, network views and panels. */
import * as Menu from '@radix-ui/react-dropdown-menu';
import { alignNodes, distributeNodes, type AlignMode } from '@linewise/core';
import {
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignCenterHorizontal,
  AlignVerticalDistributeCenter,
  ChevronDown,
  Command,
  Download,
  FolderOpen,
  ImagePlus,
  LayoutGrid,
  Moon,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Redo2,
  Route,
  Save,
  SquareDashed,
  StickyNote,
  Sun,
  Type,
  Undo2,
  Upload,
  FilePlus,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BrandMark } from '../components/BrandMark.tsx';
import { cx, IconButton, Keys, Segmented, Tooltip } from '../components/ui.tsx';
import { formatShortcut, runCommand } from '../lib/actions.ts';
import { toggleTheme, useResolvedTheme } from '../lib/theme.ts';
import { useEditor } from '../store/editor.ts';
import { useUi } from '../store/ui.ts';
import type { ViewLayer } from '@linewise/core';

function Sep() {
  return <div className="mx-1 h-5 w-px bg-line" aria-hidden="true" />;
}

function MenuItem({
  children,
  onSelect,
  disabled,
}: {
  children: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <Menu.Item
      disabled={disabled}
      onSelect={onSelect}
      className="lw-row flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-ink outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-accent-soft"
    >
      {children}
    </Menu.Item>
  );
}

export function MenuContent({ children }: { children: ReactNode }) {
  return (
    <Menu.Portal>
      <Menu.Content
        sideOffset={6}
        align="start"
        className="lw-pop lw-material z-50 min-w-48 rounded-lg border border-line p-1 shadow-elev-2"
      >
        {children}
      </Menu.Content>
    </Menu.Portal>
  );
}

function ArrangeMenu() {
  const { t } = useTranslation();
  const sel = useEditor((s) => s.selection);
  const pageId = useEditor((s) => s.pageId);
  const execute = useEditor((s) => s.execute);
  const ids = [...sel.devices, ...sel.zones, ...sel.annotations];
  const align = (m: AlignMode) => execute(alignNodes(pageId, ids, m));
  const items: [AlignMode, string, ReactNode][] = [
    ['left', t('arrange.left', 'Align left'), <AlignStartVertical key="l" size={15} />],
    ['center', t('arrange.center', 'Align centers horizontally'), <AlignCenterVertical key="c" size={15} />],
    ['right', t('arrange.right', 'Align right'), <AlignEndVertical key="r" size={15} />],
    ['top', t('arrange.top', 'Align top'), <AlignStartHorizontal key="t" size={15} />],
    ['middle', t('arrange.middle', 'Align middles vertically'), <AlignCenterHorizontal key="m" size={15} />],
    ['bottom', t('arrange.bottom', 'Align bottom'), <AlignEndHorizontal key="b" size={15} />],
  ];
  return (
    <Menu.Root>
      {/* Icon-only below xl, so it gets a tooltip like every toolbar button (DOC-05). */}
      <Tooltip
        text={t('toolbar.arrange', 'Arrange')}
        description={t('toolbar.arrangeHint', 'Align, distribute or auto-layout the selection')}
      >
        <Menu.Trigger asChild>
          <button
            type="button"
            className="lw-btn inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[13px] text-ink hover:bg-surface-3 data-[state=open]:bg-surface-3"
            aria-label={t('toolbar.arrange', 'Arrange')}
          >
            <LayoutGrid size={16} />
            <span className="hidden xl:inline">{t('toolbar.arrange', 'Arrange')}</span>
            <ChevronDown size={13} className="text-muted" />
          </button>
        </Menu.Trigger>
      </Tooltip>
      <MenuContent>
        {items.map(([m, label, icon]) => (
          <MenuItem key={m} disabled={ids.length < 2} onSelect={() => align(m)}>
            {icon}
            {label}
          </MenuItem>
        ))}
        <Menu.Separator className="my-1 h-px bg-line" />
        <MenuItem
          disabled={ids.length < 3}
          onSelect={() => execute(distributeNodes(pageId, ids, 'horizontal'))}
        >
          <AlignHorizontalDistributeCenter size={15} />
          {t('arrange.distH', 'Distribute horizontally')}
        </MenuItem>
        <MenuItem
          disabled={ids.length < 3}
          onSelect={() => execute(distributeNodes(pageId, ids, 'vertical'))}
        >
          <AlignVerticalDistributeCenter size={15} />
          {t('arrange.distV', 'Distribute vertically')}
        </MenuItem>
        <Menu.Separator className="my-1 h-px bg-line" />
        <MenuItem onSelect={() => runCommand('arrange.layout')}>
          <LayoutGrid size={15} />
          {t('arrange.layout', 'Auto-layout…')}
        </MenuItem>
      </MenuContent>
    </Menu.Root>
  );
}

function VlanHighlight() {
  const { t } = useTranslation();
  const vlans = useEditor((s) => s.doc.vlans);
  const spec = useEditor((s) => s.highlightSpec);
  const setHighlight = useEditor((s) => s.setHighlight);
  const value = spec?.kind === 'vlan' ? String(spec.vlan) : '';
  return (
    <label className="inline-flex items-center gap-1 text-xs text-muted">
      <span className="sr-only">{t('toolbar.vlanHighlight', 'Highlight VLAN')}</span>
      <Tooltip
        text={t('toolbar.vlanHighlight', 'Highlight VLAN')}
        description={t('toolbar.vlanHint', 'Dims everything that does not carry the VLAN')}
      >
        <select
          className="lw-btn h-8 rounded-md border border-line bg-surface px-1.5 text-xs text-ink hover:border-line-strong"
          value={value}
          onChange={(e) =>
            setHighlight(e.target.value ? { kind: 'vlan', vlan: Number(e.target.value) } : null)
          }
        >
          <option value="">{t('toolbar.noVlan', 'VLAN: none')}</option>
          {[...vlans]
            .sort((a, b) => a.number - b.number)
            .map((v) => (
              <option key={v.id} value={v.number}>
                VLAN {v.number}
                {v.name ? ` · ${v.name}` : ''}
              </option>
            ))}
        </select>
      </Tooltip>
    </label>
  );
}

export function Toolbar() {
  const { t } = useTranslation();
  const canUndo = useEditor((s) => s.canUndo);
  const canRedo = useEditor((s) => s.canRedo);
  const undoLabel = useEditor((s) => s.undoLabel);
  const redoLabel = useEditor((s) => s.redoLabel);
  const layer = useEditor((s) => s.layer);
  const setLayer = useEditor((s) => s.setLayer);
  const highlight = useEditor((s) => s.highlightSpec);
  const setHighlight = useEditor((s) => s.setHighlight);
  const readOnly = useEditor((s) => s.readOnly);
  const ui = useUi();
  const sc = formatShortcut;
  return (
    <div
      role="toolbar"
      aria-label={t('toolbar.label', 'Main toolbar')}
      className="lw-no-print flex h-11 shrink-0 items-center gap-0.5 border-b border-line bg-surface px-2"
    >
      <div className="mr-2 flex items-center gap-2 pl-1">
        <BrandMark size={22} />
      </div>
      <IconButton
        label={t('cmd.new', 'New diagram')}
        shortcut={sc('mod+N')}
        onClick={() => runCommand('file.new')}
      >
        <FilePlus size={16} />
      </IconButton>
      <IconButton
        label={t('cmd.open', 'Open…')}
        shortcut={sc('mod+O')}
        onClick={() => runCommand('file.open')}
      >
        <FolderOpen size={16} />
      </IconButton>
      <IconButton
        label={t('cmd.save', 'Save')}
        shortcut={sc('mod+S')}
        onClick={() => runCommand('file.save')}
      >
        <Save size={16} />
      </IconButton>
      <Sep />
      <IconButton
        label={undoLabel ? t('toolbar.undoX', 'Undo {{x}}', { x: undoLabel }) : t('cmd.undo', 'Undo')}
        shortcut={sc('mod+Z')}
        disabled={!canUndo}
        onClick={() => runCommand('edit.undo')}
      >
        <Undo2 size={16} />
      </IconButton>
      <IconButton
        label={redoLabel ? t('toolbar.redoX', 'Redo {{x}}', { x: redoLabel }) : t('cmd.redo', 'Redo')}
        shortcut={sc('mod+shift+Z')}
        disabled={!canRedo}
        onClick={() => runCommand('edit.redo')}
      >
        <Redo2 size={16} />
      </IconButton>
      <Sep />
      <IconButton
        label={t('cmd.zone', 'Insert zone')}
        description={t(
          'toolbar.zoneHint',
          'A labeled area, such as a site or a DMZ; devices inside move with it',
        )}
        disabled={readOnly}
        onClick={() => runCommand('insert.zone')}
      >
        <SquareDashed size={16} />
      </IconButton>
      <IconButton
        label={t('cmd.text', 'Insert text')}
        disabled={readOnly}
        onClick={() => runCommand('insert.text')}
      >
        <Type size={16} />
      </IconButton>
      <IconButton
        label={t('cmd.note', 'Insert sticky note')}
        disabled={readOnly}
        onClick={() => runCommand('insert.note')}
      >
        <StickyNote size={16} />
      </IconButton>
      <IconButton
        label={t('cmd.image', 'Insert image…')}
        disabled={readOnly}
        onClick={() => runCommand('insert.image')}
      >
        <ImagePlus size={16} />
      </IconButton>
      <ArrangeMenu />
      <Sep />
      <Segmented<ViewLayer>
        label={t('toolbar.layer', 'Network view')}
        value={layer}
        onChange={setLayer}
        options={[
          { value: 'l1', label: 'L1', title: t('cmd.l1', 'Physical view (L1)'), shortcut: sc('mod+1') },
          { value: 'l2', label: 'L2', title: t('cmd.l2', 'Data link view (L2)'), shortcut: sc('mod+2') },
          { value: 'l3', label: 'L3', title: t('cmd.l3', 'Network view (L3)'), shortcut: sc('mod+3') },
        ]}
      />
      <div className="ml-1 hidden lg:block">
        <VlanHighlight />
      </div>
      <IconButton
        label={
          highlight?.kind === 'path'
            ? t('toolbar.clearPath', 'Clear path highlight')
            : t('toolbar.path', 'Highlight path between two devices')
        }
        description={
          highlight?.kind === 'path'
            ? undefined
            : t('toolbar.pathHint', 'Click two devices to light up every link between them')
        }
        active={ui.pathStart !== null || highlight?.kind === 'path'}
        onClick={() => {
          if (highlight?.kind === 'path') setHighlight(null);
          else ui.set({ pathStart: ui.pathStart === null ? '' : null });
        }}
      >
        <Route size={16} />
      </IconButton>
      <div className="flex-1" />
      <IconButton
        label={t('cmd.import', 'Import…')}
        shortcut={sc('mod+I')}
        disabled={readOnly}
        onClick={() => runCommand('file.import')}
      >
        <Upload size={16} />
      </IconButton>
      <IconButton
        label={t('cmd.export', 'Export…')}
        shortcut={sc('mod+E')}
        onClick={() => runCommand('file.export')}
      >
        <Download size={16} />
      </IconButton>
      <Sep />
      <Tooltip
        text={t('cmd.palette', 'Command palette')}
        description={t('toolbar.paletteHint', 'Run any menu command, or find a device by hostname or IP')}
      >
        <button
          type="button"
          onClick={() => ui.setPalette(true)}
          className="lw-btn mr-1 hidden h-8 items-center gap-2 rounded-lg border border-line bg-surface-2 px-2 text-xs text-muted hover:border-line-strong hover:text-ink md:inline-flex"
        >
          <Command size={13} />
          <span>{t('toolbar.search', 'Search or run a command')}</span>
          <Keys shortcut={sc('mod+K')} />
        </button>
      </Tooltip>
      <ThemeButton />
      <IconButton
        label={t('toolbar.library', 'Toggle library')}
        active={ui.libraryOpen}
        onClick={() => ui.toggle('libraryOpen')}
      >
        <PanelLeft size={16} />
      </IconButton>
      <IconButton
        label={t('toolbar.problems', 'Toggle problems panel')}
        shortcut={sc('mod+shift+M')}
        active={ui.problemsOpen}
        onClick={() => ui.toggle('problemsOpen')}
      >
        <PanelBottom size={16} />
      </IconButton>
      <IconButton
        label={t('toolbar.inspector', 'Toggle inspector')}
        active={ui.inspectorOpen}
        onClick={() => ui.toggle('inspectorOpen')}
      >
        <PanelRight size={16} className={cx()} />
      </IconButton>
    </div>
  );
}

/** Light / dark switch (FR-APP-04). The icon shows the mode it switches to, and turns as it swaps. */
function ThemeButton() {
  const { t } = useTranslation();
  const dark = useResolvedTheme() === 'dark';
  return (
    <IconButton
      label={
        dark ? t('toolbar.lightMode', 'Switch to light mode') : t('toolbar.darkMode', 'Switch to dark mode')
      }
      data-lw-theme-toggle=""
      onClick={toggleTheme}
    >
      <span key={dark ? 'sun' : 'moon'} className="lw-theme-icon inline-flex">
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </span>
    </IconButton>
  );
}
