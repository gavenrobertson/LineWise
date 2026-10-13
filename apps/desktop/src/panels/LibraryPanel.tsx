// SPDX-License-Identifier: Apache-2.0
/**
 * Device library (FR-TPL-05): search by name/model/role/vendor, favorites,
 * recently used, collapsible categories, drag to canvas. Keyboard users press
 * Enter on an item to place it at the center of the view (NFR-A11Y-01).
 */
import { addDevice, type DeviceTemplate } from '@linewise/core';
import { ROLE_CATEGORY, searchTemplates, TEMPLATES, type RoleCategory } from '@linewise/device-library';
import { ChevronRight, Pencil, Plus, Search, Star } from 'lucide-react';
import { useMemo, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { canvasApi, TEMPLATE_MIME } from '../canvas/Canvas.tsx';
import { DeviceIcon } from '../canvas/nodes.tsx';
import { clickRowPrimary, cx, EmptyState, HoverCard, IconButton } from '../components/ui.tsx';
import { useEditor } from '../store/editor.ts';
import { usePrefs } from '../store/prefs.ts';
import { useUi } from '../store/ui.ts';
import { roleLabel } from '../lib/labels.ts';
import { categoryLabel } from '../lib/labels.ts';

const CATEGORY_ORDER: RoleCategory[] = [
  'Routing & switching',
  'Security',
  'Wireless',
  'Compute & storage',
  'Endpoints',
  'Clouds & WAN',
  'Other',
];

/** Focus a canvas node once React Flow has rendered it. */
export function focusNode(id: string, tries = 30, from: Element | null = document.activeElement): void {
  // The user moved on (clicked into a field, say) while the node was still appearing: leave focus
  // there, or the next key (Delete, Backspace) would act on the canvas instead.
  if (document.activeElement !== from) return;
  const el = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
  // React Flow keeps new nodes hidden until measured; focus only sticks once visible.
  el?.focus({ preventScroll: true });
  if (document.activeElement !== el && tries > 0) requestAnimationFrame(() => focusNode(id, tries - 1, from));
}

export function placeTemplate(tpl: DeviceTemplate): void {
  const ed = useEditor.getState();
  if (ed.readOnly) return;
  usePrefs.getState().noteTemplateUse(tpl.id);
  const c = canvasApi.viewportCenter();
  // Nudge so repeated inserts don't stack exactly.
  const n = ed.doc.devices.length % 5;
  const cmd = addDevice({
    role: tpl.role,
    pageId: ed.pageId,
    position: { x: Math.round(c.x + n * 24), y: Math.round(c.y + n * 24) },
    template: tpl,
  });
  if (ed.execute(cmd)) {
    ed.setSelection({ devices: [cmd.deviceId] });
    // Keyboard users continue on the canvas: arrows nudge, L links, Enter renames.
    focusNode(cmd.deviceId);
  }
}

function Item({
  tpl,
  favorite,
  iconStyle,
}: {
  tpl: DeviceTemplate;
  favorite: boolean;
  iconStyle: 'classic' | 'line';
}) {
  const { t } = useTranslation();
  const toggleFavorite = usePrefs((s) => s.toggleFavorite);
  const custom = !TEMPLATES.some((x) => x.id === tpl.id);
  const onDragStart = (e: DragEvent) => {
    e.dataTransfer.setData(TEMPLATE_MIME, tpl.id);
    e.dataTransfer.effectAllowed = 'copy';
  };
  const portCount = tpl.interfaces.length;
  const subtitle = [
    tpl.generic ? roleLabel(tpl.role) : `${tpl.vendor} · ${tpl.model}`,
    portCount > 0 ? t('library.portGroups', '{{n}} port groups', { n: portCount }) : '',
    custom ? t('library.custom', 'custom') : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <li
      className="lw-row group flex cursor-pointer items-center gap-1 rounded-lg pr-1 hover:bg-surface-3"
      onClick={clickRowPrimary}
    >
      <HoverCard
        side="right"
        delay={600}
        content={
          <div className="flex flex-col gap-1">
            <span className="font-semibold">{tpl.name}</span>
            {subtitle && <span className="text-muted">{subtitle}</span>}
            {tpl.sourceUrl && (
              <span className="break-all font-mono text-[11px] text-muted">{tpl.sourceUrl}</span>
            )}
            <span className="mt-0.5 text-[11.5px] text-muted">
              {t('library.dragHint', 'Drag onto the canvas, or press Enter to place it.')}
            </span>
          </div>
        }
      >
        <button
          type="button"
          draggable
          data-lw-library-item=""
          data-lw-row-primary=""
          onDragStart={onDragStart}
          onClick={() => placeTemplate(tpl)}
          className="lw-btn relative flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1 text-left"
        >
          <span className="shrink-0">
            <DeviceIcon role={tpl.role} style={iconStyle} size={28} />
          </span>
          <span className="min-w-0">
            {/* The name comes from the visible text, read as "Place <name> <subtitle>" (WCAG 2.5.3). */}
            <span className="block truncate text-[12.5px] font-medium text-ink">
              <span className="sr-only">{t('library.placePrefix', 'Place')} </span>
              {tpl.name}
            </span>
            <span className="block truncate text-[11px] text-subtle">{subtitle}</span>
          </span>
        </button>
      </HoverCard>
      {custom && (
        <IconButton
          label={t('library.edit', 'Edit template')}
          className="h-6 min-w-6 opacity-0 group-hover:opacity-100 focus:opacity-100"
          onClick={() => useUi.getState().open({ kind: 'templateEditor', templateId: tpl.id })}
        >
          <Pencil size={13} />
        </IconButton>
      )}
      <IconButton
        label={
          favorite
            ? t('library.unfavorite', 'Remove from favorites')
            : t('library.favorite', 'Add to favorites')
        }
        active={favorite}
        className={cx('h-6 min-w-6', !favorite && 'opacity-0 group-hover:opacity-100 focus:opacity-100')}
        onClick={() => toggleFavorite(tpl.id)}
      >
        <Star size={13} fill={favorite ? 'currentColor' : 'none'} />
      </IconButton>
    </li>
  );
}

function Section({
  title,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mb-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1 rounded px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-subtle hover:text-ink"
      >
        <ChevronRight size={12} className={cx('transition-transform', open && 'rotate-90')} />
        {title}
        <span className="ml-auto font-normal normal-case tracking-normal">{count}</span>
      </button>
      {open && <ul className="flex flex-col">{children}</ul>}
    </section>
  );
}

export function LibraryBody() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const custom = usePrefs((s) => s.customTemplates);
  const favorites = usePrefs((s) => s.favorites);
  const recent = usePrefs((s) => s.recentTemplates);
  const iconStyle = useEditor((s) => s.doc.settings.iconStyle);
  const all = useMemo(() => [...custom, ...TEMPLATES], [custom]);
  const results = useMemo(() => searchTemplates(all, { text: query }), [all, query]);
  const byId = useMemo(() => new Map(all.map((x) => [x.id, x])), [all]);
  const fav = new Set(favorites);
  const grouped = useMemo(() => {
    const m = new Map<RoleCategory, DeviceTemplate[]>();
    for (const tpl of results) {
      const c = ROLE_CATEGORY[tpl.role];
      m.set(c, [...(m.get(c) ?? []), tpl]);
    }
    for (const list of m.values())
      list.sort((a, b) => Number(b.generic) - Number(a.generic) || a.name.localeCompare(b.name));
    return m;
  }, [results]);
  const favList = favorites.map((id) => byId.get(id)).filter((x): x is DeviceTemplate => !!x);
  const recentList = recent
    .map((id) => byId.get(id))
    .filter((x): x is DeviceTemplate => !!x)
    .slice(0, 5);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 pb-1 pt-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-subtle">
          {t('library.title', 'Device library')}
        </h2>
        <IconButton
          label={t('library.newTemplate', 'New device template…')}
          onClick={() => useUi.getState().open({ kind: 'templateEditor' })}
        >
          <Plus size={15} />
        </IconButton>
      </div>
      <div className="relative px-3 pb-2">
        <Search size={14} className="pointer-events-none absolute left-5 top-2 text-subtle" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('library.search', 'Search name, model, role, vendor')}
          id="lw-library-search"
          onKeyDown={(e) => {
            // Enter places the best match; ArrowDown moves into the list (FR-KEY-02).
            if (e.key === 'Enter' && results[0]) {
              e.preventDefault();
              placeTemplate(results[0]);
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              document.querySelector<HTMLElement>('[data-lw-library-item]')?.focus();
            }
          }}
          aria-label={t('library.searchLabel', 'Search device library')}
          className="h-8 w-full rounded-md border border-line bg-surface-2 pl-7 pr-2 text-[12.5px] text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {!query && favList.length > 0 && (
          <Section title={t('library.favorites', 'Favorites')} count={favList.length}>
            {favList.map((tpl) => (
              <Item key={`f-${tpl.id}`} tpl={tpl} favorite iconStyle={iconStyle} />
            ))}
          </Section>
        )}
        {!query && recentList.length > 0 && (
          <Section title={t('library.recent', 'Recently used')} count={recentList.length}>
            {recentList.map((tpl) => (
              <Item key={`r-${tpl.id}`} tpl={tpl} favorite={fav.has(tpl.id)} iconStyle={iconStyle} />
            ))}
          </Section>
        )}
        {CATEGORY_ORDER.filter((c) => grouped.has(c)).map((c) => (
          <Section key={c} title={categoryLabel(c)} count={grouped.get(c)?.length ?? 0}>
            {(grouped.get(c) ?? []).map((tpl) => (
              <Item key={tpl.id} tpl={tpl} favorite={fav.has(tpl.id)} iconStyle={iconStyle} />
            ))}
          </Section>
        ))}
        {results.length === 0 && (
          <EmptyState
            art="search"
            title={t('library.none', 'No devices match “{{q}}”.', { q: query })}
            action={{ label: t('library.clearSearch', 'Clear the search'), onClick: () => setQuery('') }}
          >
            {t('library.noneHint', 'Search by model, role or vendor, such as “switch” or “48”.')}
          </EmptyState>
        )}
      </div>
    </div>
  );
}
