// SPDX-License-Identifier: Apache-2.0
/** Export (FR-EXP-01..08): images, PDF, CSV tables, reports and text topologies. */
import {
  exportContainerlab,
  exportDevicesCsv,
  exportDot,
  exportDrawio,
  exportHtmlReport,
  exportInterfacesCsv,
  exportIpPlanCsv,
  exportLinksCsv,
  exportMarkdownReport,
  exportMermaid,
  exportPortMapCsv,
} from '@linewise/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Dialog, Field, Segmented, Select, TextInput } from '../components/ui.tsx';
import { PAPER, type PaperSize } from '../export/paper.ts';
import { renderPageSvg } from '../export/svg.ts';
import { platform, type FileFilter } from '../platform/index.ts';
import { selectPage, useEditor } from '../store/editor.ts';
import { usePrefs } from '../store/prefs.ts';
import { useUi } from '../store/ui.ts';

type Format = 'png' | 'svg' | 'pdf' | 'csv' | 'html' | 'md' | 'drawio' | 'clab' | 'mermaid' | 'dot';
type CsvKind = 'devices' | 'interfaces' | 'links' | 'ipplan' | 'portmap';

const FORMATS: { id: Format; label: string; ext: string; filter: FileFilter }[] = [
  { id: 'png', label: 'PNG image', ext: 'png', filter: { name: 'PNG image', extensions: ['png'] } },
  { id: 'svg', label: 'SVG image', ext: 'svg', filter: { name: 'SVG image', extensions: ['svg'] } },
  { id: 'pdf', label: 'PDF document', ext: 'pdf', filter: { name: 'PDF', extensions: ['pdf'] } },
  { id: 'csv', label: 'CSV table', ext: 'csv', filter: { name: 'CSV', extensions: ['csv'] } },
  { id: 'html', label: 'HTML report', ext: 'html', filter: { name: 'HTML', extensions: ['html'] } },
  { id: 'md', label: 'Markdown report', ext: 'md', filter: { name: 'Markdown', extensions: ['md'] } },
  {
    id: 'drawio',
    label: 'draw.io diagram',
    ext: 'drawio',
    filter: { name: 'draw.io', extensions: ['drawio', 'xml'] },
  },
  {
    id: 'clab',
    label: 'Containerlab topology',
    ext: 'clab.yml',
    filter: { name: 'YAML', extensions: ['yml', 'yaml'] },
  },
  { id: 'mermaid', label: 'Mermaid', ext: 'mmd', filter: { name: 'Mermaid', extensions: ['mmd', 'md'] } },
  { id: 'dot', label: 'Graphviz DOT', ext: 'dot', filter: { name: 'DOT', extensions: ['dot', 'gv'] } },
];

export function safeFileName(s: string): string {
  const cleaned = [...s].map((c) => (c.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(c) ? '-' : c)).join('');
  return (cleaned.replace(/-{2,}/g, '-').replace(/\s+/g, ' ').trim() || 'diagram').slice(0, 120);
}

