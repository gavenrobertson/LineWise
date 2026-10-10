// SPDX-License-Identifier: Apache-2.0
/**
 * Properties inspector (FR-INS-01..04): device fields, interface table, link,
 * zone and annotation fields, and document settings when nothing is selected.
 * Multi-select edits apply to every selected object of the same type.
 */
import {
  DEVICE_ROLES,
  isValidIp,
  LINK_MEDIA,
  updateAnnotation,
  updateDevices,
  updateDocumentInfo,
  updateLinks,
  updateLinkStyle,
  updatePage,
  updateSettings,
  updateZone,
  type Annotation,
  type Device,
  type Link,
  type Zone,
} from '@linewise/core';
import { ROLE_LABELS } from '@linewise/device-library';
import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BoolField, ColorField, NumberField, SelectField, shared, TextField } from '../components/fields.tsx';
import { Badge, Button, IconButton } from '../components/ui.tsx';
import { p2pCommand } from '../lib/ipam.ts';
import { selectPage, useEditor } from '../store/editor.ts';
import { IconPicker } from '../components/IconPicker.tsx';
import { InterfaceTable } from './InterfaceTable.tsx';

function Group({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="border-b border-line px-3 py-3 last:border-b-0">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-subtle">{title}</h3>
        {actions}
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </section>
  );
}

const hostnameRe = /^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/;

