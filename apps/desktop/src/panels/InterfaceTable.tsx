// SPDX-License-Identifier: Apache-2.0
/**
 * Interface table (FR-INS-03): name, enabled, description, mode, access /
 * allowed / native VLAN, IPv4 and IPv6 with prefix, speed, duplex and the
 * connected-to end (read-only). Rows expand into a full editor. Ports can be
 * added with range syntax and bundled into a port-channel (FR-NET-04).
 */
import {
  addInterfaces,
  cidrContains,
  compareInterfaceNames,
  createPortChannel,
  INTERFACE_TYPES,
  isValidIp,
  maskToPrefix,
  nextFreeIp,
  parseCidr,
  parseVlanList,
  removeInterfaces,
  updateInterface,
  type Device,
  type Interface,
  type IpAssignment,
} from '@linewise/core';
import { ChevronRight, Link2, Plus, Trash2 } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BoolField, NumberField, SelectField, TextField } from '../components/fields.tsx';
import { Button, cx } from '../components/ui.tsx';
import { useEditor } from '../store/editor.ts';
import { useUi } from '../store/ui.ts';

export function formatIp(list: IpAssignment[]): string {
  const p = list.find((x) => !x.secondary) ?? list[0];
  return p ? `${p.address}/${p.prefix}` : '';
}

/** Parse "10.0.0.1/24" (or "10.0.0.1 255.255.255.0"); null when invalid. */
export function parseIpWithPrefix(v: string, family: 4 | 6): IpAssignment | null {
  const s = v.trim();
  let addr = s;
  let prefix: number | undefined;
  const slash = s.split('/');
  if (slash.length === 2) {
    addr = slash[0] as string;
    prefix = Number(slash[1]);
  } else if (family === 4) {
    const sp = s.split(/\s+/);
    if (sp.length === 2 && isValidIp(sp[1] as string)) {
      addr = sp[0] as string;
      try {
        prefix = maskToPrefix(sp[1] as string);
      } catch {
        return null;
      }
    }
  }
  if (!isValidIp(addr) || (family === 4) !== !addr.includes(':')) return null;
  if (prefix === undefined || !Number.isInteger(prefix) || prefix < 0 || prefix > (family === 4 ? 32 : 128))
    return null;
  return { address: addr, prefix, secondary: false };
}

