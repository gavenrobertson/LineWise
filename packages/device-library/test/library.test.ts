// SPDX-License-Identifier: Apache-2.0
import { DEVICE_ROLES, instantiateInterfaces } from '@linewise/core';
import { describe, expect, it } from 'vitest';
import {
  defaultTemplateFor,
  getTemplate,
  ICON_ROLES,
  iconMarkup,
  renderIcon,
  ROLE_CATEGORY,
  ROLE_LABELS,
  searchTemplates,
  TEMPLATES,
} from '../src/index.ts';

describe('icons [FR-ICO-01, FR-ICO-02, FR-ICO-03]', () => {
  it('covers every device role in both styles', () => {
    expect(new Set(ICON_ROLES)).toEqual(new Set(DEVICE_ROLES));
    for (const role of DEVICE_ROLES) {
      expect(ROLE_LABELS[role]).toBeTruthy();
      expect(ROLE_CATEGORY[role]).toBeTruthy();
      for (const style of ['classic', 'line'] as const) {
        const svg = renderIcon(role, style);
        expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 64 64"/);
        expect(svg).not.toMatch(/class="/); // every role class was resolved
        expect(svg).not.toMatch(/<script|on\w+=|href=/i);
      }
    }
  });

  it('uses currentColor so icons recolor with theme and status', () => {
    expect(iconMarkup('router', 'classic')).toContain('fill="currentColor"');
    expect(iconMarkup('router', 'line')).toContain('stroke="currentColor"');
    expect(iconMarkup('router', 'line')).not.toContain('#FFFFFF');
  });
});

describe('templates [FR-TPL-01, FR-TPL-02, FR-TPL-05]', () => {
  it('has unique ids and a generic template for every role', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const role of DEVICE_ROLES) expect(defaultTemplateFor(role), role).toBeTruthy();
  });

  it('every template instantiates valid, unique interface names', () => {
    for (const t of TEMPLATES) {
      const ifs = instantiateInterfaces(t, 'dev');
      const names = ifs.map((i) => i.name);
      expect(new Set(names).size, t.id).toBe(names.length);
    }
    expect(instantiateInterfaces(getTemplate('generic/access-switch-48ge-4sfpplus')!, 'd')).toHaveLength(52);
  });

  it('vendor templates cite a datasheet or are marked unverified', () => {
    for (const t of TEMPLATES.filter((x) => !x.generic)) {
      expect(t.verified ? Boolean(t.sourceUrl) : true, t.id).toBe(true);
    }
  });

  it('searches by text, role and vendor', () => {
    expect(searchTemplates(TEMPLATES, { text: 'access 48' }).map((t) => t.id)).toEqual([
      'generic/access-switch-48ge-4sfpplus',
    ]);
    expect(searchTemplates(TEMPLATES, { role: 'router' })).toHaveLength(2);
    expect(searchTemplates(TEMPLATES, { vendor: 'generic', text: 'firewall' })).toHaveLength(1);
    expect(searchTemplates(TEMPLATES, { vendor: 'nobody' })).toHaveLength(0);
  });
});
