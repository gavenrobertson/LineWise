// SPDX-License-Identifier: Apache-2.0
/**
 * Canvas hover cards. One card for the whole canvas, so 500 devices do not each carry a tooltip:
 *  - device (FR-NET-09, FR-UX-09): hostname, role, model, management IP, site, interfaces used,
 *    problems;
 *  - link (FR-UX-07): both ends, the medium, speed and duplex, the mode and VLANs, the addresses
 *    and any problems with their fix.
 * Hover opens it after the hover-card delay, keyboard focus opens it too. It reads the model the
 * canvas already built; nothing on the canvas re-renders when it opens.
 */
import { applyFix, deviceSummary, type Interface, type Issue } from '@linewise/core';
import { ArrowLeftRight, CircleAlert, Info, TriangleAlert, Wand2 } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { create } from 'zustand';
import { cx } from '../components/ui.tsx';
import { mediumLabel, roleLabel } from '../lib/labels.ts';
import { useEditor } from '../store/editor.ts';
import { fmtBandwidth, type DeviceView, type LinkView } from './model.ts';

interface HoverState {
  kind: 'link' | 'device';
  id: string | null;
  /** Where the card points, in window coordinates. */
  x: number;
  y: number;
  open: boolean;
  show: (id: string, x: number, y: number, delay: number, kind?: 'link' | 'device') => void;
  hide: () => void;
  /** Hide after a moment, so the pointer can move from the link onto the card. */
  hideSoon: () => void;
  /** Keep it open (the pointer reached the card). */
  keep: () => void;
}

let timer: ReturnType<typeof setTimeout> | null = null;

export const useCanvasHover = create<HoverState>((set, get) => ({
  kind: 'link',
  id: null,
  x: 0,
  y: 0,
  open: false,
  show: (id, x, y, delay, kind = 'link') => {
    if (timer) clearTimeout(timer);
    if (get().open && get().id === id) return;
    set({ kind, id, x, y, open: false });
    timer = setTimeout(() => set({ open: true }), delay);
  },
  hide: () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (get().id !== null) set({ id: null, open: false });
  },
  hideSoon: () => {
    if (timer) clearTimeout(timer);
    if (!get().open) return get().hide();
    timer = setTimeout(() => get().hide(), 220);
  },
  keep: () => {
    if (timer) clearTimeout(timer);
    timer = null;
  },
}));

const SEV_ICON = {
  error: <CircleAlert size={13} className="shrink-0 text-danger" aria-hidden="true" />,
  warning: <TriangleAlert size={13} className="shrink-0 text-warning" aria-hidden="true" />,
  info: <Info size={13} className="shrink-0 text-info" aria-hidden="true" />,
};

function End({ host, port, align }: { host: string; port: string; align: 'start' | 'end' }) {
  return (
    <div className={cx('min-w-0 flex-1', align === 'end' && 'text-right')}>
      <div className="truncate font-semibold text-ink">{host}</div>
      <div className="truncate font-mono text-[11px] text-muted">{port}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-muted">{label}</dt>
      <dd className="m-0 min-w-0 break-words text-ink">{children}</dd>
    </div>
  );
}

