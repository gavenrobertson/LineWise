// SPDX-License-Identifier: Apache-2.0
/** Device templates (FR-TPL-01) and instantiation into interfaces (FR-NET-01). */
import { z } from 'zod';
import { newId, nowIso } from './ids.ts';
import { expandInterfaceRange, normalizeInterfaceName } from './naming.ts';
import { DeviceRole, InterfaceType, type Interface } from './schema.ts';

export const TemplateInterface = z.object({
  /** Single name or range syntax: "Gi1/0/1-48". */
  range: z.string().min(1),
  type: InterfaceType.optional(),
  speedMbps: z.number().int().positive().optional(),
  media: z.enum(['copper', 'fiber', 'any']).optional(),
  poe: z.boolean().optional(),
  description: z.string().optional(),
});

export const DeviceTemplate = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/, 'id must be "<vendor>/<model>" in lower case'),
  name: z.string().min(1),
  vendor: z.string().min(1),
  model: z.string(),
  role: DeviceRole,
  iconRef: z.string().optional(),
  rackUnits: z.number().int().min(0).max(60).default(1),
  interfaces: z.array(TemplateInterface).default([]),
  defaults: z
    .object({ platform: z.string().default(''), osVersion: z.string().default('') })
    .default({ platform: '', osVersion: '' }),
  /** Public datasheet the port layout came from (required for vendor models). */
  sourceUrl: z.string().url().optional(),
  contributor: z.string().default(''),
  verified: z.boolean().default(false),
  generic: z.boolean().default(false),
});
export type DeviceTemplate = z.infer<typeof DeviceTemplate>;
export type DeviceTemplateInput = z.input<typeof DeviceTemplate>;

/** Validate a template; vendor-model templates must cite a datasheet unless marked unverified. */
export function validateTemplate(input: unknown): DeviceTemplate {
  const t = DeviceTemplate.parse(input);
  if (!t.generic && t.verified && !t.sourceUrl) {
    throw new Error(`Template ${t.id} is marked verified but has no sourceUrl`);
  }
  return t;
}

export function makeInterface(deviceId: string, name: string, extra: Partial<Interface> = {}): Interface {
  const n = normalizeInterfaceName(name);
  const t = nowIso();
  const iface: Interface = {
    id: newId(),
    createdAt: t,
    updatedAt: t,
    customFields: {},
    deviceId,
    name: n.name,
    shortName: n.shortName,
    type: n.type,
    duplex: 'auto',
    enabled: true,
    description: '',
    mode:
      n.type === 'loopback' || n.type === 'vlan' || n.type === 'tunnel' || n.type === 'subinterface'
        ? 'routed'
        : 'unset',
    allowedVlans: '',
    ipv4: [],
    ipv6: [],
    media: n.media,
    poe: false,
    ...extra,
  };
  if (n.speedMbps !== undefined && iface.speedMbps === undefined) iface.speedMbps = n.speedMbps;
  if (n.dot1q !== undefined && iface.dot1q === undefined) iface.dot1q = n.dot1q;
  return iface;
}

/** Create the interfaces a template defines for a new device. */
export function instantiateInterfaces(template: DeviceTemplate, deviceId: string): Interface[] {
  const out: Interface[] = [];
  for (const spec of template.interfaces) {
    for (const name of expandInterfaceRange(spec.range)) {
      const extra: Partial<Interface> = {};
      if (spec.type) extra.type = spec.type;
      if (spec.speedMbps) extra.speedMbps = spec.speedMbps;
      if (spec.media) extra.media = spec.media;
      if (spec.poe !== undefined) extra.poe = spec.poe;
      if (spec.description) extra.description = spec.description;
      out.push(makeInterface(deviceId, name, extra));
    }
  }
  return out;
}
