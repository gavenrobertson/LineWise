// SPDX-License-Identifier: Apache-2.0
/**
 * Subnets and IPAM (FR-NET-06/08): subnet list with utilization and overlap
 * detection, VLSM planning into real subnets, the point-to-point helper and VRFs.
 */
import * as Tabs from '@radix-ui/react-tabs';
import {
  batch,
  isValidCidr,
  isValidIp,
  nextFreeIp,
  parseCidr,
  cidrToString,
  removeSubnets,
  removeVrfs,
  upsertSubnet,
  upsertVrf,
  subnetInfo,
  vlsm,
  type Subnet,
} from '@linewise/core';
import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpButton } from '../components/HelpButton.tsx';
import {
  Badge,
  Button,
  CardRows,
  Dialog,
  Field,
  HoverCard,
  IconButton,
  Select,
  TextInput,
} from '../components/ui.tsx';
import { assignedAddresses, overlappingSubnets, p2pCommand, subnetUtilization } from '../lib/ipam.ts';
import { useEditor } from '../store/editor.ts';
import { useUi } from '../store/ui.ts';

const tabCls =
  'h-8 border-b-2 border-transparent px-3 text-[12.5px] font-medium text-muted hover:text-ink data-[state=active]:border-accent data-[state=active]:text-ink';

/** Normalize "10.1.1.5/24" to its network "10.1.1.0/24"; null when invalid. */
export function normalizeCidr(v: string): string | null {
  const s = v.trim();
  if (!/\/\d+$/.test(s)) return null;
  try {
    return cidrToString(parseCidr(s));
  } catch {
    return null;
  }
}

function safeNextFree(s: Subnet, used: string[]): string | null {
  try {
    return nextFreeIp(s.cidr, s.gatewayIp ? [...used, s.gatewayIp] : used, s.reserved);
  } catch {
    return null;
  }
}