export function CanvasHoverCard({ links, devices }: { links: LinkView[]; devices: DeviceView[] }) {
  const { t } = useTranslation();
  const { kind, id, x, y, open } = useCanvasHover();
  const issues = useEditor((s) => s.issues);
  const execute = useEditor((s) => s.execute);
  const readOnly = useEditor((s) => s.readOnly);
  // Any scroll or press elsewhere closes it, like a tooltip.
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e.target instanceof Element && e.target.closest('[data-lw-linkcard]')) return;
      useCanvasHover.getState().hide();
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && useCanvasHover.getState().hide();
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('wheel', close, { capture: true, passive: true });
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', close, true);
      window.removeEventListener('wheel', close, true);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);
  if (!open || !id) return null;
  if (kind === 'device') {
    const dv = devices.find((d) => d.device.id === id);
    return dv ? (
      <Card x={x} y={y}>
        <DeviceBody view={dv} issues={issues} />
      </Card>
    ) : null;
  }
  const view = links.find((l) => l.link.id === id);
  if (!view) return null;
  const { a, b, link } = view;
  const ids = new Set([link.id, a.iface.id, b.iface.id]);
  const problems: Issue[] = issues.filter((i) => i.objectIds.some((o) => ids.has(o)));

  const speed = (i: Interface) => (i.speedMbps ? fmtBandwidth(i.speedMbps) : t('linkCard.auto', 'auto'));
  const duplex = (i: Interface) => (i.duplex === 'auto' ? t('linkCard.auto', 'auto') : i.duplex);
  const mode = (i: Interface) => {
    switch (i.mode) {
      case 'access':
        return t('linkCard.access', 'access, VLAN {{v}}', { v: i.accessVlan ?? 1 });
      case 'trunk':
        return t('linkCard.trunk', 'trunk, VLANs {{list}}, native {{native}}', {
          list: i.allowedVlans || t('linkCard.all', 'all'),
          native: i.nativeVlan ?? 1,
        });
      case 'routed':
        return t('linkCard.routed', 'routed');
      default:
        return t('linkCard.unset', 'not set');
    }
  };
  const ip = (i: Interface) =>
    [...i.ipv4, ...i.ipv6].map((p) => `${p.address}/${p.prefix}`).join(', ') || t('linkCard.none', 'none');
  const both = (f: (i: Interface) => string) => {
    const fa = f(a.iface);
    const fb = f(b.iface);
    return fa === fb ? fa : `${fa} ↔ ${fb}`;
  };

  return (
    <Card x={x} y={y}>
      <div className="flex items-center gap-2">
        <End host={a.device.hostname} port={a.iface.name} align="start" />
        <ArrowLeftRight size={14} className="shrink-0 text-subtle" aria-label={t('linkCard.to', 'to')} />
        <End host={b.device.hostname} port={b.iface.name} align="end" />
      </div>
      {link.label && <p className="mt-1.5 font-medium text-ink">{link.label}</p>}
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 border-t border-line pt-2">
        <Row label={t('linkCard.medium', 'Medium')}>{mediumLabel(link.medium)}</Row>
        <Row label={t('linkCard.speed', 'Speed')}>
          {link.bandwidthMbps ? fmtBandwidth(link.bandwidthMbps) : both(speed)} · {both(duplex)}
        </Row>
        <Row label={t('linkCard.mode', 'Mode')}>{both(mode)}</Row>
        <Row label={t('linkCard.addresses', 'Addresses')}>{both(ip)}</Row>
      </dl>
      {problems.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5 border-t border-line pt-2">
          {problems.slice(0, 4).map((p, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className="mt-0.5">{SEV_ICON[p.severity]}</span>
              <span className="min-w-0 flex-1">
                <span className="text-ink">{p.message}</span>
                {!readOnly && p.fixes[0] && (
                  <button
                    type="button"
                    className="lw-btn ml-1 inline-flex items-center gap-1 rounded-md px-1 font-medium text-accent-ink hover:bg-accent-soft"
                    onClick={() => {
                      execute(applyFix(p.fixes[0]!));
                      useCanvasHover.getState().hide();
                    }}
                  >
                    <Wand2 size={11} aria-hidden="true" />
                    {p.fixes[0].label}
                  </button>
                )}
              </span>
            </li>
          ))}
          {problems.length > 4 && (
            <li className="text-muted">
              {t('linkCard.more', '{{n}} more in the Problems panel', { n: problems.length - 4 })}
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}

/** The card frame: above the pointer, flipped below near the top of the window, kept inside it. */
function Card({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  const W = 300;
  const left = Math.max(8, Math.min(x - W / 2, window.innerWidth - W - 8));
  const below = y < 260;
  return (
    <div
      data-lw-linkcard=""
      role="tooltip"
      id="lw-canvas-card"
      data-state="delayed-open"
      onMouseEnter={() => useCanvasHover.getState().keep()}
      onMouseLeave={() => useCanvasHover.getState().hide()}
      className="lw-pop lw-material lw-no-print fixed z-[80] rounded-lg border border-line px-3 py-2.5 text-[12px] leading-snug shadow-elev-2"
      style={{
        width: W,
        left,
        top: below ? y + 16 : undefined,
        bottom: below ? undefined : window.innerHeight - y + 12,
        transformOrigin: below ? 'top center' : 'bottom center',
      }}
    >
      {children}
    </div>
  );
}

/** The device card (FR-NET-09): hostname, role, model, management IP, site, interfaces used. */
function DeviceBody({ view, issues }: { view: DeviceView; issues: Issue[] }) {
  const { t } = useTranslation();
  const doc = useEditor((s) => s.doc);
  const d = view.device;
  const s = deviceSummary(doc, d);
  const ids = new Set([d.id, ...d.interfaces.map((i) => i.id)]);
  const problems = issues.filter((i) => i.objectIds.some((o) => ids.has(o)));
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[13px] font-semibold text-ink">{d.hostname}</span>
        <span className="shrink-0 text-muted">{roleLabel(d.role)}</span>
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 border-t border-line pt-2">
        {s.model && <Row label={t('deviceCard.model', 'Model')}>{s.model}</Row>}
        {s.mgmtIp && (
          <Row label={t('deviceCard.mgmt', 'Management IP')}>
            <span className="font-mono">{s.mgmtIp}</span>
          </Row>
        )}
        {d.site && <Row label={t('deviceCard.site', 'Site')}>{d.site}</Row>}
        <Row label={t('deviceCard.interfaces', 'Interfaces')}>
          {t('deviceCard.used', '{{used}} of {{n}} in use', { used: s.usedCount, n: s.interfaceCount })}
        </Row>
      </dl>
      {problems.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 border-t border-line pt-2">
          {problems.slice(0, 3).map((p, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className="mt-0.5">{SEV_ICON[p.severity]}</span>
              <span className="text-ink">{p.message}</span>
            </li>
          ))}
          {problems.length > 3 && (
            <li className="text-muted">
              {t('linkCard.more', '{{n}} more in the Problems panel', { n: problems.length - 3 })}
            </li>
          )}
        </ul>
      )}
    </>
  );
}
