// SPDX-License-Identifier: Apache-2.0
/**
 * Topology outline (NFR-A11Y-02): a tree of zones → devices → interfaces → link peers that
 * mirrors the canvas for screen-reader and keyboard users (NFR-A11Y-01). Arrow keys move through
 * it (WAI-ARIA tree pattern); Enter selects and reveals the device, or the link for a link peer,
 * whose style and bend points the inspector then edits. Devices on other pages are listed below, where a connector can be added.
 */
import { addOffPageRef, removeOffPageRef } from '@linewise/core';
import { ChevronRight } from 'lucide-react';
import { useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { canvasApi } from '../canvas/Canvas.tsx';
import { DeviceIcon } from '../canvas/nodes.tsx';
import { cx, EmptyState, Tooltip } from '../components/ui.tsx';
import { selectPage, useEditor } from '../store/editor.ts';
import { roleLabel } from '../lib/labels.ts';
import { buildOutline, visibleNodes, type OutlineNode } from './outlineTree.ts';

export function OutlinePanel() {
  const { t } = useTranslation();
  const doc = useEditor((s) => s.doc);
  const page = useEditor(selectPage);
  const sel = useEditor((s) => s.selection);
  const setSelection = useEditor((s) => s.setSelection);
  const execute = useEditor((s) => s.execute);
  const readOnly = useEditor((s) => s.readOnly);
  const [q, setQ] = useState('');
  const roots = useMemo(
    () =>
      page
        ? buildOutline(doc, page, q, {
            noZone: t('outline.noZone', 'Not in a zone'),
            role: (d) => roleLabel(d.role),
            connectedTo: (host, port) => t('outline.peer', 'Connected to {{host}} {{port}}', { host, port }),
            access: (vlan) => t('outline.access', 'access VLAN {{vlan}}', { vlan }),
            trunk: (vlans) => t('outline.trunk', 'trunk {{vlans}}', { vlans }),
          })
        : [],
    [doc, page, q, t],
  );
  // Zones start open, devices closed; a filter opens everything it matched.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const isOpen = (n: OutlineNode) =>
    toggled[n.key] ?? (n.kind === 'zone' || (!!q.trim() && n.kind !== 'interface'));
  const expanded = useMemo(() => {
    const set = new Set<string>();
    const walk = (ns: OutlineNode[]) => {
      for (const n of ns) {
        if (isOpen(n)) set.add(n.key);
        walk(n.children);
      }
    };
    walk(roots);
    return set;
    // isOpen reads toggled and q.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roots, toggled, q]);
  const visible = useMemo(() => visibleNodes(roots, expanded), [roots, expanded]);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const current = visible.find((v) => v.node.key === focusKey)?.node.key ?? visible[0]?.node.key ?? null;

  const focusItem = (key: string | undefined) => {
    if (!key) return;
    setFocusKey(key);
    requestAnimationFrame(() =>
      document.getElementById(`lw-outline-${key}`)?.focus({ preventScroll: false }),
    );
  };
  const activate = (n: OutlineNode, e?: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }) => {
    if (!n.deviceId) return;
    const add = !!e && (e.metaKey || e.ctrlKey || e.shiftKey) && n.kind === 'device';
    const selected = sel.devices.includes(n.deviceId);
    setSelection(
      n.kind === 'peer' && n.linkId
        ? { links: [n.linkId] }
        : {
            devices: add
              ? selected
                ? sel.devices.filter((x) => x !== n.deviceId)
                : [...sel.devices, n.deviceId]
              : [n.deviceId],
          },
    );
    canvasApi.focusOn([n.deviceId]);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const i = visible.findIndex((v) => v.node.key === current);
    const here = visible[i];
    if (!here) return;
    const n = here.node;
    const open = expanded.has(n.key);
    const handled = (() => {
      switch (e.key) {
        case 'ArrowDown':
          return (focusItem(visible[i + 1]?.node.key), true);
        case 'ArrowUp':
          return (focusItem(visible[i - 1]?.node.key), true);
        case 'Home':
          return (focusItem(visible[0]?.node.key), true);
        case 'End':
          return (focusItem(visible.at(-1)?.node.key), true);
        case 'ArrowRight':
          if (!n.children.length) return true;
          if (!open) setToggled((s) => ({ ...s, [n.key]: true }));
          else focusItem(n.children[0]?.key);
          return true;
        case 'ArrowLeft':
          if (n.children.length && open) setToggled((s) => ({ ...s, [n.key]: false }));
          else if (here.parent) focusItem(here.parent);
          return true;
        case 'Enter':
        case ' ':
          activate(n);
          return true;
        default:
          return false;
      }
    })();
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const renderNode = (n: OutlineNode, level: number) => {
    const open = expanded.has(n.key);
    const selected =
      (n.kind === 'device' && !!n.deviceId && sel.devices.includes(n.deviceId)) ||
      (n.kind === 'peer' && !!n.linkId && sel.links.includes(n.linkId));
    const device = n.kind === 'device' ? doc.devices.find((d) => d.id === n.deviceId) : undefined;
    const hasGroup = n.children.length > 0 && open;
    // The item holds only its own row and owns its child group, which follows it in the DOM: its
    // name (label and detail) then covers all of its visible text (WCAG 2.5.3).
    return [
      <li
        key={n.key}
        id={`lw-outline-${n.key}`}
        role="treeitem"
        aria-level={level}
        aria-expanded={n.children.length ? open : undefined}
        aria-selected={n.kind === 'device' || n.kind === 'peer' ? selected : undefined}
        aria-labelledby={`lw-outline-${n.key}-name${n.detail ? ` lw-outline-${n.key}-detail` : ''}`}
        aria-owns={hasGroup ? `lw-outline-${n.key}-group` : undefined}
        tabIndex={n.key === current ? 0 : -1}
        onFocus={(e) => e.target === e.currentTarget && setFocusKey(n.key)}
        onClick={(e: MouseEvent) => {
          e.stopPropagation();
          // WebKit on macOS does not focus on click; focus explicitly so shortcuts (L to link)
          // act on this selection.
          (e.currentTarget as HTMLElement).focus();
          setFocusKey(n.key);
          if (n.kind === 'zone' || (n.kind === 'interface' && n.children.length))
            setToggled((s) => ({ ...s, [n.key]: !open }));
          activate(n, e);
        }}
        className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
      >
        <div
          className={cx(
            'flex items-center gap-1.5 rounded-md py-1 pr-1.5',
            selected ? 'bg-accent-soft' : 'hover:bg-surface-3',
          )}
          style={{ paddingLeft: 4 + (level - 1) * 12 }}
        >
          {/* An icon, not a ▸ character: text would become part of the item's visible text. */}
          <span className="flex w-3 shrink-0 justify-center text-subtle">
            {n.children.length > 0 && (
              <ChevronRight
                size={11}
                aria-hidden="true"
                className={cx('transition-transform', open && 'rotate-90')}
              />
            )}
          </span>
          {device && <DeviceIcon role={device.role} style={doc.settings.iconStyle} size={18} />}
          <span className="min-w-0 flex-1">
            <span
              id={`lw-outline-${n.key}-name`}
              className={cx(
                'block truncate text-[12.5px] text-ink',
                n.kind === 'zone' && 'text-[11px] font-semibold uppercase tracking-wide text-subtle',
                n.kind === 'device' && 'font-medium',
                n.kind === 'interface' && 'font-mono text-[11.5px]',
              )}
            >
              {n.label}
              {n.kind === 'zone' && (
                <span className="font-normal normal-case">
                  {' '}
                  {t('outline.count', '({{n}})', { n: n.children.length })}
                </span>
              )}
            </span>
            {/* A space between name and detail, so the visible text reads as the name does. */}
            {n.detail && ' '}
            {n.detail && (
              <span id={`lw-outline-${n.key}-detail`} className="block truncate text-[11px] text-subtle">
                {n.detail}
              </span>
            )}
          </span>
        </div>
      </li>,
      hasGroup && (
        <li key={`${n.key}-group`} role="none">
          <ul role="group" id={`lw-outline-${n.key}-group`}>
            {n.children.flatMap((c) => renderNode(c, level + 1))}
          </ul>
        </li>
      ),
    ];
  };

  const elsewhere = useMemo(() => {
    if (!page) return [];
    const query = q.trim().toLowerCase();
    return doc.devices
      .filter((d) => !page.nodePositions[d.id] && (!query || d.hostname.toLowerCase().includes(query)))
      .map((d) => ({
        d,
        home: doc.pages.find((p) => p.nodePositions[d.id]),
        ref: page.offPageRefs.some((r) => r.deviceId === d.id),
      }))
      .filter((x) => x.home)
      .sort((a, b) => a.d.hostname.localeCompare(b.d.hostname, undefined, { numeric: true }));
  }, [doc, page, q]);
  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pb-2 pt-1">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('outline.search', 'Filter by hostname or IP')}
          aria-label={t('outline.search', 'Filter by hostname or IP')}
          className="h-8 w-full rounded-md border border-line bg-surface-2 px-2 text-[12.5px]"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {roots.length === 0 && (
          <EmptyState
            art="network"
            title={t('outline.empty', 'No devices on this page.')}
            action={{
              label: t('outline.openLibrary', 'Open the library'),
              onClick: () => window.dispatchEvent(new Event('linewise:library')),
            }}
          >
            {t(
              'outline.emptyHint',
              'The outline lists every zone, device, interface and link as you add them.',
            )}
          </EmptyState>
        )}
        {roots.length > 0 && (
          <ul
            role="tree"
            aria-label={t('outline.tree', 'Topology')}
            aria-multiselectable="true"
            data-lw-selection-proxy=""
            onKeyDown={onKeyDown}
          >
            {roots.flatMap((n) => renderNode(n, 1))}
          </ul>
        )}
        {elsewhere.length > 0 && (
          <section className="mb-2">
            <h3 className="px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-subtle">
              {t('outline.otherPages', 'On other pages')}
            </h3>
            <ul>
              {elsewhere.map(({ d, home, ref }) => (
                <li key={d.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-surface-3">
                  <DeviceIcon role={d.role} style={doc.settings.iconStyle} size={18} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] text-ink">{d.hostname}</span>
                    <span className="block truncate text-[11px] text-subtle">{home?.name}</span>
                  </span>
                  {!readOnly && (
                    <Tooltip
                      text={t('outline.refHint', 'Show a connector to this device on the current page')}
                    >
                      <button
                        type="button"
                        className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-accent-ink hover:bg-accent-soft"
                        onClick={() => {
                          if (ref) execute(removeOffPageRef(page?.id ?? '', d.id));
                          else {
                            const c = canvasApi.viewportCenter();
                            execute(
                              addOffPageRef(page?.id ?? '', d.id, { x: Math.round(c.x), y: Math.round(c.y) }),
                            );
                          }
                        }}
                      >
                        {ref
                          ? t('outline.removeRef', 'Remove connector')
                          : t('outline.addRef', 'Add connector')}
                      </button>
                    </Tooltip>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
