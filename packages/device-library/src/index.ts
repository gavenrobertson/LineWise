// SPDX-License-Identifier: Apache-2.0
import { validateTemplate, type DeviceRole, type DeviceTemplate } from '@linewise/core';
import { RAW_TEMPLATES } from './generated.ts';

export * from './icons.ts';

/** Every bundled template, validated (FR-TPL-01). Throws at startup if a template is malformed. */
export const TEMPLATES: DeviceTemplate[] = RAW_TEMPLATES.map((t) => validateTemplate(t));

const byId = new Map(TEMPLATES.map((t) => [t.id, t]));

export function getTemplate(id: string): DeviceTemplate | undefined {
  return byId.get(id);
}

/** The default generic template for a role (used when a role is dropped without picking a model). */
export function defaultTemplateFor(role: DeviceRole): DeviceTemplate | undefined {
  return TEMPLATES.find((t) => t.generic && t.role === role);
}

export interface TemplateQuery {
  text?: string;
  role?: DeviceRole;
  vendor?: string;
}

/** Library search by name, model, role or vendor (FR-TPL-05). */
export function searchTemplates(templates: DeviceTemplate[], q: TemplateQuery): DeviceTemplate[] {
  const terms = (q.text ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  return templates.filter((t) => {
    if (q.role && t.role !== q.role) return false;
    if (q.vendor && t.vendor.toLowerCase() !== q.vendor.toLowerCase()) return false;
    const hay = `${t.name} ${t.model} ${t.vendor} ${t.role}`.toLowerCase();
    return terms.every((term) => hay.includes(term));
  });
}
export { STARTERS, type Starter } from './starters.ts';
