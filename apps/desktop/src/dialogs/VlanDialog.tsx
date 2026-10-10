// SPDX-License-Identifier: Apache-2.0
/**
 * VLAN manager (FR-NET-05): add VLANs one at a time or as a range ("100-110,200"), name and color
 * them, see which interfaces carry each one, and highlight a VLAN on the canvas.
 */
import {
  batch,
  interfaceVlans,
  parseVlanList,
  removeVlans,
  upsertVlan,
  vlanDomain,
  type Vlan,
} from '@linewise/core';
import { Eye, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, IconButton, TextInput } from '../components/ui.tsx';
import { useEditor } from '../store/editor.ts';
import { useUi } from '../store/ui.ts';

const PALETTE = [
  '#2563EB',
  '#16A34A',
  '#DC2626',
  '#9333EA',
  '#EA580C',
  '#0891B2',
  '#CA8A04',
  '#DB2777',
  '#4F46E5',
  '#059669',
];

function VlanRow({ v }: { v: Vlan }) {
  const { t } = useTranslation();
  const doc = useEditor((s) => s.doc);
  const execute = useEditor((s) => s.execute);
  const setHighlight = useEditor((s) => s.setHighlight);
  const close = useUi((s) => s.close);
  // Interfaces that carry this VLAN, as "hostname port".
  const carriers = useMemo(() => {
    const dom = vlanDomain(doc, v.number);
    const out: string[] = [];
    for (const d of doc.devices)
      for (const i of d.interfaces) if (dom.interfaceIds.has(i.id)) out.push(`${d.hostname} ${i.shortName}`);
    return { devices: dom.deviceIds.size, interfaces: out };
  }, [doc, v.number]);
  const set = (patch: Partial<Vlan>) =>
    execute(upsertVlan({ ...patch, id: v.id, number: patch.number ?? v.number }));
  return (
    <tr className="border-b border-line">
      <td className="py-1 pr-2 font-mono text-[12.5px]">{v.number}</td>
      <td className="py-1 pr-2">
        <input
          aria-label={t('vlan.nameX', 'Name of VLAN {{n}}', { n: v.number })}
          defaultValue={v.name}
          key={v.name}
          onBlur={(e) => e.target.value !== v.name && set({ name: e.target.value })}
          className="h-7 w-full rounded border border-transparent bg-transparent px-1 hover:border-line focus:border-accent"
        />
      </td>
      <td className="py-1 pr-2">
        <input
          type="color"
          aria-label={t('vlan.colorX', 'Color of VLAN {{n}}', { n: v.number })}
          defaultValue={v.color}
          onBlur={(e) => e.target.value !== v.color && set({ color: e.target.value })}
          className="h-6 w-8 cursor-pointer rounded border border-line"
        />
      </td>
      <td className="py-1 pr-2">
        <input
          aria-label={t('vlan.descX', 'Description of VLAN {{n}}', { n: v.number })}
          defaultValue={v.description}
          key={v.description}
          onBlur={(e) => e.target.value !== v.description && set({ description: e.target.value })}
          className="h-7 w-full rounded border border-transparent bg-transparent px-1 hover:border-line focus:border-accent"
        />
      </td>
      <td className="py-1 pr-2 text-[12px] text-muted">
        {carriers.interfaces.length === 0 ? (
          t('vlan.unused', 'Not used')
        ) : (
          <details>
            <summary className="cursor-pointer">
              {t('vlan.usedOn', '{{n}} ports on {{d}} devices', {
                n: carriers.interfaces.length,
                d: carriers.devices,
              })}
            </summary>
            <ul
              aria-label={t('vlan.usedOnX', 'Ports carrying VLAN {{n}}', { n: v.number })}
              className="mt-1 max-h-32 overflow-auto font-mono text-[11.5px] text-ink"
            >
              {carriers.interfaces.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </details>
        )}
      </td>
      <td className="py-1 text-right">
        <IconButton
          label={t('vlan.highlight', 'Highlight VLAN {{n}} on the canvas', { n: v.number })}
          className="h-7 min-w-7"
          onClick={() => {
            setHighlight({ kind: 'vlan', vlan: v.number });
            close();
          }}
        >
          <Eye size={14} />
        </IconButton>
        <IconButton
          label={t('vlan.delete', 'Delete VLAN {{n}}', { n: v.number })}
          className="h-7 min-w-7"
          onClick={() => execute(removeVlans([v.id]))}
        >
          <Trash2 size={14} />
        </IconButton>
      </td>
    </tr>
  );
}

export function VlanDialog() {
  const { t } = useTranslation();
  const close = useUi((s) => s.close);
  const doc = useEditor((s) => s.doc);
  const execute = useEditor((s) => s.execute);
  const [num, setNum] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const vlans = [...doc.vlans].sort((a, b) => a.number - b.number);
  const undefinedInUse = useMemo(() => {
    const defined = new Set(doc.vlans.map((v) => v.number));
    const used = new Set<number>();
    for (const d of doc.devices)
      for (const i of d.interfaces) {
        const vs = interfaceVlans(i);
        // Broad trunk ranges ("1-4094") say "anything", not "these VLANs exist".
        if (vs && vs.size <= 64) for (const v of vs) used.add(v);
      }
    return [...used].filter((v) => !defined.has(v)).sort((a, b) => a - b);
  }, [doc]);

  const add = () => {
    let nums: number[];
    try {
      nums = parseVlanList(num);
    } catch {
      return setErr(t('vlan.range', 'VLAN IDs are 1–4094'));
    }
    if (nums.length === 0 || /^all$/i.test(num.trim())) return setErr(t('vlan.range', 'VLAN IDs are 1–4094'));
    if (nums.length > 512) return setErr(t('vlan.tooMany', 'Add at most 512 VLANs at a time'));
    const fresh = nums.filter((n) => !doc.vlans.some((v) => v.number === n));
    if (fresh.length === 0)
      return setErr(
        nums.length === 1
          ? t('vlan.exists', 'VLAN {{n}} already exists', { n: nums[0] })
          : t('vlan.allExist', 'All of those VLANs already exist'),
      );
    // A range is one undo step; a name on a range becomes a prefix ("Users 101").
    execute(
      batch(
        fresh.length === 1 ? 'Add VLAN' : 'Add VLANs',
        fresh.map((n, i) =>
          upsertVlan({
            number: n,
            name: fresh.length === 1 ? name : name && `${name} ${n}`,
            color: PALETTE[(doc.vlans.length + i) % PALETTE.length] as string,
          }),
        ),
      ),
    );
    setNum('');
    setName('');
    setErr(null);
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && close()}
      title={t('vlan.title', 'VLANs')}
      description={t('vlan.desc', 'Colors are used for links in the L2 view.')}
      width={760}
      footer={<Button onClick={close}>{t('common.done', 'Done')}</Button>}
    >
      <form
        className="mb-4 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <label className="flex flex-col text-xs text-muted">
          {t('vlan.idOrRange', 'VLAN ID or range')}
          <TextInput
            className="w-40 font-mono"
            placeholder={t('vlan.idPlaceholder', '10 or 100-110,200')}
            value={num}
            onChange={(e) => setNum(e.target.value)}
            aria-invalid={!!err}
          />
        </label>
        <label className="flex flex-col text-xs text-muted">
          {t('vlan.name', 'Name')}
          <TextInput className="w-56" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <Button type="submit" variant="primary">
          <Plus size={14} />
          {t('vlan.add', 'Add VLAN')}
        </Button>
        {err && (
          <p role="alert" className="w-full text-xs text-danger">
            {err}
          </p>
        )}
      </form>
      {undefinedInUse.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-info-soft px-3 py-2 text-[12px] text-info">
          <span className="flex-1">
            {t('vlan.undefined', 'Used on ports but not defined: {{list}}', {
              list: undefinedInUse.slice(0, 20).join(', ') + (undefinedInUse.length > 20 ? '…' : ''),
            })}
          </span>
          <Button
            size="sm"
            onClick={() =>
              execute(
                batch(
                  'Add VLANs',
                  undefinedInUse.map((n, i) =>
                    upsertVlan({
                      number: n,
                      color: PALETTE[(doc.vlans.length + i) % PALETTE.length] as string,
                    }),
                  ),
                ),
              )
            }
          >
            {t('vlan.addAll', 'Add them')}
          </Button>
        </div>
      )}
      {vlans.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted">{t('vlan.none', 'No VLANs yet.')}</p>
      ) : (
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-subtle">
              <th scope="col" className="w-16 py-1 font-semibold">
                ID
              </th>
              <th scope="col" className="w-48 py-1 font-semibold">
                {t('vlan.name', 'Name')}
              </th>
              <th scope="col" className="w-12 py-1 font-semibold">
                {t('vlan.color', 'Color')}
              </th>
              <th scope="col" className="py-1 font-semibold">
                {t('vlan.description', 'Description')}
              </th>
              <th scope="col" className="w-44 py-1 font-semibold">
                {t('vlan.usedOnCol', 'Used on')}
              </th>
              <th scope="col" className="w-20 py-1">
                <span className="sr-only">{t('common.actions', 'Actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {vlans.map((v) => (
              <VlanRow key={v.id} v={v} />
            ))}
          </tbody>
        </table>
      )}
    </Dialog>
  );
}
