// SPDX-License-Identifier: Apache-2.0
/**
 * Template editor (FR-TPL-04): create a device template from scratch or by
 * cloning, define interfaces with range syntax, pick an icon, save to the
 * user library, and export/import as JSON.
 */
import {
  DEVICE_ROLES,
  expandInterfaceRange,
  INTERFACE_TYPES,
  validateTemplate,
  type DeviceRole,
  type DeviceTemplate,
} from '@linewise/core';
import { getTemplate, ROLE_LABELS, TEMPLATES } from '@linewise/device-library';
import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DeviceIcon } from '../canvas/nodes.tsx';
import { Button, Dialog, Field, IconButton, Select, TextInput } from '../components/ui.tsx';
import { platform } from '../platform/index.ts';
import { usePrefs } from '../store/prefs.ts';
import { useUi } from '../store/ui.ts';

type Row = {
  range: string;
  type: string;
  speedMbps: string;
  media: 'any' | 'copper' | 'fiber';
  poe: boolean;
};

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'device';

function countRange(spec: string): number {
  if (!spec.trim()) return 0;
  try {
    return expandInterfaceRange(spec).length;
  } catch {
    return 0;
  }
}

function toRows(t: DeviceTemplate): Row[] {
  return t.interfaces.map((i) => ({
    range: i.range,
    type: i.type ?? '',
    speedMbps: i.speedMbps ? String(i.speedMbps) : '',
    media: i.media ?? 'any',
    poe: !!i.poe,
  }));
}