export function ExportDialog() {
  const { t } = useTranslation();
  const close = useUi((s) => s.close);
  const toast = useUi((s) => s.toast);
  const doc = useEditor((s) => s.doc);
  const page = useEditor(selectPage);
  const layer = useEditor((s) => s.layer);
  const selection = useEditor((s) => s.selection);
  const issues = useEditor((s) => s.issues);
  const prefs = usePrefs();
  const [format, setFormat] = useState<Format>('png');
  const [scope, setScope] = useState<'page' | 'selection'>('page');
  const [scale, setScale] = useState(prefs.exportScale);
  const [transparent, setTransparent] = useState(false);
  const [grid, setGrid] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [paper, setPaper] = useState<PaperSize>('letter');
  const [orientation, setOrientation] = useState<'auto' | 'portrait' | 'landscape'>('auto');
  const [mode, setMode] = useState<'fit' | 'tile'>('fit');
  const [allPages, setAllPages] = useState(true);
  const [titleBlock, setTitleBlock] = useState(true);
  const [revision, setRevision] = useState('1');
  const [csvKind, setCsvKind] = useState<CsvKind>('devices');
  const [withImage, setWithImage] = useState(true);
  const [busy, setBusy] = useState(false);
  const fmt = FORMATS.find((f) => f.id === format) ?? FORMATS[0];
  const hasSelection = selection.devices.length > 0;
  const isImage = format === 'png' || format === 'svg';

  const run = async () => {
    if (!page || !fmt) return;
    setBusy(true);
    try {
      const base = safeFileName(
        doc.pages.length > 1 && format !== 'pdf' ? `${doc.name} - ${page.name}` : doc.name,
      );
      const svgOpts = {
        pageId: page.id,
        layer,
        transparent,
        grid,
        theme,
        issues,
        ...(scope === 'selection' && hasSelection ? { selection: selection.devices } : {}),
      };
      let data: string | Uint8Array;
      let name = `${base}.${fmt.ext}`;
      switch (format) {
        case 'svg':
          data = renderPageSvg(doc, svgOpts).svg;
          break;
        case 'png': {
          const { svgToPng } = await import('../export/raster.ts');
          data = await svgToPng(renderPageSvg(doc, svgOpts), scale);
          prefs.set({ exportScale: scale });
          break;
        }
        case 'pdf': {
          const { exportPdf } = await import('../export/pdf.ts');
          const pageIds = allPages
            ? [...doc.pages].sort((a, b) => a.order - b.order).map((p) => p.id)
            : [page.id];
          data = await exportPdf(doc, {
            paper,
            orientation,
            mode,
            pageIds,
            layer,
            theme,
            titleBlock,
            revision,
          });
          break;
        }
        case 'csv': {
          const fn = {
            devices: exportDevicesCsv,
            interfaces: exportInterfacesCsv,
            links: exportLinksCsv,
            ipplan: exportIpPlanCsv,
            portmap: exportPortMapCsv,
          }[csvKind];
          data = fn(doc);
          name = `${safeFileName(doc.name)}-${csvKind}.csv`;
          break;
        }
        case 'html':
        case 'md': {
          let imageDataUrl: string | undefined;
          if (withImage) {
            const { svgToPngDataUrl } = await import('../export/raster.ts');
            imageDataUrl = await svgToPngDataUrl(
              renderPageSvg(doc, { pageId: page.id, layer, theme: 'light' }),
              1.5,
            );
          }
          const opts = {
            issues,
            generatedAt: new Date().toISOString(),
            ...(imageDataUrl ? { imageDataUrl } : {}),
          };
          data = format === 'html' ? exportHtmlReport(doc, opts) : exportMarkdownReport(doc, opts);
          name = `${safeFileName(doc.name)}-report.${format}`;
          break;
        }
        case 'drawio':
          data = exportDrawio(doc, page.id);
          break;
        case 'clab':
          data = exportContainerlab(doc);
          name = `${safeFileName(doc.name)}.clab.yml`;
          break;
        case 'mermaid':
          data = exportMermaid(doc);
          break;
        case 'dot':
          data = exportDot(doc);
          break;
      }
      const ok = await platform().exportFile(data, name, [fmt.filter]);
      if (ok) {
        toast(t('export.done', 'Exported {{name}}', { name }), 'success');
        close();
      }
    } catch (e) {
      toast(t('export.failed', 'Export failed: {{msg}}', { msg: (e as Error).message }), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && close()}
      title={t('export.title', 'Export')}
      width={640}
      footer={
        <>
          <Button onClick={close}>{t('common.cancel', 'Cancel')}</Button>
          <Button variant="primary" disabled={busy} onClick={() => void run()}>
            {busy ? t('export.working', 'Exporting…') : t('export.go', 'Export…')}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
        <div role="radiogroup" aria-label={t('export.format', 'Format')} className="flex flex-col gap-0.5">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={format === f.id}
              onClick={() => setFormat(f.id)}
              className={`rounded-md px-2 py-1.5 text-left text-[13px] ${format === f.id ? 'bg-accent-soft font-medium text-accent-ink' : 'text-ink hover:bg-surface-3'}`}
            >
              {t(`export.fmt.${f.id}`, f.label)}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {(isImage || format === 'pdf') && (
            <Field label={t('export.theme', 'Colors')}>
              {() => (
                <Segmented
                  label={t('export.theme', 'Colors')}
                  value={theme}
                  onChange={setTheme}
                  options={[
                    { value: 'light', label: t('export.light', 'Light') },
                    { value: 'dark', label: t('export.dark', 'Dark') },
                  ]}
                />
              )}
            </Field>
          )}
          {isImage && (
            <>
              <Field label={t('export.scope', 'What to export')}>
                {() => (
                  <Segmented
                    label={t('export.scope', 'What to export')}
                    value={scope}
                    onChange={setScope}
                    options={[
                      { value: 'page', label: t('export.page', 'Whole page') },
                      {
                        value: 'selection',
                        label: hasSelection
                          ? t('export.selectionN', 'Selection ({{n}})', { n: selection.devices.length })
                          : t('export.selection', 'Selection'),
                      },
                    ]}
                  />
                )}
              </Field>
              {scope === 'selection' && !hasSelection && (
                <p className="text-xs text-warning">
                  {t('export.noSelection', 'Nothing is selected, so the whole page will be exported.')}
                </p>
              )}
              {format === 'png' && (
                <Field label={t('export.scale', 'Scale')}>
                  {() => (
                    <Segmented
                      label={t('export.scale', 'Scale')}
                      value={String(scale)}
                      onChange={(v) => setScale(Number(v))}
                      options={['1', '2', '3', '4'].map((v) => ({ value: v, label: `${v}×` }))}
                    />
                  )}
                </Field>
              )}
              <Checkbox
                label={t('export.transparent', 'Transparent background')}
                checked={transparent}
                onChange={setTransparent}
              />
              <Checkbox label={t('export.grid', 'Include grid')} checked={grid} onChange={setGrid} />
            </>
          )}
          {format === 'pdf' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('export.paper', 'Paper')}>
                  {(id) => (
                    <Select id={id} value={paper} onChange={(e) => setPaper(e.target.value as PaperSize)}>
                      {(Object.keys(PAPER) as PaperSize[]).map((p) => (
                        <option key={p} value={p}>
                          {PAPER[p].label}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label={t('export.orientation', 'Orientation')}>
                  {(id) => (
                    <Select
                      id={id}
                      value={orientation}
                      onChange={(e) => setOrientation(e.target.value as typeof orientation)}
                    >
                      <option value="auto">{t('export.auto', 'Automatic')}</option>
                      <option value="portrait">{t('export.portrait', 'Portrait')}</option>
                      <option value="landscape">{t('export.landscape', 'Landscape')}</option>
                    </Select>
                  )}
                </Field>
              </div>
              <Field label={t('export.sizing', 'Sizing')}>
                {() => (
                  <Segmented
                    label={t('export.sizing', 'Sizing')}
                    value={mode}
                    onChange={setMode}
                    options={[
                      { value: 'fit', label: t('export.fit', 'Fit to page') },
                      { value: 'tile', label: t('export.tile', 'Tile across pages') },
                    ]}
                  />
                )}
              </Field>
              <Checkbox
                label={t('export.allPages', 'All diagram pages ({{n}})', { n: doc.pages.length })}
                checked={allPages}
                onChange={setAllPages}
              />
              <Checkbox
                label={t('export.titleBlock', 'Title block (name, author, date, revision)')}
                checked={titleBlock}
                onChange={setTitleBlock}
              />
              {titleBlock && (
                <Field label={t('export.revision', 'Revision')}>
                  {(id) => (
                    <TextInput
                      id={id}
                      value={revision}
                      onChange={(e) => setRevision(e.target.value)}
                      className="w-32"
                    />
                  )}
                </Field>
              )}
            </>
          )}
          {format === 'csv' && (
            <Field label={t('export.table', 'Table')}>
              {(id) => (
                <Select id={id} value={csvKind} onChange={(e) => setCsvKind(e.target.value as CsvKind)}>
                  <option value="devices">{t('export.csv.devices', 'Devices (inventory)')}</option>
                  <option value="interfaces">{t('export.csv.interfaces', 'Interfaces')}</option>
                  <option value="links">{t('export.csv.links', 'Links (cabling)')}</option>
                  <option value="ipplan">{t('export.csv.ipplan', 'IP plan')}</option>
                  <option value="portmap">{t('export.csv.portmap', 'Port map')}</option>
                </Select>
              )}
            </Field>
          )}
          {(format === 'html' || format === 'md') && (
            <>
              <p className="text-xs text-muted">
                {t(
                  'export.reportDesc',
                  'Diagram image, device inventory, IP plan, VLAN table and validation summary.',
                )}
              </p>
              <Checkbox
                label={t('export.withImage', 'Include diagram image of this page')}
                checked={withImage}
                onChange={setWithImage}
              />
            </>
          )}
          {format === 'drawio' && (
            <p className="text-xs text-muted">
              {t(
                'export.drawioDesc',
                'Opens in diagrams.net with positions, labels and links. Exports the current page.',
              )}
            </p>
          )}
          {format === 'clab' && (
            <p className="text-xs text-muted">
              {t(
                'export.clabDesc',
                'Nodes and links for a Containerlab lab. Review node kinds before deploying.',
              )}
            </p>
          )}
          {(format === 'mermaid' || format === 'dot') && (
            <p className="text-xs text-muted">{t('export.textDesc', 'A text topology for docs-as-code.')}</p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
