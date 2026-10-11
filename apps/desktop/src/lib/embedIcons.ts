// SPDX-License-Identifier: Apache-2.0
/**
 * Embed icon-pack icons in the document (FR-ICO-06): every device that refers to an installed
 * pack icon gets the image as a document asset instead, so the file renders on a machine
 * without the pack. Identical images are stored once. Null when there is nothing to embed.
 */
import { addAsset, batch, updateDevices, type Command, type NetworkDocument } from '@linewise/core';
import { packIcon } from '../canvas/icons.ts';

export function embedPackIcons(doc: NetworkDocument): Command | null {
  const cmds: Command[] = [];
  const byImage = new Map(Object.entries(doc.assets).map(([id, a]) => [`${a.mime}|${a.base64}`, id]));
  const byRef = new Map<string, string[]>();
  for (const d of doc.devices)
    if (d.iconOverride && packIcon(d.iconOverride))
      byRef.set(d.iconOverride, [...(byRef.get(d.iconOverride) ?? []), d.id]);
  for (const [ref, ids] of byRef) {
    const icon = packIcon(ref)!;
    let assetId = byImage.get(`${icon.mime}|${icon.base64}`);
    if (!assetId) {
      const a = addAsset(icon.mime, icon.base64);
      cmds.push(a);
      assetId = a.assetId;
      byImage.set(`${icon.mime}|${icon.base64}`, assetId);
    }
    cmds.push(updateDevices(ids, { iconOverride: `asset:${assetId}` }));
  }
  return cmds.length ? batch('Embed icons', cmds) : null;
}