export function TemplateEditorDialog({ templateId }: { templateId?: string }) {
  const { t } = useTranslation();
  const close = useUi((s) => s.close);
  const toast = useUi((s) => s.toast);
  const custom = usePrefs((s) => s.customTemplates);
  const setPrefs = usePrefs((s) => s.set);
  const existing = templateId
    ? (custom.find((x) => x.id === templateId) ?? getTemplate(templateId))
    : undefined;
  const editingCustom = !!templateId && custom.some((x) => x.id === templateId);
  const [name, setName] = useState(existing?.name ?? '');
  const [vendor, setVendor] = useState(existing?.vendor ?? 'Custom');
  const [model, setModel] = useState(existing?.model ?? '');
  const [role, setRole] = useState<DeviceRole>(existing?.role ?? 'l2-switch');
  const [rackUnits, setRackUnits] = useState(String(existing?.rackUnits ?? 1));
  const [platformName, setPlatformName] = useState(existing?.defaults.platform ?? '');
  const [os, setOs] = useState(existing?.defaults.osVersion ?? '');
  const [sourceUrl, setSourceUrl] = useState(existing?.sourceUrl ?? '');
  const [rows, setRows] = useState<Row[]>(
    existing
      ? toRows(existing)
      : [{ range: 'GigabitEthernet1/0/1-24', type: '', speedMbps: '1000', media: 'copper', poe: false }],
  );
  const [error, setError] = useState<string | null>(null);

  const portCount = useMemo(() => rows.reduce((n, r) => n + countRange(r.range), 0), [rows]);

  const build = (): DeviceTemplate => {
    const id = editingCustom && templateId ? templateId : `custom/${slug(`${vendor}-${model || name}`)}`;
    return validateTemplate({
      id,
      name: name.trim(),
      vendor: vendor.trim() || 'Custom',
      model: model.trim(),
      role,
      rackUnits: Number(rackUnits) || 0,
      interfaces: rows
        .filter((r) => r.range.trim())
        .map((r) => ({
          range: r.range.trim(),
          ...(r.type ? { type: r.type } : {}),
          ...(r.speedMbps ? { speedMbps: Number(r.speedMbps) } : {}),
          ...(r.media !== 'any' ? { media: r.media } : {}),
          ...(r.poe ? { poe: true } : {}),
        })),
      defaults: { platform: platformName.trim(), osVersion: os.trim() },
      ...(sourceUrl.trim() ? { sourceUrl: sourceUrl.trim() } : {}),
      contributor: '',
      verified: false,
      generic: false,
    });
  };

  const saveTpl = () => {
    try {
      if (!name.trim()) throw new Error(t('tpl.nameNeeded', 'Give the template a name'));
      const tpl = build();
      if (!editingCustom && (custom.some((x) => x.id === tpl.id) || TEMPLATES.some((x) => x.id === tpl.id)))
        throw new Error(
          t('tpl.exists', 'A template with id {{id}} already exists; change the model name.', { id: tpl.id }),
        );
      setPrefs({ customTemplates: [tpl, ...custom.filter((x) => x.id !== tpl.id)] });
      toast(t('tpl.saved', 'Saved “{{n}}” to your library.', { n: tpl.name }), 'success');
      close();
    } catch (e) {
      setError((e as Error).message.split('\n')[0] ?? 'Invalid template');
    }
  };

  const exportJson = async () => {
    try {
      const tpl = build();
      await platform().exportFile(`${JSON.stringify(tpl, null, 2)}\n`, `${slug(tpl.name)}.json`, [
        { name: 'JSON', extensions: ['json'] },
      ]);
    } catch (e) {
      setError((e as Error).message.split('\n')[0] ?? 'Invalid template');
    }
  };

  const load = (tpl: DeviceTemplate, asClone: boolean) => {
    setName(asClone ? t('tpl.copyOf', '{{n}} (copy)', { n: tpl.name }) : tpl.name);
    setVendor(tpl.generic ? 'Custom' : tpl.vendor);
    setModel(asClone ? `${tpl.model || tpl.name}-custom` : tpl.model);
    setRole(tpl.role);
    setRackUnits(String(tpl.rackUnits));
    setPlatformName(tpl.defaults.platform);
    setOs(tpl.defaults.osVersion);
    setSourceUrl(tpl.sourceUrl ?? '');
    setRows(toRows(tpl));
  };

  const importJson = async () => {
    const [f] = await platform().pickTextFiles([{ name: 'JSON', extensions: ['json'] }], false);
    if (!f) return;
    try {
      load(validateTemplate(JSON.parse(f.text)), false);
      setError(null);
    } catch (e) {
      setError(
        t('tpl.importFailed', 'Not a valid template: {{m}}', { m: (e as Error).message.split('\n')[0] }),
      );
    }
  };

  const remove = () => {
    if (!templateId) return;
    setPrefs({ customTemplates: custom.filter((x) => x.id !== templateId) });
    close();
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && close()}
      title={
        editingCustom ? t('tpl.editTitle', 'Edit device template') : t('tpl.newTitle', 'New device template')
      }
      width={760}
      footer={
        <>
          <div className="mr-auto flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => void importJson()}>
              {t('tpl.import', 'Import JSON…')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void exportJson()}>
              {t('tpl.export', 'Export JSON…')}
            </Button>
            {editingCustom && (
              <Button size="sm" variant="ghost" onClick={remove}>
                {t('tpl.delete', 'Delete')}
              </Button>
            )}
          </div>
          <Button onClick={close}>{t('common.cancel', 'Cancel')}</Button>
          <Button variant="primary" onClick={saveTpl}>
            {t('tpl.save', 'Save to library')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!editingCustom && (
          <Field label={t('tpl.cloneFrom', 'Start from')}>
            {(id) => (
              <Select
                id={id}
                defaultValue=""
                onChange={(e) =>
                  e.target.value &&
                  load([...custom, ...TEMPLATES].find((x) => x.id === e.target.value) as DeviceTemplate, true)
                }
              >
                <option value="">{t('tpl.scratch', 'Blank template')}</option>
                {[...custom, ...TEMPLATES].map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_72px]">
          <Field label={t('tpl.name', 'Name')}>
            {(id) => (
              <TextInput
                id={id}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Branch switch 24×GE"
              />
            )}
          </Field>
          <Field label={t('field.vendor', 'Vendor')}>
            {(id) => <TextInput id={id} value={vendor} onChange={(e) => setVendor(e.target.value)} />}
          </Field>
          <Field label={t('field.model', 'Model')}>
            {(id) => <TextInput id={id} value={model} onChange={(e) => setModel(e.target.value)} />}
          </Field>
          <Field label="RU">
            {(id) => (
              <TextInput
                id={id}
                inputMode="numeric"
                value={rackUnits}
                onChange={(e) => setRackUnits(e.target.value)}
              />
            )}
          </Field>
        </div>
        <div className="grid items-end gap-3 sm:grid-cols-[auto_1fr_1fr_1fr]">
          <div className="rounded-lg border border-line p-1">
            <DeviceIcon role={role} style="classic" size={44} />
          </div>
          <Field label={t('tpl.role', 'Role and icon')}>
            {(id) => (
              <Select id={id} value={role} onChange={(e) => setRole(e.target.value as DeviceRole)}>
                {DEVICE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t('field.platform', 'Platform')}>
            {(id) => (
              <TextInput
                id={id}
                value={platformName}
                onChange={(e) => setPlatformName(e.target.value)}
                placeholder="IOS-XE"
              />
            )}
          </Field>
          <Field label={t('field.os', 'OS version')}>
            {(id) => <TextInput id={id} value={os} onChange={(e) => setOs(e.target.value)} />}
          </Field>
        </div>
        <Field
          label={t('tpl.source', 'Datasheet URL')}
          hint={t(
            'tpl.sourceHint',
            'Where the port layout comes from. Required when contributing a vendor model.',
          )}
        >
          {(id, d) => (
            <TextInput
              id={id}
              aria-describedby={d}
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://"
            />
          )}
        </Field>
        <section>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-subtle">
              {t('tpl.interfaces', 'Interfaces ({{n}} ports)', { n: portCount })}
            </h3>
            <Button
              size="sm"
              onClick={() =>
                setRows([...rows, { range: '', type: '', speedMbps: '', media: 'any', poe: false }])
              }
            >
              <Plus size={13} />
              {t('tpl.addRow', 'Add port group')}
            </Button>
          </div>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-line text-left text-[11px] text-subtle">
                <th scope="col" className="py-1">
                  {t('tpl.range', 'Name or range')}
                </th>
                <th scope="col" className="w-36 py-1">
                  {t('iface.type', 'Type')}
                </th>
                <th scope="col" className="w-24 py-1">
                  {t('tpl.speed', 'Mb/s')}
                </th>
                <th scope="col" className="w-24 py-1">
                  {t('iface.media', 'Media')}
                </th>
                <th scope="col" className="w-12 py-1">
                  PoE
                </th>
                <th scope="col" className="w-8">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const n = countRange(r.range);
                const upd = (p: Partial<Row>) => setRows(rows.map((x, j) => (j === i ? { ...x, ...p } : x)));
                return (
                  <tr key={i} className="border-b border-line">
                    <td className="py-1 pr-2">
                      <TextInput
                        aria-label={t('tpl.range', 'Name or range')}
                        className="font-mono"
                        value={r.range}
                        onChange={(e) => upd({ range: e.target.value })}
                        aria-invalid={!!r.range.trim() && n === 0}
                        title={t('tpl.rangeCount', '{{n}} interfaces', { n })}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <Select
                        aria-label={t('iface.type', 'Type')}
                        value={r.type}
                        onChange={(e) => upd({ type: e.target.value })}
                      >
                        <option value="">{t('tpl.fromName', 'From name')}</option>
                        {INTERFACE_TYPES.map((x) => (
                          <option key={x} value={x}>
                            {x}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="py-1 pr-2">
                      <TextInput
                        aria-label={t('tpl.speed', 'Mb/s')}
                        inputMode="numeric"
                        className="font-mono"
                        value={r.speedMbps}
                        onChange={(e) => upd({ speedMbps: e.target.value.replace(/\D/g, '') })}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <Select
                        aria-label={t('iface.media', 'Media')}
                        value={r.media}
                        onChange={(e) => upd({ media: e.target.value as Row['media'] })}
                      >
                        <option value="any">{t('media.any', 'Any')}</option>
                        <option value="copper">{t('media.copper', 'Copper')}</option>
                        <option value="fiber">{t('media.fiberShort', 'Fiber')}</option>
                      </Select>
                    </td>
                    <td className="py-1 pr-2 text-center">
                      <input
                        type="checkbox"
                        aria-label="PoE"
                        className="h-4 w-4 accent-[var(--accent)]"
                        checked={r.poe}
                        onChange={(e) => upd({ poe: e.target.checked })}
                      />
                    </td>
                    <td>
                      <IconButton
                        label={t('tpl.removeRow', 'Remove port group')}
                        className="h-7 min-w-7"
                        onClick={() => setRows(rows.filter((_, j) => j !== i))}
                      >
                        <Trash2 size={13} />
                      </IconButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-subtle">
            {t(
              'tpl.rangeHint',
              'Ranges: Gi1/0/1-48, Te1/1/1-4, Ethernet1/1-32. Names expand to full Cisco names.',
            )}
          </p>
        </section>
        {error && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
