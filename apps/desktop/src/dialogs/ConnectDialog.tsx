// SPDX-License-Identifier: Apache-2.0
/**
 * Connect two devices (FR-LNK-01): pick the interface on each end (free ports
 * first), or let LineWise take the next free one; choose the medium. Without
 * a target (keyboard "L" on a focused device) the user first picks the peer.
 */
import {
  addInterfaces,
  batch,
  compareInterfaceNames,
  connect,
  isPhysical,
  LINK_MEDIA,
  linkedInterfaceIds,
  type Device,
  type LinkMedium,
} from '@linewise/core';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, Field, Select, TextInput } from '../components/ui.tsx';
import { useEditor } from '../store/editor.ts';
import { useUi } from '../store/ui.ts';
import { roleLabel } from '../lib/labels.ts';
import { mediumLabel } from '../lib/labels.ts';

const NEW = '__new';

function InterfacePicker({
  device,
  value,
  onChange,
  newName,
  onNewName,
  used,
  label,
  autoFocus,
}: {
  device: Device;
  value: string;
  onChange: (v: string) => void;
  newName: string;
  onNewName: (v: string) => void;
  used: Set<string>;
  label: string;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('');
  // Type-to-filter (FR-LNK-01): "gi1/0/2", "Gi1/0/2" and "GigabitEthernet1/0/2" all match.
  const q = filter.trim().toLowerCase();
  const matches = (i: Device['interfaces'][number]) =>
    !q || i.name.toLowerCase().includes(q) || i.shortName.toLowerCase().includes(q);
  const ifaces = [...device.interfaces]
    .sort((a, b) => compareInterfaceNames(a.name, b.name))
    .filter((i) => matches(i) || i.id === value);
  const free = ifaces.filter((i) => !used.has(i.id) && (isPhysical(i) || i.type === 'tunnel'));
  const busy = ifaces.filter((i) => used.has(i.id) && i.type !== 'tunnel');
  const tunnels = ifaces.filter((i) => used.has(i.id) && i.type === 'tunnel');
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
      <div>
        <div className="text-[13px] font-semibold text-ink">{device.hostname}</div>
        <div className="text-[11.5px] text-muted">
          {[roleLabel(device.role), device.model].filter(Boolean).join(' · ')}
        </div>
      </div>
      <TextInput
        aria-label={t('connect.filter', 'Filter {{host}} ports', { host: device.hostname })}
        placeholder={t('connect.filterHint', 'Filter ports, e.g. gi1/0/2')}
        className="font-mono"
        value={filter}
        onChange={(e) => {
          const next = e.target.value;
          setFilter(next);
          const nq = next.trim().toLowerCase();
          const hits = device.interfaces.filter(
            (i) =>
              nq &&
              !used.has(i.id) &&
              (isPhysical(i) || i.type === 'tunnel') &&
              (i.name.toLowerCase().includes(nq) || i.shortName.toLowerCase().includes(nq)),
          );
          const exact = hits.find((i) => i.name.toLowerCase() === nq || i.shortName.toLowerCase() === nq);
          if (exact) onChange(exact.id);
          else if (hits.length === 1) onChange((hits[0] as (typeof hits)[number]).id);
        }}
      />
      <Field label={label}>
        {(id) => (
          <Select id={id} value={value} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)}>
            <option value="">{t('connect.auto', 'Next free port')}</option>
            {free.length > 0 && (
              <optgroup label={t('connect.free', 'Free')}>
                {free.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                    {i.speedMbps
                      ? ` · ${i.speedMbps >= 1000 ? `${i.speedMbps / 1000}G` : `${i.speedMbps}M`}`
                      : ''}
                    {i.media !== 'any' ? ` · ${i.media}` : ''}
                  </option>
                ))}
              </optgroup>
            )}
            {tunnels.length > 0 && (
              <optgroup label={t('connect.tunnels', 'Multipoint tunnels')}>
                {tunnels.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </optgroup>
            )}
            {busy.length > 0 && (
              <optgroup label={t('connect.inUse', 'In use')}>
                {busy.map((i) => (
                  <option key={i.id} value={i.id} disabled>
                    {i.name}
                  </option>
                ))}
              </optgroup>
            )}
            <option value={NEW}>{t('connect.new', 'New interface…')}</option>
          </Select>
        )}
      </Field>
      {value === NEW && (
        <Field label={t('connect.newName', 'Interface name')}>
          {(id) => (
            <TextInput
              id={id}
              className="font-mono"
              placeholder="GigabitEthernet0/1"
              value={newName}
              onChange={(e) => onNewName(e.target.value)}
              autoFocus
            />
          )}
        </Field>
      )}
    </div>
  );
}