function DeviceFields({ devices }: { devices: Device[] }) {
  const { t } = useTranslation();
  const execute = useEditor((s) => s.execute);
  const zones = useEditor((s) => s.doc.zones);
  const ids = devices.map((d) => d.id);
  const single = devices.length === 1 ? devices[0] : undefined;
  const set = (patch: Partial<Device>) => execute(updateDevices(ids, patch));
  const text = (
    label: string,
    key: 'vendor' | 'model' | 'platform' | 'osVersion' | 'serial' | 'assetTag' | 'site' | 'rack',
    mono = false,
  ) => (
    <TextField
      label={label}
      value={shared(devices, (d) => d[key])}
      mono={mono}
      onCommit={(v) => set({ [key]: v })}
    />
  );
  return (
    <>
      <Group
        title={
          devices.length > 1
            ? t('inspector.devicesN', '{{n}} devices', { n: devices.length })
            : t('inspector.device', 'Device')
        }
      >
        {single && (
          <TextField
            id="inspector-hostname"
            label={t('field.hostname', 'Hostname')}
            value={single.hostname}
            validate={(v) =>
              hostnameRe.test(v)
                ? null
                : t('field.hostnameInvalid', 'Letters, digits, dot, dash and underscore; up to 63 characters')
            }
            onCommit={(v) => v && set({ hostname: v })}
          />
        )}
        <SelectField
          label={t('field.role', 'Role')}
          value={shared(devices, (d) => d.role)}
          options={DEVICE_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
          onCommit={(v) => v && set({ role: v })}
        />
        {text(t('field.vendor', 'Vendor'), 'vendor')}
        {text(t('field.model', 'Model'), 'model')}
        {text(t('field.platform', 'Platform'), 'platform')}
        {text(t('field.os', 'OS version'), 'osVersion')}
        <TextField
          label={t('field.mgmtIp', 'Mgmt IP')}
          value={shared(devices, (d) => d.mgmtIp)}
          mono
          validate={(v) => (isValidIp(v) ? null : t('field.ipInvalid', 'Not a valid IPv4 or IPv6 address'))}
          onCommit={(v) => set({ mgmtIp: v })}
        />
        {text(t('field.serial', 'Serial'), 'serial', true)}
        {text(t('field.assetTag', 'Asset tag'), 'assetTag', true)}
        {text(t('field.site', 'Site'), 'site')}
        {text(t('field.rack', 'Rack'), 'rack')}
        <NumberField
          label={t('field.rackUnit', 'Rack unit')}
          value={shared(devices, (d) => d.rackUnit)}
          min={1}
          max={60}
          onCommit={(v) => set({ rackUnit: v })}
        />
        <SelectField
          label={t('field.zone', 'Zone')}
          value={shared(devices, (d) => d.zoneId)}
          allowNone={t('field.none', 'None')}
          options={zones.map((z) => ({ value: z.id, label: z.name }))}
          onCommit={(v) => set({ zoneId: v })}
        />
        <TextField
          label={t('field.tags', 'Tags')}
          value={shared(devices, (d) => d.tags.join(', '))}
          placeholder="core, prod"
          onCommit={(v) =>
            set({
              tags: v
                .split(',')
                .map((x) => x.trim())
                .filter(Boolean),
            })
          }
        />
        <IconPicker devices={devices} />
        <ColorField
          label={t('field.colorTag', 'Color tag')}
          value={shared(devices, (d) => d.colorTag)}
          onCommit={(v) => set({ colorTag: v })}
        />
        <BoolField
          label={t('field.locked', 'Locked')}
          value={shared(devices, (d) => d.locked)}
          onCommit={(v) => set({ locked: v })}
        />
        <SelectField
          label={t('field.labelPos', 'Label')}
          value={shared(devices, (d) => d.labelPosition)}
          options={[
            { value: 'bottom', label: t('pos.bottom', 'Below') },
            { value: 'top', label: t('pos.top', 'Above') },
            { value: 'left', label: t('pos.left', 'Left') },
            { value: 'right', label: t('pos.right', 'Right') },
          ]}
          onCommit={(v) => v && set({ labelPosition: v })}
        />
        <TextField
          label={t('field.notes', 'Notes')}
          multiline
          value={shared(devices, (d) => d.notes)}
          onCommit={(v) => set({ notes: v })}
        />
      </Group>
      {single && <RoutingAnnotations device={single} />}
      {single && (
        <Group title={t('inspector.interfaces', 'Interfaces')}>
          <InterfaceTable device={single} />
        </Group>
      )}
    </>
  );
}

const PROTOCOLS = ['ospf', 'eigrp', 'bgp', 'isis', 'rip', 'static'] as const;

function RoutingAnnotations({ device }: { device: Device }) {
  const { t } = useTranslation();
  const execute = useEditor((s) => s.execute);
  const set = (routing: Device['routing']) => execute(updateDevices([device.id], { routing }));
  return (
    <Group
      title={t('inspector.routing', 'Routing')}
      actions={
        <IconButton
          label={t('inspector.addRouting', 'Add routing annotation')}
          className="h-6 min-w-6"
          onClick={() => set([...device.routing, { protocol: 'ospf', value: 'area 0' }])}
        >
          <Plus size={14} />
        </IconButton>
      }
    >
      {device.routing.length === 0 && (
        <p className="text-[11.5px] text-subtle">
          {t(
            'inspector.noRouting',
            'Add OSPF areas, BGP AS numbers and similar; they show as badges in the L3 view.',
          )}
        </p>
      )}
      {device.routing.map((r, i) => (
        <div key={i} className="flex items-center gap-1">
          <select
            aria-label={t('field.protocol', 'Protocol')}
            className="h-7 rounded-md border border-line bg-surface px-1 text-[12px]"
            value={r.protocol}
            onChange={(e) =>
              set(
                device.routing.map((x, j) =>
                  j === i ? { ...x, protocol: e.target.value as (typeof PROTOCOLS)[number] } : x,
                ),
              )
            }
          >
            {PROTOCOLS.map((p) => (
              <option key={p} value={p}>
                {p.toUpperCase()}
              </option>
            ))}
          </select>
          <input
            aria-label={t('field.routingValue', 'Value')}
            className="h-7 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 font-mono text-[12px]"
            defaultValue={r.value}
            onBlur={(e) =>
              e.target.value !== r.value &&
              set(device.routing.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))
            }
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
          <IconButton
            label={t('inspector.removeRouting', 'Remove')}
            className="h-6 min-w-6"
            onClick={() => set(device.routing.filter((_, j) => j !== i))}
          >
            <Trash2 size={13} />
          </IconButton>
        </div>
      ))}
    </Group>
  );
}

