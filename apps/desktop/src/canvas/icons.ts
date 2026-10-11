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

/**
 * Icons of the installed icon packs, by "<packId>/<iconId>". The app fills it when packs load or
 * change (store/packs.ts), so the canvas and the exporters resolve pack references the same way.
 */
const packIcons = new Map<string, { mime: string; base64: string }>();

export function setPackIcons(entries: Iterable<[string, { mime: string; base64: string }]>): void {
  packIcons.clear();
  for (const [k, v] of entries) packIcons.set(k, v);
}

/** The installed icon a pack reference ("pack:<packId>/<iconId>") points to, if any. */
export function packIcon(iconOverride: string | undefined): { mime: string; base64: string } | undefined {
  return iconOverride?.startsWith('pack:') ? packIcons.get(iconOverride.slice(5)) : undefined;
}

/**
 * data: URL of a custom icon: embedded ("asset:<id>") or from an installed pack ("pack:…")
 * (FR-ICO-05). A reference to a pack that is not installed gives undefined, so the device shows
 * its built-in icon.
 */
export function customIconUrl(doc: NetworkDocument, iconOverride: string | undefined): string | undefined {
  if (iconOverride?.startsWith('asset:')) return assetDataUrl(doc.assets[iconOverride.slice(6)]);
  return assetDataUrl(packIcon(iconOverride));
}

/** Pack references used by the document whose pack (or icon) is not installed. */
export function missingPackIcons(doc: NetworkDocument): string[] {
  const refs = new Set(
    doc.devices.map((d) => d.iconOverride).filter((o): o is string => !!o?.startsWith('pack:')),
  );
  return [...refs].filter((r) => !packIcon(r));
}

/** The role whose built-in icon a device shows: its own, or another role it overrides to. */
export function iconRole(role: DeviceRole, iconOverride: string | undefined): DeviceRole {
  return iconOverride && (DEVICE_ROLES as readonly string[]).includes(iconOverride)
    ? (iconOverride as DeviceRole)
    : role;
}
