// SPDX-License-Identifier: Apache-2.0
/**
 * Selection and arrange actions (FR-CAN-04/06/16): select by type, select
 * connected, front/back, group/ungroup (a group is a borderless zone that
 * carries its members), lock/unlock, and copy/paste style.
 */
import {
  addZone,
  batch,
  connectedDevices,
  devicesWithSameRole,
  removeItems,
  reorderItems,
  setLocked,
  updateAnnotation,
  updateDevices,
  updateLinkStyle,
  updateLinks,
  updateZone,
  type Annotation,
  type Command,
  type Link,
} from '@linewise/core';
import i18n from '../i18n/index.ts';
import { canvasApi } from '../canvas/Canvas.tsx';
import { selectPage, useEditor } from '../store/editor.ts';
import { useUi } from '../store/ui.ts';

const t = (k: string, d: string) => i18n.t(k, { defaultValue: d });

export function zoomToSelection(): void {
  const s = useEditor.getState().selection;
  const ids = [...s.devices, ...s.zones, ...s.annotations];
  if (ids.length) canvasApi.focusOn(ids);
  else canvasApi.fit();
}

export function selectSameType(): void {
  const ed = useEditor.getState();
  const page = selectPage(ed);
  if (!ed.selection.devices.length || !page) return;
  ed.setSelection({
    devices: devicesWithSameRole(ed.doc, ed.selection.devices).filter((id) => page.nodePositions[id]),
  });
}

export function selectConnected(): void {
  const ed = useEditor.getState();
  const page = selectPage(ed);
  if (!ed.selection.devices.length || !page) return;
  const devices = connectedDevices(ed.doc, ed.selection.devices).filter((id) => page.nodePositions[id]);
  const set = new Set(devices);
  const links = ed.doc.links
    .filter((l) => set.has(l.endpointA.deviceId) && set.has(l.endpointB.deviceId))
    .map((l) => l.id);
  ed.setSelection({ devices, links });
}

export function bring(where: 'front' | 'back'): void {
  const ed = useEditor.getState();
  const ids = [...ed.selection.zones, ...ed.selection.annotations];
  if (ids.length) ed.execute(reorderItems(ed.pageId, ids, where));
}

export function lock(locked: boolean): void {
  const ed = useEditor.getState();
  const s = ed.selection;
  const ids = [...s.devices, ...s.zones, ...s.annotations];
  if (ids.length) ed.execute(setLocked(ed.pageId, ids, locked));
}

/** Group: wrap the selected devices in a borderless zone that moves them together. */
export function group(): void {
  const ed = useEditor.getState();
  const page = selectPage(ed);
  if (!page) return;
  const pts = ed.selection.devices
    .map((id) => page.nodePositions[id])
    .filter((p): p is { x: number; y: number } => !!p);
  if (pts.length < 2) {
    useUi.getState().toast(t('group.need', 'Select at least two devices to group.'));
    return;
  }
  const pad = 70;
  const x = Math.min(...pts.map((p) => p.x)) - pad;
  const y = Math.min(...pts.map((p) => p.y)) - pad;
  const w = Math.max(...pts.map((p) => p.x)) + pad - x;
  const h = Math.max(...pts.map((p) => p.y)) + pad + 20 - y;
  const zone = addZone(ed.pageId, t('group.name', 'Group'), 'custom', { x, y, w, h });
  const cmd = batch('Group', [
    zone,
    updateZone(zone.zoneId, { color: '#64748B' }),
    updateDevices(ed.selection.devices, { zoneId: zone.zoneId }),
  ]);
  if (ed.execute(cmd)) ed.setSelection({ zones: [zone.zoneId] });
}

/** Ungroup: remove the selected zones, keeping everything that was inside. */
export function ungroup(): void {
  const ed = useEditor.getState();
  if (ed.selection.zones.length) ed.execute({ ...removeItems(ed.selection.zones), label: 'Ungroup' });
}

// ---------------------------------------------------------------- format painter

type StyleClip =
  | { kind: 'link'; medium: Link['medium']; style: Link['style'] }
  | { kind: 'annotation'; style: Annotation['style'] }
  | { kind: 'zone'; color: string }
  | { kind: 'device'; colorTag?: string; labelPosition: string };

let styleClip: StyleClip | null = null;

export function copyStyle(): void {
  const ed = useEditor.getState();
  const s = ed.selection;
  const page = selectPage(ed);
  const link = ed.doc.links.find((l) => l.id === s.links[0]);
  const ann = page?.annotations.find((a) => a.id === s.annotations[0]);
  const zone = ed.doc.zones.find((z) => z.id === s.zones[0]);
  const dev = ed.doc.devices.find((d) => d.id === s.devices[0]);
  if (link) styleClip = { kind: 'link', medium: link.medium, style: { ...link.style, waypoints: undefined } };
  else if (ann) styleClip = { kind: 'annotation', style: { ...ann.style } };
  else if (zone) styleClip = { kind: 'zone', color: zone.color };
  else if (dev) styleClip = { kind: 'device', colorTag: dev.colorTag, labelPosition: dev.labelPosition };
  else return;
  useUi.getState().toast(t('style.copied', 'Style copied. Select other objects and choose Paste style.'));
}

export function pasteStyle(): void {
  const ed = useEditor.getState();
  const s = ed.selection;
  const clip = styleClip;
  if (!clip) return;
  const cmds: Command[] = [];
  if (clip.kind === 'link' && s.links.length) {
    cmds.push(
      updateLinks(s.links, { medium: clip.medium }),
      updateLinkStyle(s.links, { routing: clip.style.routing, color: clip.style.color }),
    );
  }
  if (clip.kind === 'annotation')
    for (const id of s.annotations) cmds.push(updateAnnotation(ed.pageId, id, { style: { ...clip.style } }));
  if (clip.kind === 'zone') for (const id of s.zones) cmds.push(updateZone(id, { color: clip.color }));
  if (clip.kind === 'device' && s.devices.length)
    cmds.push(
      updateDevices(s.devices, { colorTag: clip.colorTag, labelPosition: clip.labelPosition as 'bottom' }),
    );
  if (cmds.length) ed.execute(batch('Paste style', cmds));
}

export function hasStyleClip(): boolean {
  return styleClip !== null;
}