function LinkFields({ links }: { links: Link[] }) {
  const { t } = useTranslation();
  const doc = useEditor((s) => s.doc);
  const execute = useEditor((s) => s.execute);
  const ids = links.map((l) => l.id);
  const set = (patch: Partial<Link>) => execute(updateLinks(ids, patch));
  const single = links.length === 1 ? links[0] : undefined;
  const endText = (e: Link['endpointA']) => {
    const d = doc.devices.find((x) => x.id === e.deviceId);
    const i = d?.interfaces.find((x) => x.id === e.interfaceId);
    return `${d?.hostname ?? '?'} ${i?.name ?? ''}`;
  };
  return (
    <Group
      title={
        links.length > 1
          ? t('inspector.linksN', '{{n}} links', { n: links.length })
          : t('inspector.link', 'Link')
      }
    >
      {single && (
        <div className="mb-1 rounded-md bg-surface-2 px-2 py-1.5 font-mono text-[11.5px] text-ink">
          <div>{endText(single.endpointA)}</div>
          <div className="text-subtle">↕</div>
          <div>{endText(single.endpointB)}</div>
        </div>
      )}
      <SelectField
        label={t('field.medium', 'Medium')}
        value={shared(links, (l) => l.medium)}
        options={LINK_MEDIA.map((m) => ({ value: m, label: t(`medium.${m}`, m) }))}
        onCommit={(v) => v && set({ medium: v })}
      />
      <NumberField
        label={t('field.bandwidth', 'Bandwidth (Mb/s)')}
        value={shared(links, (l) => l.bandwidthMbps)}
        min={1}
        onCommit={(v) => set({ bandwidthMbps: v })}
      />
      <TextField
        label={t('field.label', 'Label')}
        value={shared(links, (l) => l.label)}
        onCommit={(v) => set({ label: v })}
      />
      <TextField
        label={t('field.cableId', 'Cable ID')}
        value={shared(links, (l) => l.cableId)}
        mono
        onCommit={(v) => set({ cableId: v })}
      />
      <TextField
        label={t('field.circuitId', 'Circuit ID')}
        value={shared(links, (l) => l.circuitId)}
        mono
        onCommit={(v) => set({ circuitId: v })}
      />
      <TextField
        label={t('field.provider', 'Provider')}
        value={shared(links, (l) => l.provider)}
        onCommit={(v) => set({ provider: v })}
      />
      <SelectField
        label={t('field.routing', 'Line style')}
        value={shared(links, (l) => l.style.routing)}
        allowNone={t('field.docDefault', 'Diagram default')}
        options={[
          { value: 'straight', label: t('routing.straight', 'Straight') },
          { value: 'orthogonal', label: t('routing.orthogonal', 'Orthogonal') },
          { value: 'curved', label: t('routing.curved', 'Curved') },
        ]}
        onCommit={(v) => execute(updateLinkStyle(ids, { routing: v }))}
      />
      <ColorField
        label={t('field.color', 'Color')}
        value={shared(links, (l) => l.style.color)}
        onCommit={(v) => execute(updateLinkStyle(ids, { color: v }))}
      />
      {links.some((l) => l.style.waypoints?.length) && (
        <button
          type="button"
          className="self-start text-[11.5px] text-accent-ink underline"
          onClick={() => execute(updateLinkStyle(ids, { waypoints: undefined }))}
        >
          {t('inspector.clearBends', 'Remove bend points')}
        </button>
      )}
      <p className="text-[11px] text-subtle">
        {t(
          'inspector.bendHint',
          'Double-click a link to add a bend; drag bends to move them; double-click a bend to remove it.',
        )}
      </p>
      {single && <P2pHelper linkId={single.id} />}
    </Group>
  );
}

const ROUTED = new Set(['router', 'l3-switch', 'firewall', 'vpn-concentrator']);

