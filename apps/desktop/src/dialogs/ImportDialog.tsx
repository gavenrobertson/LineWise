// SPDX-License-Identifier: Apache-2.0
/**
 * Import (FR-IMP-20..25): paste text or pick many files, auto-detect each
 * source, review a preview-and-merge plan, untick anything unwanted, then
 * apply as one undo step with an automatic hierarchical layout.
 */
import { addPage, batch, type DeviceRole } from '@linewise/core';
import {
  applyImportPlan,
  buildImportPlan,
  CSV_FIELDS,
  detectKind,
  guessCsvMapping,
  KIND_LABELS,
  MAX_INPUT_BYTES,
  parseCsv,
  parseCsvRows,
  parseText,
  type CsvField,
  type ImportPlan,
  type ParseResult,
  type SourceKind,
} from '@linewise/parsers';
import { ChevronRight, FileUp, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { canvasApi } from '../canvas/Canvas.tsx';
import { pageBounds, buildPageModel } from '../canvas/model.ts';
import { Badge, Button, cx, Dialog, Segmented, TextArea } from '../components/ui.tsx';
import { startLayout } from '../workers/client.ts';
import { platform } from '../platform/index.ts';
import { selectPage, useEditor } from '../store/editor.ts';
import { useUi } from '../store/ui.ts';

interface Source {
  id: number;
  name: string;
  text: string;
  kind: SourceKind | 'auto';
  localHostname: string;
  csvMapping?: CsvField[];
}

/** Kinds whose output names no local device unless a prompt is captured. */
const NEEDS_LOCAL: SourceKind[] = [
  'cdp',
  'lldp',
  'ip-interface-brief',
  'interfaces-status',
  'vlan-brief',
  'etherchannel-summary',
];

let nextId = 1;

function parseSource(s: Source): ParseResult {
  const opts = {
    fileName: s.name,
    ...(s.localHostname.trim() ? { localHostname: s.localHostname.trim() } : {}),
  };
  const kind = s.kind === 'auto' ? detectKind(s.text, s.name) : s.kind;
  if (kind === 'csv')
    return parseCsv(s.text, { ...opts, ...(s.csvMapping ? { mapping: s.csvMapping } : {}) });
  return parseText(s.text, opts, kind ?? undefined);
}

function CsvMapping({ source, onChange }: { source: Source; onChange: (m: CsvField[]) => void }) {
  const { t } = useTranslation();
  const header = useMemo(() => parseCsvRows(source.text)[0] ?? [], [source.text]);
  const mapping = source.csvMapping ?? guessCsvMapping(header);
  return (
    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 rounded-md bg-surface-2 p-2 sm:grid-cols-3">
      {header.map((h, i) => (
        <label key={i} className="flex flex-col text-[11px] text-muted">
          <span className="truncate font-mono">{h || t('import.col', 'Column {{n}}', { n: i + 1 })}</span>
          <select
            className="h-7 rounded border border-line bg-surface px-1 text-[12px] text-ink"
            value={mapping[i] ?? 'ignore'}
            onChange={(e) => {
              const next = [...mapping];
              next[i] = e.target.value as CsvField;
              onChange(next);
            }}
          >
            {CSV_FIELDS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

function SourcesStep({ sources, setSources }: { sources: Source[]; setSources: (s: Source[]) => void }) {
  const { t } = useTranslation();
  const [paste, setPaste] = useState('');
  const [pasteHost, setPasteHost] = useState('');
  const add = (list: { name: string; text: string; localHostname?: string }[]) => {
    const ok: Source[] = [];
    for (const f of list) {
      if (new Blob([f.text]).size > MAX_INPUT_BYTES) {
        useUi
          .getState()
          .toast(t('import.tooBig', '{{n}} is larger than 20 MB and was skipped.', { n: f.name }), 'error');
        continue;
      }
      ok.push({
        id: nextId++,
        name: f.name,
        text: f.text,
        kind: 'auto',
        localHostname: f.localHostname ?? '',
      });
    }
    setSources([...sources, ...ok]);
  };
  const pick = async () => {
    const files = await platform().pickTextFiles(
      [
        {
          name: t('import.filterAll', 'Supported files'),
          extensions: [
            'txt',
            'log',
            'cfg',
            'conf',
            'csv',
            'tsv',
            'drawio',
            'xml',
            'gns3',
            'yml',
            'yaml',
            'json',
          ],
        },
        { name: t('import.filterAny', 'All files'), extensions: ['*'] },
      ],
      true,
    );
    add(files);
  };
  const update = (id: number, patch: Partial<Source>) =>
    setSources(sources.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="import-paste" className="mb-1 block text-xs font-medium text-muted">
          {t(
            'import.pasteLabel',
            'Paste CLI output (show cdp neighbors detail, show lldp neighbors detail, show running-config, show ip interface brief, show interfaces status, show vlan brief, show etherchannel summary) or CSV',
          )}
        </label>
        <TextArea
          id="import-paste"
          className="h-36 font-mono text-[12px]"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder={'SW1#show cdp neighbors detail\n-------------------------\nDevice ID: R1\n…'}
          spellCheck={false}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            aria-label={t('import.localHost', 'Captured on device (if the text has no prompt)')}
            placeholder={t('import.localHostPh', 'Captured on (hostname, optional)')}
            className="h-8 w-60 rounded-md border border-line bg-surface px-2 text-[12.5px]"
            value={pasteHost}
            onChange={(e) => setPasteHost(e.target.value)}
          />
          <Button
            disabled={!paste.trim()}
            onClick={() => {
              add([
                {
                  name: t('import.pasted', 'Pasted text {{n}}', { n: sources.length + 1 }),
                  text: paste,
                  localHostname: pasteHost,
                },
              ]);
              setPaste('');
              setPasteHost('');
            }}
          >
            {t('import.addPaste', 'Add pasted text')}
          </Button>
          <span className="text-xs text-subtle">{t('import.or', 'or')}</span>
          <Button onClick={() => void pick()}>
            <FileUp size={14} />
            {t('import.pick', 'Choose files…')}
          </Button>
        </div>
      </div>
      {sources.length > 0 && (
        <div>
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-subtle">
            {t('import.sources', 'Sources ({{n}})', { n: sources.length })}
          </h3>
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
            {sources.map((s) => {
              const detected = detectKind(s.text, s.name);
              const kind = s.kind === 'auto' ? detected : s.kind;
              return (
                <li key={s.id} className="p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink" title={s.name}>
                      {s.name}
                    </span>
                    <select
                      aria-label={t('import.kind', 'Source type')}
                      className="h-7 rounded border border-line bg-surface px-1 text-[12px]"
                      value={s.kind}
                      onChange={(e) => update(s.id, { kind: e.target.value as Source['kind'] })}
                    >
                      <option value="auto">
                        {detected
                          ? t('import.auto', 'Auto: {{k}}', { k: KIND_LABELS[detected] })
                          : t('import.unknown', 'Auto: not recognized')}
                      </option>
                      {(Object.keys(KIND_LABELS) as SourceKind[]).map((k) => (
                        <option key={k} value={k}>
                          {KIND_LABELS[k]}
                        </option>
                      ))}
                    </select>
                    {kind && NEEDS_LOCAL.includes(kind) && (
                      <input
                        aria-label={t('import.localHost', 'Captured on device (if the text has no prompt)')}
                        placeholder={t('import.localHostShort', 'Captured on')}
                        className="h-7 w-32 rounded border border-line bg-surface px-1 text-[12px]"
                        value={s.localHostname}
                        onChange={(e) => update(s.id, { localHostname: e.target.value })}
                      />
                    )}
                    <button
                      type="button"
                      aria-label={t('import.remove', 'Remove {{n}}', { n: s.name })}
                      className="rounded p-1 text-subtle hover:bg-surface-3 hover:text-danger"
                      onClick={() => setSources(sources.filter((x) => x.id !== s.id))}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  {!kind && (
                    <p className="mt-1 text-[11.5px] text-warning">
                      {t('import.pickKind', 'Could not tell what this is. Choose the source type.')}
                    </p>
                  )}
                  {kind === 'csv' && (
                    <CsvMapping source={s} onChange={(m) => update(s.id, { csvMapping: m })} />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function ReviewStep({ plan, setPlan }: { plan: ImportPlan; setPlan: (p: ImportPlan) => void }) {
  const { t } = useTranslation();
  const [showUnparsed, setShowUnparsed] = useState(false);
  const unparsedCount = plan.unparsed.reduce((n, u) => n + u.lines.length, 0);
  const toggleDevice = (key: string) =>
    setPlan({
      ...plan,
      devices: plan.devices.map((d) => (d.key === key ? { ...d, selected: !d.selected } : d)),
    });
  const toggleLink = (key: string) =>
    setPlan({ ...plan, links: plan.links.map((l) => (l.key === key ? { ...l, selected: !l.selected } : l)) });
  const allDevices = plan.devices.every((d) => d.selected);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1">
        <Badge tone="accent">
          {t('import.newDevices', '{{n}} new devices', {
            n: plan.devices.filter((d) => d.action === 'create').length,
          })}
        </Badge>
        <Badge>
          {t('import.updDevices', '{{n}} updates', {
            n: plan.devices.filter((d) => d.action === 'update').length,
          })}
        </Badge>
        <Badge tone="accent">
          {t('import.newLinks', '{{n}} new links', {
            n: plan.links.filter((l) => l.action === 'create').length,
          })}
        </Badge>
        {plan.links.some((l) => l.action === 'conflict') && (
          <Badge tone="warning">
            {t('import.conflicts', '{{n}} conflicts', {
              n: plan.links.filter((l) => l.action === 'conflict').length,
            })}
          </Badge>
        )}
        {plan.vlans.filter((v) => v.action === 'create').length > 0 && (
          <Badge>
            {t('import.newVlans', '{{n}} VLANs', {
              n: plan.vlans.filter((v) => v.action === 'create').length,
            })}
          </Badge>
        )}
        {plan.vrfs.filter((v) => v.action === 'create').length > 0 && (
          <Badge>
            {t('import.newVrfs', '{{n}} VRFs', { n: plan.vrfs.filter((v) => v.action === 'create').length })}
          </Badge>
        )}
      </div>
      {plan.warnings.length > 0 && (
        <ul className="rounded-md bg-warning-soft px-3 py-2 text-[12px] text-warning">
          {plan.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
      <section>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-subtle">
            {t('import.devices', 'Devices')}
          </h3>
          <button
            type="button"
            className="text-[11.5px] text-accent-ink underline"
            onClick={() =>
              setPlan({ ...plan, devices: plan.devices.map((d) => ({ ...d, selected: !allDevices })) })
            }
          >
            {allDevices ? t('import.none', 'Select none') : t('import.all', 'Select all')}
          </button>
        </div>
        <ul className="max-h-56 overflow-y-auto rounded-lg border border-line">
          {plan.devices.map((d) => (
            <li
              key={d.key}
              className="flex items-center gap-2 border-b border-line px-2 py-1 last:border-b-0"
            >
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--accent)]"
                checked={d.selected}
                onChange={() => toggleDevice(d.key)}
                aria-label={t('import.includeX', 'Include {{h}}', { h: d.hostname })}
              />
              <span className="w-36 truncate font-mono text-[12.5px] text-ink">{d.hostname}</span>
              <Badge tone={d.action === 'create' ? 'accent' : 'neutral'}>
                {d.action === 'create' ? t('import.create', 'new') : t('import.update', 'update')}
              </Badge>
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted">
                {[d.role as DeviceRole, ...d.changes].join(' · ')}
              </span>
            </li>
          ))}
          {plan.devices.length === 0 && (
            <li className="px-2 py-3 text-center text-xs text-muted">
              {t('import.noDevices', 'No devices found in the sources.')}
            </li>
          )}
        </ul>
      </section>
      <section>
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-subtle">
          {t('import.links', 'Links')}
        </h3>
        <ul className="max-h-48 overflow-y-auto rounded-lg border border-line">
          {plan.links.map((l) => (
            <li
              key={l.key}
              className={cx(
                'flex items-center gap-2 border-b border-line px-2 py-1 last:border-b-0',
                l.action === 'exists' && 'opacity-60',
              )}
            >
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--accent)]"
                disabled={l.action !== 'create'}
                checked={l.selected && l.action === 'create'}
                onChange={() => toggleLink(l.key)}
                aria-label={t('import.includeLink', 'Include link {{a}} to {{b}}', {
                  a: l.a.hostname,
                  b: l.b.hostname,
                })}
              />
              <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink">
                {l.a.hostname} {l.a.iface ?? ''} ↔ {l.b.hostname} {l.b.iface ?? ''}
              </span>
              {l.action !== 'create' && (
                <Badge tone={l.action === 'conflict' ? 'warning' : 'neutral'}>
                  {l.action === 'conflict' ? t('import.conflict', 'conflict') : t('import.exists', 'exists')}
                </Badge>
              )}
              {l.reason && (
                <span className="max-w-40 truncate text-[11px] text-warning" title={l.reason}>
                  {l.reason}
                </span>
              )}
            </li>
          ))}
          {plan.links.length === 0 && (
            <li className="px-2 py-3 text-center text-xs text-muted">
              {t('import.noLinks', 'No links found.')}
            </li>
          )}
        </ul>
      </section>
      {unparsedCount > 0 && (
        <section>
          <button
            type="button"
            aria-expanded={showUnparsed}
            onClick={() => setShowUnparsed(!showUnparsed)}
            className="flex items-center gap-1 text-[12px] text-muted hover:text-ink"
          >
            <ChevronRight size={12} className={cx('transition-transform', showUnparsed && 'rotate-90')} />
            {t('import.unparsed', '{{n}} lines were not understood and were skipped', { n: unparsedCount })}
          </button>
          {showUnparsed && (
            <div className="mt-1 max-h-48 overflow-auto rounded-md bg-surface-2 p-2 font-mono text-[11px]">
              {plan.unparsed.map((u) => (
                <div key={u.source} className="mb-2">
                  <div className="font-sans font-semibold text-muted">{u.source}</div>
                  {u.lines.map((l, i) => (
                    <div key={i} className="whitespace-pre text-ink">
                      <span className="mr-2 select-none text-subtle">{l.line}</span>
                      {l.text}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export function ImportDialog({ initialText }: { initialText?: string }) {
  const { t } = useTranslation();
  const close = useUi((s) => s.close);
  const toast = useUi((s) => s.toast);
  const [sources, setSources] = useState<Source[]>(() =>
    initialText
      ? [
          {
            id: nextId++,
            name: t('import.pasted', 'Pasted text {{n}}', { n: 1 }),
            text: initialText,
            kind: 'auto',
            localHostname: '',
          },
        ]
      : [],
  );
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [target, setTarget] = useState<'page' | 'new'>('page');
  const [busy, setBusy] = useState(false);
  const [cancelLayout, setCancelLayout] = useState<(() => void) | null>(null);

  const review = () => {
    const doc = useEditor.getState().doc;
    const results = sources.map((s) => ({ source: s.name, result: parseSource(s) }));
    setPlan(buildImportPlan(doc, results));
  };

  const apply = async () => {
    if (!plan) return;
    const ed = useEditor.getState();
    const page = selectPage(ed);
    const created = plan.devices.filter((d) => d.selected && d.action === 'create');
    setBusy(true);
    let positions: Record<string, { x: number; y: number }> = {};
    try {
      if (created.length) {
        const keys = new Set(created.map((d) => d.key));
        const job = startLayout({
          algorithm: 'hierarchical-down',
          nodes: created.map((d) => ({ id: d.key, role: d.role, x: 0, y: 0 })),
          edges: plan.links
            .filter((l) => l.selected)
            .map((l) => ({ source: l.a.hostname.toLowerCase(), target: l.b.hostname.toLowerCase() }))
            .filter((e) => keys.has(e.source) && keys.has(e.target)),
        });
        setCancelLayout(() => job.cancel);
        positions = await job.promise;
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        setBusy(false);
        setCancelLayout(null);
        return;
      }
      // Fall back to the grid placement inside applyImportPlan.
      positions = {};
    }
    setCancelLayout(null);
    // Place new devices next to the existing devices they connect to; otherwise to the right of the page.
    let dx = 0;
    let dy = 0;
    if (target === 'page' && page && Object.keys(page.nodePositions).length) {
      const createdKeys = new Set(created.map((d) => d.key));
      const anchors: { x: number; y: number }[] = [];
      for (const l of plan.links.filter((x) => x.selected && x.action === 'create')) {
        for (const [mine, other] of [
          [l.a.hostname, l.b.hostname],
          [l.b.hostname, l.a.hostname],
        ] as const) {
          if (!createdKeys.has(mine.toLowerCase())) continue;
          const ex = ed.doc.devices.find((d) => d.hostname.toLowerCase() === other.toLowerCase());
          const pos = ex ? page.nodePositions[ex.id] : undefined;
          if (pos) anchors.push(pos);
        }
      }
      const pts = Object.values(positions);
      if (anchors.length && pts.length) {
        const ax = anchors.reduce((n, p) => n + p.x, 0) / anchors.length;
        const ay = Math.max(...anchors.map((p) => p.y));
        const cx = (Math.min(...pts.map((p) => p.x)) + Math.max(...pts.map((p) => p.x))) / 2;
        const top = Math.min(...pts.map((p) => p.y));
        dx = ax - cx;
        dy = ay + 140 - top;
      } else {
        const b = pageBounds(buildPageModel(ed.doc, page, { layer: 'l1', highlight: null, issues: [] }), 0);
        dx = b.x + b.w + 160;
        dy = b.y;
      }
    }
    const shifted = Object.fromEntries(
      Object.entries(positions).map(([k, p]) => [k, { x: p.x + dx, y: p.y + dy }]),
    );
    try {
      if (target === 'new') {
        const pg = addPage(t('import.pageName', 'Imported'));
        const cmd = applyImportPlan(plan, { pageId: pg.pageId, positions: shifted, origin: { x: 0, y: 0 } });
        if (ed.execute(batch('Import', [pg, cmd]))) {
          ed.setPage(pg.pageId);
          useEditor.getState().setSelection({ devices: cmd.createdDeviceIds });
        }
      } else {
        const cmd = applyImportPlan(plan, {
          pageId: ed.pageId,
          positions: shifted,
          origin: { x: dx, y: dy },
        });
        if (ed.execute(cmd)) ed.setSelection({ devices: cmd.createdDeviceIds });
      }
      toast(
        t('import.done', 'Imported {{d}} devices and {{l}} links.', {
          d: plan.devices.filter((d) => d.selected).length,
          l: plan.links.filter((l) => l.selected && l.action === 'create').length,
        }),
        'success',
      );
      close();
      requestAnimationFrame(() => canvasApi.fit());
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && close()}
      title={t('import.title', 'Import network data')}
      description={
        plan
          ? t('import.reviewDesc', 'Nothing changes until you apply. The whole import is one undo step.')
          : t(
              'import.desc',
              'Config text is parsed, never executed. Passwords, secrets and SNMP communities are stripped.',
            )
      }
      width={860}
      footer={
        plan ? (
          <>
            <div className="mr-auto">
              <Segmented
                label={t('import.target', 'Place on')}
                value={target}
                onChange={setTarget}
                options={[
                  { value: 'page', label: t('import.thisPage', 'This page') },
                  { value: 'new', label: t('import.newPage', 'New page') },
                ]}
              />
            </div>
            <Button onClick={() => setPlan(null)} disabled={busy}>
              {t('common.back', 'Back')}
            </Button>
            {cancelLayout ? (
              <Button onClick={cancelLayout}>{t('import.cancelLayout', 'Cancel layout')}</Button>
            ) : (
              <Button
                variant="primary"
                disabled={
                  busy ||
                  (!plan.devices.some((d) => d.selected) &&
                    !plan.links.some((l) => l.selected && l.action === 'create'))
                }
                onClick={() => void apply()}
              >
                {busy ? t('import.applying', 'Laying out…') : t('import.apply', 'Apply import')}
              </Button>
            )}
          </>
        ) : (
          <>
            <Button onClick={close}>{t('common.cancel', 'Cancel')}</Button>
            <Button variant="primary" disabled={!sources.length} onClick={review}>
              {t('import.review', 'Review')}
            </Button>
          </>
        )
      }
    >
      {plan ? (
        <ReviewStep plan={plan} setPlan={setPlan} />
      ) : (
        <SourcesStep sources={sources} setSources={setSources} />
      )}
    </Dialog>
  );
}