function PeerPicker({ sourceId, onPick }: { sourceId: string; onPick: (id: string) => void }) {
  const { t } = useTranslation();
  const doc = useEditor((s) => s.doc);
  const pageId = useEditor((s) => s.pageId);
  const [q, setQ] = useState('');
  const page = doc.pages.find((p) => p.id === pageId);
  const needle = q.trim().toLowerCase();
  // An exact hostname first, then names that start with the text, then the rest, so typing
  // "SW1" and Enter picks SW1 rather than SW10.
  const rank = (h: string) => (h === needle ? 0 : h.startsWith(needle) ? 1 : 2);
  const list = doc.devices
    .filter(
      (d) =>
        d.id !== sourceId &&
        page?.nodePositions[d.id] &&
        `${d.hostname} ${d.mgmtIp}`.toLowerCase().includes(needle),
    )
    .map((d, i) => ({ d, i, r: needle ? rank(d.hostname.toLowerCase()) : 0 }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.d)
    .slice(0, 50);
  return (
    <div className="flex flex-col gap-2">
      <TextInput
        autoFocus
        aria-label={t('connect.searchPeer', 'Find the device to connect to')}
        placeholder={t('connect.searchPeer', 'Find the device to connect to')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || !list[0]) return;
          // Cancel the key's default so the port picker that takes focus next doesn't receive it.
          e.preventDefault();
          onPick(list[0].id);
        }}
      />
      <ul
        className="max-h-72 overflow-y-auto rounded-lg border border-line"
        aria-label={t('connect.devices', 'Devices')}
      >
        {list.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[13px] hover:bg-surface-3"
              onClick={() => onPick(d.id)}
            >
              <span className="font-medium text-ink">{d.hostname}</span>
              <span className="text-[11.5px] text-muted">{roleLabel(d.role)}</span>
            </button>
          </li>
        ))}
        {list.length === 0 && (
          <li className="px-3 py-4 text-center text-xs text-muted">
            {t('connect.noPeers', 'No other devices on this page.')}
          </li>
        )}
      </ul>
    </div>
  );
}

