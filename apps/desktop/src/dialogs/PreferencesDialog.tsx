// SPDX-License-Identifier: Apache-2.0
/** Preferences (FR-APP-07). Telemetry is off by default and nothing is sent without opt-in (NFR-PRIV-02). */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildPack, deletePack, listPacks, savePack, unzipFiles, type IconPack } from '../lib/iconPacks.ts';
import { Button, Checkbox, Dialog, Field, Segmented, Select, TextInput } from '../components/ui.tsx';
import i18n, { LANGUAGES } from '../i18n/index.ts';
import { platform } from '../platform/index.ts';
import { usePrefs } from '../store/prefs.ts';
import { useUi } from '../store/ui.ts';

function IconPacks() {
  const { t } = useTranslation();
  const toast = useUi((s) => s.toast);
  const [packs, setPacks] = useState<IconPack[]>([]);
  const refresh = () => void listPacks().then(setPacks);
  useEffect(refresh, []);
  const importPack = async () => {
    const files = await platform().pickBinaryFiles([
      {
        name: t('prefs.packFiles', 'Icon pack (.zip, .svg, .png, manifest.json)'),
        extensions: ['zip', 'svg', 'png', 'json'],
      },
    ]);
    if (!files.length) return;
    const warnings: string[] = [];
    const expanded: { name: string; bytes: Uint8Array }[] = [];
    for (const f of files) {
      if (f.name.toLowerCase().endsWith('.zip')) expanded.push(...(await unzipFiles(f.bytes)));
      else expanded.push(f);
    }
    const name =
      files.length === 1 && files[0]
        ? files[0].name.replace(/\.zip$/i, '')
        : t('prefs.packDefault', 'Imported icons');
    const pack = buildPack(expanded, name, warnings);
    if (!pack.icons.length) {
      toast(t('prefs.packEmpty', 'No SVG or PNG icons were found.'), 'error');
      return;
    }
    await savePack(pack);
    refresh();
    toast(
      t('prefs.packDone', 'Imported {{n}} icons into “{{name}}”.', {
        n: pack.icons.length,
        name: pack.name,
      }) + (warnings.length ? ` ${warnings.join(' ')}` : ''),
      warnings.length ? 'info' : 'success',
    );
  };
  return (
    <div className="rounded-lg border border-line p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted">{t('prefs.packs', 'Icon packs')}</span>
        <Button
          size="sm"
          onClick={() => void importPack().catch((e: unknown) => toast((e as Error).message, 'error'))}
        >
          {t('prefs.importPack', 'Import…')}
        </Button>
      </div>
      {packs.length === 0 ? (
        <p className="text-xs text-subtle">
          {t(
            'prefs.noPacks',
            'Import a .zip or a set of SVG/PNG files (with an optional manifest.json) to use your own icons. Icons you use are embedded in the diagram.',
          )}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {packs.map((p) => (
            <li key={p.id} className="flex items-center gap-2 py-1 text-[12.5px]">
              <span className="flex-1 truncate">{p.name}</span>
              <span className="text-[11px] text-subtle">
                {t('prefs.packCount', '{{n}} icons', { n: p.icons.length })}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await deletePack(p.id);
                  refresh();
                }}
              >
                {t('prefs.removePack', 'Remove')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PreferencesDialog() {
  const { t } = useTranslation();
  const close = useUi((s) => s.close);
  const p = usePrefs();
  const desktop = platform().kind === 'tauri';
  const names = new Intl.DisplayNames([i18n.language], { type: 'language' });
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && close()}
      title={t('prefs.title', 'Preferences')}
      width={560}
      footer={
        <>
          <Button className="mr-auto" variant="ghost" onClick={() => p.reset()}>
            {t('prefs.reset', 'Restore defaults')}
          </Button>
          <Button variant="primary" onClick={close}>
            {t('common.done', 'Done')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t('prefs.theme', 'Theme')}>
          {() => (
            <Segmented
              label={t('prefs.theme', 'Theme')}
              value={p.theme}
              onChange={(theme) => p.set({ theme })}
              options={[
                { value: 'system', label: t('prefs.system', 'System') },
                { value: 'light', label: t('prefs.light', 'Light') },
                { value: 'dark', label: t('prefs.dark', 'Dark') },
              ]}
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('prefs.grid', 'Grid size')}>
            {(id) => (
              <Select
                id={id}
                value={p.gridSize}
                onChange={(e) => p.set({ gridSize: Number(e.target.value) })}
              >
                {[8, 12, 16, 20, 24, 32].map((n) => (
                  <option key={n} value={n}>
                    {n} px
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t('prefs.routing', 'Default link style')}>
            {(id) => (
              <Select
                id={id}
                value={p.defaultRouting}
                onChange={(e) => p.set({ defaultRouting: e.target.value as typeof p.defaultRouting })}
              >
                <option value="orthogonal">{t('routing.orthogonal', 'Orthogonal')}</option>
                <option value="straight">{t('routing.straight', 'Straight')}</option>
                <option value="curved">{t('routing.curved', 'Curved')}</option>
              </Select>
            )}
          </Field>
        </div>
        <div className="flex flex-col gap-2">
          <Checkbox
            label={t('prefs.showGrid', 'Show grid')}
            checked={p.showGrid}
            onChange={(v) => p.set({ showGrid: v })}
          />
          <Checkbox
            label={t('prefs.snap', 'Snap to grid')}
            checked={p.snapToGrid}
            onChange={(v) => p.set({ snapToGrid: v })}
          />
          <Checkbox
            label={t('prefs.minimap', 'Show minimap')}
            checked={p.showMinimap}
            onChange={(v) => p.set({ showMinimap: v })}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label={t('prefs.autosave', 'Recovery copy every')}
            hint={t(
              'prefs.autosaveHint',
              'Seconds; 0 turns it off. Your file is only written when you save.',
            )}
          >
            {(id, d) => (
              <TextInput
                id={id}
                aria-describedby={d}
                type="number"
                min={0}
                max={3600}
                value={p.autosaveSeconds}
                onChange={(e) =>
                  p.set({ autosaveSeconds: Math.max(0, Math.min(3600, Number(e.target.value) || 0)) })
                }
              />
            )}
          </Field>
          <Field label={t('prefs.dpi', 'Default PNG scale')}>
            {(id) => (
              <Select
                id={id}
                value={p.exportScale}
                onChange={(e) => p.set({ exportScale: Number(e.target.value) })}
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}× ({n * 96} DPI)
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label={t('prefs.language', 'Language')}>
          {(id) => (
            <Select
              id={id}
              value={p.language}
              onChange={(e) => {
                p.set({ language: e.target.value });
                void i18n.changeLanguage(e.target.value);
              }}
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {names.of(l) ?? l}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {desktop && (
          <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
            <Checkbox
              label={t('prefs.updates', 'Check for updates automatically')}
              checked={p.updateChecks}
              onChange={(v) => p.set({ updateChecks: v })}
            />
            <Field label={t('prefs.channel', 'Update channel')}>
              {() => (
                <Segmented
                  label={t('prefs.channel', 'Update channel')}
                  value={p.updateChannel}
                  onChange={(updateChannel) => p.set({ updateChannel })}
                  options={[
                    { value: 'stable', label: t('prefs.stable', 'Stable') },
                    { value: 'beta', label: t('prefs.beta', 'Beta') },
                  ]}
                />
              )}
            </Field>
          </div>
        )}
        <IconPacks />
        <div className="rounded-lg border border-line p-3">
          <Checkbox
            label={t('prefs.telemetry', 'Send anonymous crash reports')}
            checked={p.telemetry}
            onChange={(v) => p.set({ telemetry: v })}
          />
          <p className="mt-1 text-xs text-muted">
            {t(
              'prefs.telemetryHint',
              'Off by default. LineWise never sends your diagrams. This build has no crash reporter configured, so nothing is sent either way.',
            )}
          </p>
        </div>
      </div>
    </Dialog>
  );
}
