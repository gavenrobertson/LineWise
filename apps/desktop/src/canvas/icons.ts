// SPDX-License-Identifier: Apache-2.0
/** Which icon a device shows (pure; shared by the canvas and the exporters). */
import { DEVICE_ROLES, type DeviceRole, type NetworkDocument } from '@linewise/core';

const IMAGE_MIME = /^image\/(png|jpeg|gif|webp|svg\+xml)$/;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * A data URL for an embedded asset, or undefined when the asset is not a plain image. Files can
 * be edited by hand, so the MIME type and payload are checked before they reach an attribute
 * (the SVG exporter writes this URL into markup).
 */
export function assetDataUrl(asset: { mime: string; base64: string } | undefined): string | undefined {
  if (!asset || !IMAGE_MIME.test(asset.mime) || !BASE64.test(asset.base64)) return undefined;
  return `data:${asset.mime};base64,${asset.base64}`;
}

/** data: URL of an embedded custom icon ("asset:<id>"), if the device uses one (FR-ICO-05). */
export function customIconUrl(doc: NetworkDocument, iconOverride: string | undefined): string | undefined {
  if (!iconOverride?.startsWith('asset:')) return undefined;
  return assetDataUrl(doc.assets[iconOverride.slice(6)]);
}

/** The role whose built-in icon a device shows: its own, or another role it overrides to. */
export function iconRole(role: DeviceRole, iconOverride: string | undefined): DeviceRole {
  return iconOverride && (DEVICE_ROLES as readonly string[]).includes(iconOverride)
    ? (iconOverride as DeviceRole)
    : role;
}
