// SPDX-License-Identifier: Apache-2.0
/** Which icon a device shows (pure; shared by the canvas and the exporters). */
import { DEVICE_ROLES, type DeviceRole, type NetworkDocument } from '@linewise/core';

/** data: URL of an embedded custom icon ("asset:<id>"), if the device uses one (FR-ICO-05). */
export function customIconUrl(doc: NetworkDocument, iconOverride: string | undefined): string | undefined {
  if (!iconOverride?.startsWith('asset:')) return undefined;
  const a = doc.assets[iconOverride.slice(6)];
  return a ? `data:${a.mime};base64,${a.base64}` : undefined;
}

/** The role whose built-in icon a device shows: its own, or another role it overrides to. */
export function iconRole(role: DeviceRole, iconOverride: string | undefined): DeviceRole {
  return iconOverride && (DEVICE_ROLES as readonly string[]).includes(iconOverride)
    ? (iconOverride as DeviceRole)
    : role;
}