/** "Assign /30 (or /31) from pool…" for router-to-router links (FR-NET-08). */
function P2pHelper({ linkId }: { linkId: string }) {
  const { t } = useTranslation();
  const doc = useEditor((s) => s.doc);
  const execute = useEditor((s) => s.execute);
  const [pool, setPool] = useState(() => {
    try {
      return localStorage.getItem('linewise.p2pPool') ?? '10.255.0.0/24';
    } catch {
      return '10.255.0.0/24';
    }
  });
  const [prefix, setPrefix] = useState<30 | 31>(30);
  const [err, setErr] = useState<string | null>(null);
  const link = doc.links.find((l) => l.id === linkId);
  const a = doc.devices.find((d) => d.id === link?.endpointA.deviceId);
  const b = doc.devices.find((d) => d.id === link?.endpointB.deviceId);
  if (!link || !a || !b || !ROUTED.has(a.role) || !ROUTED.has(b.role)) return null;
  const run = () => {
    try {
      execute(p2pCommand(doc, linkId, pool.trim(), prefix).cmd);
      setErr(null);
      try {
        localStorage.setItem('linewise.p2pPool', pool.trim());
      } catch {
        // remembered for this session only
      }
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <div className="mt-1 rounded-md border border-line p-2">
      <p className="mb-1 text-[11.5px] font-medium text-ink">
        {t('inspector.p2p', 'Point-to-point addressing')}
      </p>
      <div className="flex items-center gap-1">
        <input
          aria-label={t('ipam.pool', 'Pool')}
          className="h-7 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 font-mono text-[12px]"
          value={pool}
          onChange={(e) => setPool(e.target.value)}
        />
        <select
          aria-label={t('ipam.size', 'Size')}
          className="h-7 rounded-md border border-line bg-surface px-1 text-[12px]"
          value={prefix}
          onChange={(e) => setPrefix(Number(e.target.value) as 30 | 31)}
        >
          <option value={30}>/30</option>
          <option value={31}>/31</option>
        </select>
        <Button size="sm" onClick={run}>
          {t('ipam.assignP2p', 'Assign /{{p}}', { p: prefix })}
        </Button>
      </div>
      {err && (
        <p role="alert" className="mt-1 text-[11px] text-danger">
          {err}
        </p>
      )}
    </div>
  );
}

function ZoneFields({ zones }: { zones: Zone[] }) {
  const { t } = useTranslation();
  const execute = useEditor((s) => s.execute);
  const all = useEditor((s) => s.doc.zones);
  const set = (patch: Partial<Zone>) => zones.forEach((z) => execute(updateZone(z.id, patch)));
  const single = zones.length === 1 ? zones[0] : undefined;
  return (
    <Group
      title={
        zones.length > 1
          ? t('inspector.zonesN', '{{n}} zones', { n: zones.length })
          : t('inspector.zone', 'Zone')
      }
    >
      {single && (
        <TextField
          label={t('field.name', 'Name')}
          value={single.name}
          onCommit={(v) => v && set({ name: v })}
        />
      )}
      <SelectField
        label={t('field.kind', 'Kind')}
        value={shared(zones, (z) => z.kind)}
        options={[
          { value: 'site', label: t('zone.site', 'Site') },
          { value: 'building', label: t('zone.building', 'Building') },
          { value: 'floor', label: t('zone.floor', 'Floor') },
          { value: 'security-zone', label: t('zone.security', 'Security zone') },
          { value: 'cloud-vpc', label: t('zone.vpc', 'Cloud VPC') },
          { value: 'custom', label: t('zone.custom', 'Custom') },
        ]}
        onCommit={(v) => v && set({ kind: v })}
      />
      {single && (
        <SelectField
          label={t('field.parent', 'Inside')}
          value={single.parentZoneId}
          allowNone={t('field.none', 'None')}
          options={all.filter((z) => z.id !== single.id).map((z) => ({ value: z.id, label: z.name }))}
          onCommit={(v) => set({ parentZoneId: v })}
        />
      )}
      <ColorField
        label={t('field.color', 'Color')}
        value={shared(zones, (z) => z.color)}
        onCommit={(v) => set({ color: v ?? '#0D9488' })}
      />
      <BoolField
        label={t('field.locked', 'Locked')}
        value={shared(zones, (z) => z.locked)}
        onCommit={(v) => set({ locked: v })}
      />
      <TextField
        label={t('field.description', 'Description')}
        multiline
        value={shared(zones, (z) => z.description)}
        onCommit={(v) => set({ description: v })}
      />
    </Group>
  );
}

function AnnotationFields({ annotations }: { annotations: Annotation[] }) {
  const { t } = useTranslation();
  const execute = useEditor((s) => s.execute);
  const pageId = useEditor((s) => s.pageId);
  const layers = useEditor(selectPage)?.layers ?? [];
  const set = (patch: Partial<Annotation>) =>
    annotations.forEach((a) => execute(updateAnnotation(pageId, a.id, patch)));
  const setStyle = (patch: Partial<Annotation['style']>) =>
    annotations.forEach((a) => execute(updateAnnotation(pageId, a.id, { style: { ...a.style, ...patch } })));
  const single = annotations.length === 1 ? annotations[0] : undefined;
  return (
    <Group
      title={
        annotations.length > 1
          ? t('inspector.annN', '{{n}} annotations', { n: annotations.length })
          : t('inspector.annotation', 'Annotation')
      }
    >
      {single && single.kind !== 'image' && single.kind !== 'line' && (
        <TextField
          label={t('field.text', 'Text')}
          multiline
          value={single.text}
          onCommit={(v) => set({ text: v })}
        />
      )}
      {single?.kind === 'image' && (
        <TextField
          label={t('field.altText', 'Alt text')}
          value={single.text}
          onCommit={(v) => set({ text: v })}
        />
      )}
      <NumberField
        label={t('field.fontSize', 'Font size')}
        value={shared(annotations, (a) => a.style.fontSize)}
        min={6}
        max={96}
        placeholder="13"
        onCommit={(v) => setStyle({ fontSize: v })}
      />
      <ColorField
        label={t('field.fill', 'Fill')}
        value={shared(annotations, (a) => a.style.fill)}
        onCommit={(v) => setStyle({ fill: v })}
      />
      <ColorField
        label={t('field.stroke', 'Stroke')}
        value={shared(annotations, (a) => a.style.stroke)}
        onCommit={(v) => setStyle({ stroke: v })}
      />
      {annotations.every((a) => a.kind === 'line') && (
        <BoolField
          label={t('field.arrow', 'Arrowhead')}
          value={shared(annotations, (a) => !!a.style.arrowEnd)}
          onCommit={(v) => setStyle({ arrowEnd: v })}
        />
      )}
      <NumberField
        label={t('field.rotation', 'Rotation (°)')}
        value={shared(annotations, (a) => a.geometry.rotation)}
        min={-360}
        max={360}
        onCommit={(v) =>
          annotations.forEach((a) =>
            execute(updateAnnotation(pageId, a.id, { geometry: { ...a.geometry, rotation: v ?? 0 } })),
          )
        }
      />
      {layers.length > 0 && (
        <SelectField
          label={t('field.layer', 'Layer')}
          value={shared(annotations, (a) => a.layerId)}
          allowNone={t('field.none', 'None')}
          options={layers.map((l) => ({ value: l.id, label: l.name }))}
          onCommit={(v) => set({ layerId: v })}
        />
      )}
      <BoolField
        label={t('field.locked', 'Locked')}
        value={shared(annotations, (a) => a.locked)}
        onCommit={(v) => set({ locked: v })}
      />
    </Group>
  );
}

function DocumentFields() {
  const { t } = useTranslation();
  const doc = useEditor((s) => s.doc);
  const page = useEditor(selectPage);
  const execute = useEditor((s) => s.execute);
  const s = doc.settings;
  const set = (patch: Partial<typeof s>) => execute(updateSettings(patch));
  return (
    <>
      <Group title={t('inspector.diagram', 'Diagram')}>
        <TextField
          label={t('field.name', 'Name')}
          value={doc.name}
          onCommit={(v) => v && execute(updateDocumentInfo({ name: v }))}
        />
        <TextField
          label={t('field.author', 'Author')}
          value={doc.author}
          onCommit={(v) => execute(updateDocumentInfo({ author: v }))}
        />
        <TextField
          label={t('field.description', 'Description')}
          multiline
          value={doc.description}
          onCommit={(v) => execute(updateDocumentInfo({ description: v }))}
        />
        <div className="mt-1 flex flex-wrap gap-1">
          <Badge>{t('inspector.countDevices', '{{n}} devices', { n: doc.devices.length })}</Badge>
          <Badge>{t('inspector.countLinks', '{{n}} links', { n: doc.links.length })}</Badge>
          <Badge>{t('inspector.countVlans', '{{n}} VLANs', { n: doc.vlans.length })}</Badge>
          <Badge>{t('inspector.countSubnets', '{{n}} subnets', { n: doc.subnets.length })}</Badge>
        </div>
      </Group>
      {page && (
        <Group title={t('inspector.page', 'Page')}>
          <TextField
            label={t('field.name', 'Name')}
            value={page.name}
            onCommit={(v) => v && execute(updatePage(page.id, { name: v }))}
          />
          <SelectField
            label={t('field.background', 'Background')}
            value={page.background}
            options={[
              { value: 'dots', label: t('bg.dots', 'Dots') },
              { value: 'grid', label: t('bg.grid', 'Grid') },
              { value: 'plain', label: t('bg.plain', 'Plain') },
            ]}
            onCommit={(v) => v && execute(updatePage(page.id, { background: v }))}
          />
        </Group>
      )}
      <Group title={t('inspector.display', 'Display')}>
        <SelectField
          label={t('field.iconStyle', 'Icons')}
          value={s.iconStyle}
          options={[
            { value: 'classic', label: t('icons.classic', 'Classic (filled)') },
            { value: 'line', label: t('icons.line', 'Line (print)') },
          ]}
          onCommit={(v) => v && set({ iconStyle: v })}
        />
        <TextField
          label={t('field.labelTemplate', 'Label')}
          mono
          value={s.labelTemplate}
          hint={t('field.labelTemplateHint', 'Fields: {hostname} {model} {mgmtIp} {site} {role}')}
          onCommit={(v) => set({ labelTemplate: v || '{hostname}' })}
        />
        <SelectField
          label={t('field.defaultRouting', 'Links')}
          value={s.defaultLinkRouting}
          options={[
            { value: 'straight', label: t('routing.straight', 'Straight') },
            { value: 'orthogonal', label: t('routing.orthogonal', 'Orthogonal') },
            { value: 'curved', label: t('routing.curved', 'Curved') },
          ]}
          onCommit={(v) => v && set({ defaultLinkRouting: v })}
        />
        <BoolField
          label={t('field.showNames', 'Port names')}
          value={s.showInterfaceNames}
          onCommit={(v) => set({ showInterfaceNames: v })}
        />
        <BoolField
          label={t('field.showIps', 'Port IPs')}
          value={s.showInterfaceIps}
          onCommit={(v) => set({ showInterfaceIps: v })}
        />
        <BoolField
          label={t('field.showVlans', 'Port VLANs')}
          value={s.showVlans}
          onCommit={(v) => set({ showVlans: v })}
        />
      </Group>
    </>
  );
}

export function Inspector() {
  const { t } = useTranslation();
  const doc = useEditor((s) => s.doc);
  const sel = useEditor((s) => s.selection);
  const page = useEditor(selectPage);
  const devices = useMemo(
    () => doc.devices.filter((d) => sel.devices.includes(d.id)),
    [doc.devices, sel.devices],
  );
  const links = useMemo(() => doc.links.filter((l) => sel.links.includes(l.id)), [doc.links, sel.links]);
  const zones = useMemo(() => doc.zones.filter((z) => sel.zones.includes(z.id)), [doc.zones, sel.zones]);
  const annotations = useMemo(
    () => (page?.annotations ?? []).filter((a) => sel.annotations.includes(a.id)),
    [page, sel.annotations],
  );
  const nothing = !devices.length && !links.length && !zones.length && !annotations.length;
  return (
    <aside
      aria-label={t('inspector.title', 'Inspector')}
      className="lw-no-print flex h-full w-[320px] shrink-0 flex-col border-l border-line bg-surface"
    >
      <div className="flex h-10 shrink-0 items-center border-b border-line px-3">
        <h2 className="font-brand text-[13px] font-semibold text-ink">{t('inspector.title', 'Inspector')}</h2>
        {!nothing && (
          <span className="ml-auto text-[11px] text-subtle">
            {t('inspector.selected', '{{n}} selected', {
              n: devices.length + links.length + zones.length + annotations.length,
            })}
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {nothing && <DocumentFields />}
        {devices.length > 0 && <DeviceFields devices={devices} />}
        {links.length > 0 && <LinkFields links={links} />}
        {zones.length > 0 && <ZoneFields zones={zones} />}
        {annotations.length > 0 && <AnnotationFields annotations={annotations} />}
      </div>
    </aside>
  );
}
