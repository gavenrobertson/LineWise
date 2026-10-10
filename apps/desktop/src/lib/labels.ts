// SPDX-License-Identifier: Apache-2.0
/**
 * Display names for the app's fixed vocabularies, all through i18next (NFR-I18N-01). Each label is
 * a literal t() call so the extractor (scripts/i18n.ts) finds it. Roles, role categories and
 * starter diagrams come from the device library; the extractor adds their keys from that data.
 */
import type { LinkMedium } from '@linewise/core';
import { ROLE_LABELS, type RoleCategory } from '@linewise/device-library';
import type { DeviceRole } from '@linewise/core';
import i18n from '../i18n/index.ts';

const t = (key: string, defaultValue: string) => i18n.t(key, { defaultValue });

export function mediumLabel(m: LinkMedium): string {
  switch (m) {
    case 'copper':
      return t('medium.copper', 'Copper');
    case 'fiber-sm':
      return t('medium.fiber-sm', 'Fiber, single-mode');
    case 'fiber-mm':
      return t('medium.fiber-mm', 'Fiber, multimode');
    case 'serial':
      return t('medium.serial', 'Serial');
    case 'wireless':
      return t('medium.wireless', 'Wireless');
    case 'virtual':
      return t('medium.virtual', 'Virtual or tunnel');
    case 'console':
      return t('medium.console', 'Console');
  }
}

export function severityLabel(s: 'error' | 'warning' | 'info'): string {
  switch (s) {
    case 'error':
      return t('severity.error', 'Errors');
    case 'warning':
      return t('severity.warning', 'Warnings');
    case 'info':
      return t('severity.info', 'Information');
  }
}

export function layerLabel(l: 'l1' | 'l2' | 'l3'): string {
  switch (l) {
    case 'l1':
      return t('layer.l1', 'Physical (L1)');
    case 'l2':
      return t('layer.l2', 'Data link (L2)');
    case 'l3':
      return t('layer.l3', 'Network (L3)');
  }
}

/** Device roles, from the device library's English names. */
export function roleLabel(role: DeviceRole): string {
  return i18n.t(`role.${role}`, { defaultValue: ROLE_LABELS[role] });
}

/** Library categories, from the device library. */
export function categoryLabel(c: RoleCategory): string {
  return i18n.t(`category.${c}`, { defaultValue: c });
}

/** Starter diagram names and descriptions, from the device library. */
export function starterText(id: string, field: 'name' | 'desc', english: string): string {
  return i18n.t(`starter.${id}.${field}`, { defaultValue: english });
}