export function ConnectDialog({
  sourceId,
  targetId: initialTarget,
}: {
  sourceId: string;
  targetId?: string;
}) {
  const { t } = useTranslation();
  const close = useUi((s) => s.close);
  const toast = useUi((s) => s.toast);
  const doc = useEditor((s) => s.doc);
  const execute = useEditor((s) => s.execute);
  const setSelection = useEditor((s) => s.setSelection);
  const [targetId, setTargetId] = useState(initialTarget ?? '');
  const [ia, setIa] = useState('');
  const [ib, setIb] = useState('');
  const [na, setNa] = useState('');
  const [nb, setNb] = useState('');
  const used = useMemo(() => linkedInterfaceIds(doc), [doc]);
  const a = doc.devices.find((d) => d.id === sourceId);
  const b = doc.devices.find((d) => d.id === targetId);
  const pickedA = a?.interfaces.find((i) => i.id === ia);
  const pickedB = b?.interfaces.find((i) => i.id === ib);
  const suggested: LinkMedium =
    pickedA?.type === 'serial' || pickedB?.type === 'serial'
      ? 'serial'
      : pickedA?.type === 'tunnel' || pickedB?.type === 'tunnel'
        ? 'virtual'
        : pickedA?.media === 'fiber' || pickedB?.media === 'fiber'
          ? 'fiber-mm'
          : 'copper';
  const [medium, setMedium] = useState<LinkMedium | ''>('');
  const effective = medium || suggested;

  const create = () => {
    if (!a || !b) return;
    try {
      const cmds = [];
      let endA = ia === NEW ? undefined : ia || undefined;
      let endB = ib === NEW ? undefined : ib || undefined;
      if (ia === NEW) {
        if (!na.trim()) throw new Error(t('connect.nameNeeded', 'Enter a name for the new interface'));
        cmds.push(addInterfaces(a.id, na.trim()));
        endA = undefined;
      }
      if (ib === NEW) {
        if (!nb.trim()) throw new Error(t('connect.nameNeeded', 'Enter a name for the new interface'));
        cmds.push(addInterfaces(b.id, nb.trim()));
        endB = undefined;
      }
      // New interfaces are resolved by name inside the batch.
      const link = connect(
        { deviceId: a.id, ...(endA ? { interfaceId: endA } : {}) },
        { deviceId: b.id, ...(endB ? { interfaceId: endB } : {}) },
        effective,
      );
      const named = {
        label: 'Connect',
        run: (d: Parameters<typeof link.run>[0]) => {
          const resolve = (dev: Device, name: string) =>
            d.devices
              .find((x) => x.id === dev.id)
              ?.interfaces.find(
                (i) =>
                  i.name.toLowerCase() === name.toLowerCase() ||
                  i.shortName.toLowerCase() === name.toLowerCase(),
              )?.id;
          const aId = ia === NEW ? resolve(a, na.trim()) : endA;
          const bId = ib === NEW ? resolve(b, nb.trim()) : endB;
          connect(
            { deviceId: a.id, ...(aId ? { interfaceId: aId } : {}) },
            { deviceId: b.id, ...(bId ? { interfaceId: bId } : {}) },
            effective,
            { id: link.linkId },
          ).run(d);
        },
      };
      cmds.push(named);
      if (execute(cmds.length === 1 ? named : batch('Connect', cmds))) setSelection({ links: [link.linkId] });
      close();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  if (!a) return null;
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && close()}
      title={
        b
          ? t('connect.title', 'Connect {{a}} to {{b}}', { a: a.hostname, b: b.hostname })
          : t('connect.titleFrom', 'Connect {{a}} to…', { a: a.hostname })
      }
      width={640}
      footer={
        b ? (
          <>
            <Button onClick={close}>{t('common.cancel', 'Cancel')}</Button>
            <Button variant="primary" onClick={create}>
              {t('connect.create', 'Connect')}
            </Button>
          </>
        ) : undefined
      }
    >
      {!b ? (
        <PeerPicker sourceId={sourceId} onPick={setTargetId} />
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
          onKeyDown={(e) => {
            // Enter in any field connects, as the dialog's primary action (keyboard flow, FR-KEY-02).
            if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON') {
              e.preventDefault();
              create();
            }
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <InterfacePicker
              device={a}
              value={ia}
              onChange={setIa}
              newName={na}
              onNewName={setNa}
              used={used}
              label={t('connect.port', 'Port')}
              autoFocus
            />
            <InterfacePicker
              device={b}
              value={ib}
              onChange={setIb}
              newName={nb}
              onNewName={setNb}
              used={used}
              label={t('connect.port', 'Port')}
            />
          </div>
          <Field label={t('field.medium', 'Medium')}>
            {(id) => (
              <Select
                id={id}
                value={medium}
                onChange={(e) => setMedium(e.target.value as LinkMedium | '')}
                className="w-60"
              >
                <option value="">
                  {t('connect.suggested', 'Suggested: {{m}}', { m: mediumLabel(suggested) })}
                </option>
                {LINK_MEDIA.map((m) => (
                  <option key={m} value={m}>
                    {mediumLabel(m)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </form>
      )}
    </Dialog>
  );
}
