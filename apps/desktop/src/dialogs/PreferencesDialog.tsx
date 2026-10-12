// SPDX-License-Identifier: Apache-2.0
/** Preferences (FR-APP-07). Telemetry is off by default and nothing is sent without opt-in (NFR-PRIV-02). */
import { useTranslation } from 'react-i18next';
import { buildPack, deletePack, savePack, unzipFiles } from '../lib/iconPacks.ts';
import { usePacks } from '../store/packs.ts';
import { Button, Checkbox, Dialog, Field, Segmented, Select, TextInput } from '../components/ui.tsx';
import i18n, { LANGUAGES } from '../i18n/index.ts';
import { platform } from '../platform/index.ts';
import { usePrefs } from '../store/prefs.ts';
import { useUi } from '../store/ui.ts';

function IconPacks() {
  const { t } = useTranslation();
  const toast = useUi((s) => s.toast);
  const packs = usePacks((s) => s.packs);
  const refresh = () => void usePacks.getState().refresh();
  const embed = usePrefs((s) => s.embedIcons);
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
    try {
      for (const f of files) {
        if (f.name.toLowerCase().endsWith('.zip')) expanded.push(...(await unzipFiles(f.bytes, warnings)));
        else expanded.push(f);
      }
    } catch (e) {
      // Over a limit, or not a zip at all (NFR-SEC-04).
      toast(
        t('prefs.packFailed', 'The icon pack could not be read: {{msg}}', { msg: (e as Error).message }),
        'error',
      );
      return;
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
            'Import a .zip or a set of SVG/PNG files (with an optional manifest.json) to use your own icons.',
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
      <div className="mt-2">
        <Checkbox
          label={t(
            'prefs.embedIcons',
            'Embed pack icons in diagrams, so they show on computers without the pack',
          )}
          checked={embed}
          onChange={(v) => usePrefs.getState().set({ embedIcons: v })}
        />
      </div>
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
          <Checkbox
            label={t('prefs.problemBadges', 'Show problem badges on the canvas')}
            checked={p.showProblemBadges}
            onChange={(v) => p.set({ showProblemBadges: v })}
          />
          <div className="flex items-center gap-3">
            <Checkbox
              label={t('prefs.tips', 'Show tips')}
              checked={p.showTips}
              onChange={(v) => p.set({ showTips: v, ...(v ? { dismissedTips: [] } : {}) })}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                useUi.getState().close();
                useUi.getState().setTour(0);
              }}
            >
              {t('prefs.tour', 'Take the tour again')}
            </Button>
          </div>
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
        <Field label={t('prefs.uiScale', 'Interface size')}>
          {(id) => (
            <Select
              id={id}
              value={String(p.uiScale)}
              onChange={(e) =>
                p.set({ uiScale: e.target.value === 'system' ? 'system' : Number(e.target.value) })
              }
            >
              <option value="system">{t('prefs.uiScaleSystem', 'Follow system text size')}</option>
              {[0.9, 1, 1.1, 1.25, 1.5, 1.75, 2].map((n) => (
                <option key={n} value={n}>
                  {Math.round(n * 100)}%
                </option>
              ))}
            </Select>
          )}
        </Field>
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