function SubnetsTab() {
  const { t } = useTranslation();
  const doc = useEditor((s) => s.doc);
  const execute = useEditor((s) => s.execute);
  const [cidr, setCidr] = useState('');
  const [name, setName] = useState('');
  const [vlanId, setVlanId] = useState('');
  const [vrfId, setVrfId] = useState('');
  const [gateway, setGateway] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const util = useMemo(() => subnetUtilization(doc), [doc]);
  const overlaps = useMemo(() => overlappingSubnets(doc), [doc]);
  const used = useMemo(() => assignedAddresses(doc), [doc]);
  const add = () => {
    const c = normalizeCidr(cidr);
    if (!c) return setErr(t('ipam.badCidr', 'Enter a subnet like 10.10.20.0/24 or 2001:db8:10::/64'));
    if (gateway && !isValidIp(gateway))
      return setErr(t('field.ipInvalid', 'Not a valid IPv4 or IPv6 address'));
    execute(
      upsertSubnet({
        cidr: c,
        name,
        gatewayIp: gateway,
        ...(vlanId ? { vlanId } : {}),
        ...(vrfId ? { vrfId } : {}),
      }),
    );
    setCidr('');
    setName('');
    setGateway('');
    setErr(null);
  };
  const set = (s: Subnet, patch: Partial<Subnet>) => execute(upsertSubnet({ ...s, ...patch }));
  const sorted = [...doc.subnets].sort((a, b) => a.cidr.localeCompare(b.cidr, undefined, { numeric: true }));
  return (
    <div className="flex flex-col gap-4">
      <form
        className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1.3fr_1fr_1fr_0.9fr_1.1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Field label={t('ipam.cidr', 'Subnet')}>
          {(id) => (
            <TextInput
              id={id}
              className="font-mono"
              placeholder="10.10.20.0/24"
              value={cidr}
              onChange={(e) => setCidr(e.target.value)}
              aria-invalid={!!err}
            />
          )}
        </Field>
        <Field label={t('ipam.name', 'Name')}>
          {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="VLAN">
          {(id) => (
            <Select id={id} value={vlanId} onChange={(e) => setVlanId(e.target.value)}>
              <option value="">—</option>
              {doc.vlans.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.number} {v.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="VRF">
          {(id) => (
            <Select id={id} value={vrfId} onChange={(e) => setVrfId(e.target.value)}>
              <option value="">{t('iface.globalVrf', 'Global')}</option>
              {doc.vrfs.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('ipam.gateway', 'Gateway')}>
          {(id) => (
            <TextInput
              id={id}
              className="font-mono"
              value={gateway}
              onChange={(e) => setGateway(e.target.value)}
            />
          )}
        </Field>
        <Button type="submit" variant="primary">
          <Plus size={14} />
          {t('ipam.add', 'Add')}
        </Button>
        {err && (
          <p role="alert" className="col-span-full text-xs text-danger">
            {err}
          </p>
        )}
      </form>
      {sorted.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted">
          {t('ipam.none', 'No subnets yet. Add one above, or plan a block on the VLSM tab.')}
        </p>
      ) : (
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-subtle">
              <th scope="col" className="py-1">
                {t('ipam.cidr', 'Subnet')}
              </th>
              <th scope="col" className="py-1">
                {t('ipam.name', 'Name')}
              </th>
              <th scope="col" className="py-1">
                VLAN
              </th>
              <th scope="col" className="py-1">
                {t('ipam.gateway', 'Gateway')}
              </th>
              <th scope="col" className="py-1">
                {t('ipam.nextFree', 'Next free')}
              </th>
              <th scope="col" className="w-36 py-1">
                {t('ipam.used', 'Used')}
              </th>
              <th scope="col" className="w-8 py-1">
                <span className="sr-only">{t('common.actions', 'Actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => {
              const u = util.get(s.id) ?? 0;
              const next = safeNextFree(s, used);
              return (
                <tr key={s.id} className="border-b border-line">
                  <td className="py-1 pr-2 font-mono">
                    <SubnetCard cidr={s.cidr} used={u}>
                      <span tabIndex={0} className="rounded-sm">
                        {s.cidr}
                      </span>
                    </SubnetCard>
                    {overlaps.has(s.id) && (
                      <span className="ml-1">
                        <Badge tone="error">{t('ipam.overlap', 'overlap')}</Badge>
                      </span>
                    )}
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      aria-label={t('ipam.nameOf', 'Name of {{c}}', { c: s.cidr })}
                      defaultValue={s.name}
                      key={s.name}
                      onBlur={(e) => e.target.value !== s.name && set(s, { name: e.target.value })}
                      className="h-7 w-full rounded border border-transparent bg-transparent px-1 hover:border-line focus:border-accent"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <select
                      aria-label={t('ipam.vlanOf', 'VLAN of {{c}}', { c: s.cidr })}
                      className="h-7 rounded border border-transparent bg-transparent text-[12px] hover:border-line"
                      value={s.vlanId ?? ''}
                      onChange={(e) => set(s, { vlanId: e.target.value || undefined })}
                    >
                      <option value="">—</option>
                      {doc.vlans.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.number}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      aria-label={t('ipam.gwOf', 'Gateway of {{c}}', { c: s.cidr })}
                      defaultValue={s.gatewayIp}
                      key={s.gatewayIp}
                      onBlur={(e) =>
                        e.target.value !== s.gatewayIp &&
                        (e.target.value === '' || isValidIp(e.target.value)) &&
                        set(s, { gatewayIp: e.target.value })
                      }
                      className="h-7 w-full rounded border border-transparent bg-transparent px-1 font-mono hover:border-line focus:border-accent"
                    />
                  </td>
                  <td className="py-1 pr-2 font-mono text-muted">{next ?? t('ipam.full', 'full')}</td>
                  <td className="py-1 pr-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3"
                        role="meter"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(u * 100)}
                        aria-label={t('ipam.utilOf', 'Utilization of {{c}}', { c: s.cidr })}
                      >
                        <div
                          className={`h-full ${u > 0.9 ? 'bg-danger' : u > 0.7 ? 'bg-warning' : 'bg-accent-fill'}`}
                          style={{ width: `${Math.max(u > 0 ? 2 : 0, u * 100)}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-[11px] text-muted">
                        {u > 0 && u < 0.01 ? '<1%' : `${Math.round(u * 100)}%`}
                      </span>
                    </div>
                  </td>
                  <td className="py-1 text-right">
                    <IconButton
                      label={t('ipam.delete', 'Delete {{c}}', { c: s.cidr })}
                      className="h-7 min-w-7"
                      onClick={() => execute(removeSubnets([s.id]))}
                    >
                      <Trash2 size={13} />
                    </IconButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function VlsmTab() {
  const { t } = useTranslation();
  const execute = useEditor((s) => s.execute);
  const toast = useUi((s) => s.toast);
  const [block, setBlock] = useState('10.20.0.0/22');
  const [rows, setRows] = useState([
    { name: 'Users', hosts: '200' },
    { name: 'Voice', hosts: '100' },
    { name: 'Servers', hosts: '50' },
  ]);
  let result: { name: string; cidr: string; hosts: number }[] | null = null;
  let err: string | null = null;
  try {
    const reqs = rows
      .filter((r) => r.name.trim() && Number(r.hosts) > 0)
      .map((r) => ({ name: r.name.trim(), hosts: Number(r.hosts) }));
    if (reqs.length && isValidCidr(block.trim())) result = vlsm(block.trim(), reqs);
    else if (block.trim() && !isValidCidr(block.trim()))
      err = t('ipam.badBlock', 'Enter an IPv4 block such as 10.20.0.0/22');
  } catch (e) {
    err = (e as Error).message;
  }
  return (
    <div className="flex flex-col gap-3">
      <Field label={t('ipam.block', 'Address block')} error={err}>
        {(id, d) => (
          <TextInput
            id={id}
            aria-describedby={d}
            className="w-56 font-mono"
            value={block}
            onChange={(e) => setBlock(e.target.value)}
            aria-invalid={!!err}
          />
        )}
      </Field>
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-subtle">
            <th scope="col" className="py-1">
              {t('ipam.name', 'Name')}
            </th>
            <th scope="col" className="w-28 py-1">
              {t('ipam.hosts', 'Hosts')}
            </th>
            <th scope="col" className="py-1">
              {t('ipam.result', 'Subnet')}
            </th>
            <th scope="col" className="w-8">
              <span className="sr-only">{t('common.actions', 'Actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line">
              <td className="py-1 pr-2">
                <TextInput
                  aria-label={t('ipam.reqName', 'Requirement name')}
                  value={r.name}
                  onChange={(e) =>
                    setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                  }
                />
              </td>
              <td className="py-1 pr-2">
                <TextInput
                  aria-label={t('ipam.hosts', 'Hosts')}
                  inputMode="numeric"
                  className="font-mono"
                  value={r.hosts}
                  onChange={(e) =>
                    setRows(rows.map((x, j) => (j === i ? { ...x, hosts: e.target.value } : x)))
                  }
                />
              </td>
              <td className="py-1 pr-2 font-mono text-ink">
                {result?.find((x) => x.name === r.name.trim())?.cidr ?? '—'}
              </td>
              <td>
                <IconButton
                  label={t('ipam.removeRow', 'Remove row')}
                  className="h-7 min-w-7"
                  onClick={() => setRows(rows.filter((_, j) => j !== i))}
                >
                  <Trash2 size={13} />
                </IconButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2">
        <Button onClick={() => setRows([...rows, { name: '', hosts: '' }])}>
          <Plus size={14} />
          {t('ipam.addRow', 'Add requirement')}
        </Button>
        <Button
          variant="primary"
          disabled={!result?.length}
          onClick={() => {
            if (!result) return;
            execute(
              batch(
                'Add planned subnets',
                result.map((r) => upsertSubnet({ cidr: r.cidr, name: r.name })),
              ),
            );
            toast(t('ipam.added', 'Added {{n}} subnets.', { n: result.length }), 'success');
          }}
        >
          {t('ipam.createAll', 'Create these subnets')}
        </Button>
      </div>
    </div>
  );
}

function P2pTab() {
  const { t } = useTranslation();
  const doc = useEditor((s) => s.doc);
  const execute = useEditor((s) => s.execute);
  const toast = useUi((s) => s.toast);
  const [pool, setPool] = useState('10.255.0.0/24');
  const [prefix, setPrefix] = useState<30 | 31>(30);
  const routed = new Set(['router', 'l3-switch', 'firewall', 'vpn-concentrator']);
  const candidates = doc.links.filter((l) => {
    const a = doc.devices.find((d) => d.id === l.endpointA.deviceId);
    const b = doc.devices.find((d) => d.id === l.endpointB.deviceId);
    return a && b && routed.has(a.role) && routed.has(b.role);
  });
  const label = (l: (typeof candidates)[number]) => {
    const end = (e: typeof l.endpointA) => {
      const d = doc.devices.find((x) => x.id === e.deviceId);
      const i = d?.interfaces.find((x) => x.id === e.interfaceId);
      return {
        text: `${d?.hostname} ${i?.shortName ?? ''}`,
        ip: i?.ipv4[0] ? `${i.ipv4[0].address}/${i.ipv4[0].prefix}` : '',
      };
    };
    return [end(l.endpointA), end(l.endpointB)] as const;
  };
  const run = (linkId: string) => {
    try {
      const { cmd, cidr } = p2pCommand(doc, linkId, pool.trim(), prefix);
      execute(cmd);
      toast(t('ipam.p2pDone', 'Assigned {{c}}', { c: cidr }), 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t('ipam.pool', 'Pool')}>
          {(id) => (
            <TextInput
              id={id}
              className="w-48 font-mono"
              value={pool}
              onChange={(e) => setPool(e.target.value)}
            />
          )}
        </Field>
        <Field label={t('ipam.size', 'Size')}>
          {(id) => (
            <Select
              id={id}
              value={String(prefix)}
              onChange={(e) => setPrefix(Number(e.target.value) as 30 | 31)}
              className="w-24"
            >
              <option value="30">/30</option>
              <option value="31">/31</option>
            </Select>
          )}
        </Field>
      </div>
      {candidates.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted">
          {t('ipam.noP2p', 'No router-to-router links yet.')}
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {candidates.map((l) => {
            const [a, b] = label(l);
            const done = a.ip && b.ip;
            return (
              <li key={l.id} className="flex items-center gap-2 px-2 py-1.5 text-[12.5px]">
                <span className="min-w-0 flex-1 truncate font-mono">
                  {a.text} {a.ip && <span className="text-muted">{a.ip}</span>} ↔ {b.text}{' '}
                  {b.ip && <span className="text-muted">{b.ip}</span>}
                </span>
                <Button size="sm" variant={done ? 'ghost' : 'secondary'} onClick={() => run(l.id)}>
                  {done
                    ? t('ipam.renumber', 'Renumber')
                    : t('ipam.assignP2p', 'Assign /{{p}}', { p: prefix })}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function VrfTab() {
  const { t } = useTranslation();
  const doc = useEditor((s) => s.doc);
  const execute = useEditor((s) => s.execute);
  const [name, setName] = useState('');
  const [rd, setRd] = useState('');
  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || doc.vrfs.some((v) => v.name === name.trim())) return;
          execute(upsertVrf({ name: name.trim(), rd: rd.trim() }));
          setName('');
          setRd('');
        }}
      >
        <Field label={t('vrf.name', 'VRF name')}>
          {(id) => (
            <TextInput id={id} className="w-48" value={name} onChange={(e) => setName(e.target.value)} />
          )}
        </Field>
        <Field label="RD">
          {(id) => (
            <TextInput
              id={id}
              className="w-40 font-mono"
              placeholder="65000:10"
              value={rd}
              onChange={(e) => setRd(e.target.value)}
            />
          )}
        </Field>
        <Button type="submit" variant="primary">
          <Plus size={14} />
          {t('vrf.add', 'Add VRF')}
        </Button>
      </form>
      <ul className="divide-y divide-line rounded-lg border border-line">
        {doc.vrfs.map((v) => {
          const n = doc.devices.reduce(
            (acc, d) => acc + d.interfaces.filter((i) => i.vrfId === v.id).length,
            0,
          );
          return (
            <li key={v.id} className="flex items-center gap-2 px-2 py-1.5 text-[12.5px]">
              <span className="w-40 truncate font-medium">{v.name}</span>
              <span className="w-32 font-mono text-muted">{v.rd || '—'}</span>
              <span className="flex-1 text-muted">{t('vrf.ifaces', '{{n}} interfaces', { n })}</span>
              <IconButton
                label={t('vrf.delete', 'Delete VRF {{n}}', { n: v.name })}
                className="h-7 min-w-7"
                onClick={() => execute(removeVrfs([v.id]))}
              >
                <Trash2 size={13} />
              </IconButton>
            </li>
          );
        })}
        {doc.vrfs.length === 0 && (
          <li className="px-2 py-4 text-center text-xs text-muted">
            {t('vrf.none', 'Everything is in the global routing table.')}
          </li>
        )}
      </ul>
    </div>
  );
}

export function IpamDialog() {
  const { t } = useTranslation();
  const close = useUi((s) => s.close);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && close()}
      title={t('ipam.title', 'Subnets and IPAM')}
      help={<HelpButton topic="subnets" />}
      width={920}
      footer={<Button onClick={close}>{t('common.done', 'Done')}</Button>}
    >
      <Tabs.Root defaultValue="subnets">
        <Tabs.List
          className="mb-4 flex border-b border-line"
          aria-label={t('ipam.title', 'Subnets and IPAM')}
        >
          <Tabs.Trigger value="subnets" className={tabCls}>
            {t('ipam.subnets', 'Subnets')}
          </Tabs.Trigger>
          <Tabs.Trigger value="vlsm" className={tabCls}>
            {t('ipam.vlsm', 'VLSM planner')}
          </Tabs.Trigger>
          <Tabs.Trigger value="p2p" className={tabCls}>
            {t('ipam.p2p', 'Point-to-point')}
          </Tabs.Trigger>
          <Tabs.Trigger value="vrf" className={tabCls}>
            {t('ipam.vrfs', 'VRFs')}
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="subnets">
          <SubnetsTab />
        </Tabs.Content>
        <Tabs.Content value="vlsm">
          <VlsmTab />
        </Tabs.Content>
        <Tabs.Content value="p2p">
          <P2pTab />
        </Tabs.Content>
        <Tabs.Content value="vrf">
          <VrfTab />
        </Tabs.Content>
      </Tabs.Root>
    </Dialog>
  );
}

/** The subnet card (FR-UX-09): the numbers the subnet table leaves out. */
function SubnetCard({ cidr, used, children }: { cidr: string; used: number; children: ReactNode }) {
  const { t } = useTranslation();
  const info = safeSubnetInfo(cidr);
  if (!info) return <>{children}</>;
  return (
    <HoverCard
      side="right"
      content={
        <div className="flex flex-col gap-1.5">
          <span className="font-mono font-semibold">{info.cidr}</span>
          <CardRows
            rows={[
              [t('calc.network', 'Network'), info.network],
              ...(info.broadcast
                ? [[t('calc.broadcast', 'Broadcast'), info.broadcast] as [string, string]]
                : []),
              ...(info.mask ? [[t('calc.mask', 'Mask'), info.mask] as [string, string]] : []),
              ...(info.firstUsable && info.lastUsable
                ? [
                    [t('calc.range', 'Usable range'), `${info.firstUsable} – ${info.lastUsable}`] as [
                      string,
                      string,
                    ],
                  ]
                : []),
              [t('calc.hosts', 'Usable hosts'), info.hosts.toLocaleString()],
              [t('ipam.inUse', 'In use'), `${Math.round(used * 100)}%`],
            ]}
          />
        </div>
      }
    >
      {children}
    </HoverCard>
  );
}

function safeSubnetInfo(cidr: string): ReturnType<typeof subnetInfo> | null {
  try {
    return subnetInfo(cidr);
  } catch {
    return null;
  }
}