function InterfaceEditor({ device, iface }: { device: Device; iface: Interface }) {
  const { t } = useTranslation();
  const doc = useEditor((s) => s.doc);
  const execute = useEditor((s) => s.execute);
  const set = (patch: Partial<Interface>) => execute(updateInterface(device.id, iface.id, patch));
  const setIp = (family: 4 | 6, v: string) => {
    const key = family === 4 ? 'ipv4' : 'ipv6';
    const rest = iface[key].filter((x) => x.secondary);
    if (!v.trim()) return set({ [key]: rest });
    const ip = parseIpWithPrefix(v, family);
    if (!ip) return;
    set({ [key]: [ip, ...rest], ...(iface.mode === 'unset' ? { mode: 'routed' as const } : {}) });
  };
  const vlanErr = (v: string) => {
    try {
      parseVlanList(v);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  };
  // Subnets this interface could take its next free address from.
  const usedIps = useMemo(
    () => doc.devices.flatMap((d) => d.interfaces.flatMap((i) => i.ipv4.map((x) => x.address))),
    [doc],
  );
  const subnets = doc.subnets.filter((s) => !s.cidr.includes(':'));
  const [subnetId, setSubnetId] = useState(subnets[0]?.id ?? '');
  const assignNext = () => {
    const s = subnets.find((x) => x.id === subnetId);
    if (!s) return;
    const used = [...usedIps, ...(s.gatewayIp ? [s.gatewayIp] : [])];
    const ip = nextFreeIp(s.cidr, used, s.reserved);
    if (!ip)
      return useUi
        .getState()
        .toast(t('iface.subnetFull', 'Subnet {{c}} has no free addresses.', { c: s.cidr }), 'error');
    set({
      ipv4: [
        { address: ip, prefix: parseCidr(s.cidr).prefix, secondary: false },
        ...iface.ipv4.filter((x) => x.secondary),
      ],
      ...(iface.mode === 'unset' ? { mode: 'routed' as const } : {}),
    });
  };
  const ipErr = (family: 4 | 6) => (v: string) =>
    parseIpWithPrefix(v, family)
      ? null
      : family === 4
        ? t('iface.ipv4Invalid', 'Use 10.0.0.1/24')
        : t('iface.ipv6Invalid', 'Use 2001:db8::1/64');
  const ipv4 = iface.ipv4[0];
  const inSubnet = ipv4
    ? doc.subnets.find((s) => !s.cidr.includes(':') && cidrContains(parseCidr(s.cidr), ipv4.address))
    : undefined;
  return (
    <div className="flex flex-col gap-1.5 bg-surface-2 px-2 py-2">
      <TextField
        label={t('iface.name', 'Name')}
        mono
        value={iface.name}
        onCommit={(v) => v && set({ name: v })}
      />
      <BoolField
        label={t('iface.enabled', 'Enabled')}
        value={iface.enabled}
        onCommit={(v) => set({ enabled: v })}
      />
      <TextField
        label={t('iface.description', 'Description')}
        value={iface.description}
        onCommit={(v) => set({ description: v })}
      />
      <SelectField
        label={t('iface.mode', 'Mode')}
        value={iface.mode}
        options={[
          { value: 'unset', label: t('mode.unset', 'Not set') },
          { value: 'access', label: t('mode.access', 'Access') },
          { value: 'trunk', label: t('mode.trunk', 'Trunk') },
          { value: 'routed', label: t('mode.routed', 'Routed') },
        ]}
        onCommit={(v) => v && set({ mode: v })}
      />
      {iface.mode === 'access' && (
        <NumberField
          label={t('iface.accessVlan', 'Access VLAN')}
          value={iface.accessVlan}
          min={1}
          max={4094}
          placeholder="1"
          onCommit={(v) => set({ accessVlan: v })}
        />
      )}
      {iface.mode === 'trunk' && (
        <>
          <TextField
            label={t('iface.allowed', 'Allowed VLANs')}
            mono
            value={iface.allowedVlans}
            placeholder={t('iface.all', 'all')}
            validate={vlanErr}
            onCommit={(v) => set({ allowedVlans: v.trim() })}
          />
          <NumberField
            label={t('iface.native', 'Native VLAN')}
            value={iface.nativeVlan}
            min={1}
            max={4094}
            placeholder="1"
            onCommit={(v) => set({ nativeVlan: v })}
          />
        </>
      )}
      <TextField
        label="IPv4"
        mono
        value={formatIp(iface.ipv4)}
        placeholder="10.0.0.1/24"
        validate={ipErr(4)}
        onCommit={(v) => setIp(4, v)}
        hint={
          inSubnet ? t('iface.inSubnet', 'In {{c}} {{n}}', { c: inSubnet.cidr, n: inSubnet.name }) : undefined
        }
      />
      {subnets.length > 0 && (
        <div className="grid grid-cols-[96px_1fr] items-center gap-2">
          <span className="text-[11.5px] text-muted">{t('iface.nextFree', 'Next free')}</span>
          <div className="flex gap-1">
            <select
              aria-label={t('iface.fromSubnet', 'From subnet')}
              className="h-7 min-w-0 flex-1 rounded-md border border-line bg-surface px-1 font-mono text-[11.5px]"
              value={subnetId}
              onChange={(e) => setSubnetId(e.target.value)}
            >
              {subnets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.cidr}
                  {s.name ? ` ${s.name}` : ''}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={assignNext}>
              {t('iface.assign', 'Assign')}
            </Button>
          </div>
        </div>
      )}
      <TextField
        label="IPv6"
        mono
        value={formatIp(iface.ipv6)}
        placeholder="2001:db8::1/64"
        validate={ipErr(6)}
        onCommit={(v) => setIp(6, v)}
      />
      <NumberField
        label={t('iface.speed', 'Speed (Mb/s)')}
        value={iface.speedMbps}
        min={1}
        onCommit={(v) => set({ speedMbps: v })}
      />
      <SelectField
        label={t('iface.duplex', 'Duplex')}
        value={iface.duplex}
        options={[
          { value: 'auto', label: t('duplex.auto', 'Auto') },
          { value: 'full', label: t('duplex.full', 'Full') },
          { value: 'half', label: t('duplex.half', 'Half') },
        ]}
        onCommit={(v) => v && set({ duplex: v })}
      />
      <NumberField
        label="MTU"
        value={iface.mtu}
        min={64}
        max={65535}
        placeholder="1500"
        onCommit={(v) => set({ mtu: v })}
      />
      <SelectField
        label={t('iface.type', 'Type')}
        value={iface.type}
        options={INTERFACE_TYPES.map((x) => ({ value: x, label: x }))}
        onCommit={(v) => v && set({ type: v })}
      />
      <SelectField
        label={t('iface.media', 'Media')}
        value={iface.media}
        options={[
          { value: 'any', label: t('media.any', 'Any') },
          { value: 'copper', label: t('media.copper', 'Copper') },
          { value: 'fiber', label: t('media.fiber', 'Fiber / SFP') },
        ]}
        onCommit={(v) => v && set({ media: v })}
      />
      <SelectField
        label="VRF"
        value={iface.vrfId}
        allowNone={t('iface.globalVrf', 'Global')}
        options={doc.vrfs.map((v) => ({ value: v.id, label: v.name }))}
        onCommit={(v) => set({ vrfId: v })}
      />
      <BoolField label="PoE" value={iface.poe} onCommit={(v) => set({ poe: v })} />
      <SelectField
        label={t('iface.fhrp', 'FHRP')}
        value={iface.fhrp?.protocol}
        allowNone={t('field.none', 'None')}
        options={[
          { value: 'hsrp', label: 'HSRP' },
          { value: 'vrrp', label: 'VRRP' },
          { value: 'glbp', label: 'GLBP' },
        ]}
        onCommit={(v) =>
          set({
            fhrp: v ? { protocol: v, group: iface.fhrp?.group ?? 1, vip: iface.fhrp?.vip ?? '' } : undefined,
          })
        }
      />
      {iface.fhrp && (
        <>
          <NumberField
            label={t('iface.fhrpGroup', 'Group')}
            value={iface.fhrp.group}
            min={0}
            max={4095}
            allowEmpty={false}
            onCommit={(v) => iface.fhrp && set({ fhrp: { ...iface.fhrp, group: v ?? 0 } })}
          />
          <TextField
            label={t('iface.vip', 'Virtual IP')}
            mono
            value={iface.fhrp.vip}
            validate={(v) => (isValidIp(v) ? null : t('field.ipInvalid', 'Not a valid IPv4 or IPv6 address'))}
            onCommit={(v) => iface.fhrp && set({ fhrp: { ...iface.fhrp, vip: v } })}
          />
        </>
      )}
    </div>
  );
}

export function InterfaceTable({ device }: { device: Device }) {
  const { t } = useTranslation();
  const doc = useEditor((s) => s.doc);
  const execute = useEditor((s) => s.execute);
  const setSelection = useEditor((s) => s.setSelection);
  const [open, setOpen] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [range, setRange] = useState('');
  const [filter, setFilter] = useState('');
  const peers = useMemo(() => {
    const m = new Map<string, { linkId: string; text: string }>();
    for (const l of doc.links) {
      for (const [mine, other] of [
        [l.endpointA, l.endpointB],
        [l.endpointB, l.endpointA],
      ] as const) {
        if (mine.deviceId !== device.id) continue;
        const od = doc.devices.find((d) => d.id === other.deviceId);
        const oi = od?.interfaces.find((i) => i.id === other.interfaceId);
        m.set(mine.interfaceId, { linkId: l.id, text: `${od?.hostname ?? '?'} ${oi?.shortName ?? ''}` });
      }
    }
    return m;
  }, [doc, device.id]);
  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return [...device.interfaces]
      .sort((a, b) => compareInterfaceNames(a.name, b.name))
      .filter(
        (i) =>
          !q ||
          `${i.name} ${i.shortName} ${i.description} ${formatIp(i.ipv4)} ${peers.get(i.id)?.text ?? ''}`
            .toLowerCase()
            .includes(q),
      );
  }, [device.interfaces, filter, peers]);
  const pcs = doc.portChannels.filter((p) => p.deviceId === device.id);
  const toggle = (id: string) => {
    const n = new Set(checked);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setChecked(n);
  };
  const add = () => {
    if (!range.trim()) return;
    try {
      const cmd = addInterfaces(device.id, range.trim());
      if (!cmd.names.length) throw new Error(t('iface.rangeInvalid', 'Use a name or range like Gi1/0/1-24'));
      execute(cmd);
      setRange('');
    } catch (e) {
      useUi.getState().toast((e as Error).message, 'error');
    }
  };
  const bundle = () => {
    const members = [...checked].filter((id) =>
      device.interfaces.some((i) => i.id === id && !i.portChannelId),
    );
    if (members.length < 2) return;
    const next = Math.max(0, ...pcs.map((p) => p.number)) + 1;
    execute(createPortChannel(device.id, next, members));
    setChecked(new Set());
  };
  const summary = (i: Interface) => {
    if (i.mode === 'access') return `VLAN ${i.accessVlan ?? 1}`;
    if (i.mode === 'trunk') return `trunk ${i.allowedVlans || 'all'}`;
    return formatIp(i.ipv4) || formatIp(i.ipv6);
  };
  return (
    <div className="-mx-3">
      <div className="flex items-center gap-1 px-3 pb-2">
        <input
          aria-label={t('iface.addRange', 'Add interfaces (name or range)')}
          placeholder={t('iface.addPlaceholder', 'Gi1/0/1-24')}
          className="h-7 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 font-mono text-[12px]"
          value={range}
          onChange={(e) => setRange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <Button size="sm" onClick={add} aria-label={t('iface.add', 'Add interfaces')}>
          <Plus size={13} />
        </Button>
      </div>
      {device.interfaces.length > 8 && (
        <div className="px-3 pb-2">
          <input
            type="search"
            aria-label={t('iface.filter', 'Filter interfaces')}
            placeholder={t('iface.filter', 'Filter interfaces')}
            className="h-7 w-full rounded-md border border-line bg-surface-2 px-2 text-[12px]"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      )}
      {checked.size > 0 && (
        <div className="flex items-center gap-1 px-3 pb-2">
          <span className="text-[11.5px] text-muted">
            {t('iface.checked', '{{n}} selected', { n: checked.size })}
          </span>
          <Button size="sm" className="ml-auto" disabled={checked.size < 2} onClick={bundle}>
            {t('iface.bundle', 'Bundle as port-channel')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label={t('iface.delete', 'Delete selected interfaces')}
            onClick={() => {
              execute(removeInterfaces(device.id, [...checked]));
              setChecked(new Set());
            }}
          >
            <Trash2 size={13} />
          </Button>
        </div>
      )}
      <table className="w-full table-fixed border-collapse text-[11.5px]">
        <caption className="sr-only">
          {t('iface.caption', 'Interfaces of {{h}}', { h: device.hostname })}
        </caption>
        <thead>
          <tr className="border-y border-line text-left text-subtle">
            <th scope="col" className="w-7 py-1 pl-3">
              <span className="sr-only">{t('iface.select', 'Select')}</span>
            </th>
            <th scope="col" className="w-[30%] py-1 font-medium">
              {t('iface.name', 'Name')}
            </th>
            <th scope="col" className="py-1 font-medium">
              {t('iface.config', 'Config')}
            </th>
            <th scope="col" className="w-[34%] py-1 pr-3 font-medium">
              {t('iface.connected', 'Connected to')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => {
            const peer = peers.get(i.id);
            const pc = i.portChannelId ? pcs.find((p) => p.id === i.portChannelId) : undefined;
            const isOpen = open === i.id;
            return (
              <Fragment key={i.id}>
                <tr className={cx('border-b border-line hover:bg-surface-2', isOpen && 'bg-surface-2')}>
                  <td className="py-1 pl-3">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-[var(--accent)]"
                      aria-label={t('iface.selectX', 'Select {{n}}', { n: i.name })}
                      checked={checked.has(i.id)}
                      onChange={() => toggle(i.id)}
                    />
                  </td>
                  <td className="py-1">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-label={`${i.shortName}, ${!i.enabled ? t('iface.shutdown', 'shut down') : peer ? t('iface.up', 'connected') : t('iface.free', 'free')}`}
                      onClick={() => setOpen(isOpen ? null : i.id)}
                      className="flex w-full items-center gap-1 text-left font-mono"
                    >
                      <ChevronRight
                        size={11}
                        className={cx('shrink-0 text-subtle transition-transform', isOpen && 'rotate-90')}
                      />
                      <span
                        className={cx(
                          'h-1.5 w-1.5 shrink-0 rounded-full',
                          !i.enabled ? 'bg-danger' : peer ? 'bg-accent' : 'bg-line-strong',
                        )}
                        aria-hidden="true"
                      />
                      <span className="truncate" title={i.name}>
                        {i.shortName}
                      </span>
                    </button>
                  </td>
                  <td
                    className="truncate py-1 font-mono text-muted"
                    title={`${summary(i)}${pc ? ` · Po${pc.number}` : ''}`}
                  >
                    {summary(i)}
                    {pc && (
                      <span className="ml-1 rounded bg-accent-soft px-1 text-accent">Po{pc.number}</span>
                    )}
                  </td>
                  <td className="truncate py-1 pr-3">
                    {peer ? (
                      <button
                        type="button"
                        className="inline-flex max-w-full items-center gap-1 truncate text-ink hover:text-accent"
                        onClick={() => setSelection({ links: [peer.linkId] })}
                        title={peer.text}
                      >
                        <Link2 size={11} className="shrink-0" />
                        <span className="truncate">{peer.text}</span>
                      </button>
                    ) : (
                      <span className="text-subtle">—</span>
                    )}
                  </td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={4} className="border-b border-line">
                      <InterfaceEditor device={device} iface={i} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {device.interfaces.length === 0 && (
        <p className="px-3 py-3 text-[11.5px] text-subtle">
          {t('iface.none', 'No interfaces yet. Add one by name or range above.')}
        </p>
      )}
    </div>
  );
}
